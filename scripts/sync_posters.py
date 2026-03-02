#!/usr/bin/env python3
"""
Sync missing poster_path values in the movies table using TMDB.

Usage:
  SUPABASE_URL=... SUPABASE_KEY=... TMDB_API_KEY=... python3 scripts/sync_posters.py

Notes:
- SUPABASE_KEY should be a service role key if RLS prevents updates.
- Set DRY_RUN=1 to preview without updating.
- Adjust BATCH_SIZE or SLEEP_SECONDS if you hit rate limits.
"""

import os
import sys
import time
import json
import requests
from urllib.parse import quote
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import re

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
TMDB_API_KEY = os.environ.get("TMDB_API_KEY")
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "200"))
SLEEP_SECONDS = float(os.environ.get("SLEEP_SECONDS", "0.25"))

if not SUPABASE_URL or not SUPABASE_KEY or not TMDB_API_KEY:
    print("Missing SUPABASE_URL, SUPABASE_KEY, or TMDB_API_KEY.")
    sys.exit(1)

SUPABASE_URL = SUPABASE_URL.rstrip("/")
REST_URL = f"{SUPABASE_URL}/rest/v1"

SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

TMDB_HEADERS = {"Accept": "application/json"}

TIMEOUT_SECONDS = float(os.environ.get("TIMEOUT_SECONDS", "60"))
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "5"))
BACKOFF_FACTOR = float(os.environ.get("BACKOFF_FACTOR", "0.5"))

session = requests.Session()
retry = Retry(
    total=MAX_RETRIES,
    connect=MAX_RETRIES,
    read=MAX_RETRIES,
    status=MAX_RETRIES,
    backoff_factor=BACKOFF_FACTOR,
    status_forcelist=(429, 500, 502, 503, 504),
    allowed_methods=("GET", "PATCH"),
)
adapter = HTTPAdapter(max_retries=retry)
session.mount("https://", adapter)


def supabase_count(filter_query=None):
    params = {"select": "id", "limit": "1"}
    if filter_query:
        params.update(filter_query)
    r = session.get(
        f"{REST_URL}/movies",
        headers={**SUPABASE_HEADERS, "Prefer": "count=exact"},
        params=params,
        timeout=TIMEOUT_SECONDS,
    )
    r.raise_for_status()
    content_range = r.headers.get("Content-Range", "0/0")
    return int(content_range.split("/")[-1] or 0)


def fetch_movies_missing_posters(offset):
    params = {
        "select": "id,title,year,tmdb_id,poster_path",
        "poster_path": "is.null",
        "order": "id.asc",
        "limit": str(BATCH_SIZE),
        "offset": str(offset),
    }
    r = session.get(
        f"{REST_URL}/movies",
        headers=SUPABASE_HEADERS,
        params=params,
        timeout=TIMEOUT_SECONDS,
    )
    r.raise_for_status()
    return r.json()


def tmdb_movie_details(tmdb_id):
    r = session.get(
        f"https://api.themoviedb.org/3/movie/{tmdb_id}",
        headers=TMDB_HEADERS,
        params={"api_key": TMDB_API_KEY},
        timeout=TIMEOUT_SECONDS,
    )
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()


def tmdb_search(title, year=None):
    params = {"api_key": TMDB_API_KEY, "query": title}
    if year:
        params["year"] = year
    r = session.get(
        "https://api.themoviedb.org/3/search/movie",
        headers=TMDB_HEADERS,
        params=params,
        timeout=TIMEOUT_SECONDS,
    )
    r.raise_for_status()
    data = r.json() or {}
    results = data.get("results", [])
    return results[0] if results else None


def normalize_title(value):
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def is_safe_tmdb_match(movie_title, movie_year, tmdb_result):
    if not tmdb_result:
        return False

    tmdb_title = tmdb_result.get("title") or ""
    if normalize_title(movie_title) != normalize_title(tmdb_title):
        return False

    if movie_year:
        release_date = tmdb_result.get("release_date") or ""
        tmdb_year = release_date[:4] if release_date else None
        if tmdb_year and str(movie_year) != str(tmdb_year):
            return False

    return True


def update_movie(movie_id, poster_path, tmdb_id=None):
    payload = {"poster_path": poster_path}
    if tmdb_id:
        payload["tmdb_id"] = tmdb_id
    if DRY_RUN:
        return True
    r = session.patch(
        f"{REST_URL}/movies",
        headers=SUPABASE_HEADERS,
        params={"id": f"eq.{movie_id}"},
        data=json.dumps(payload),
        timeout=TIMEOUT_SECONDS,
    )
    r.raise_for_status()
    return True


def main():
    total_movies = supabase_count()
    missing_count = supabase_count({"poster_path": "is.null"})
    print(f"Total movies: {total_movies}")
    print(f"Missing posters: {missing_count}")

    processed = 0
    updated = 0
    offset = 0

    while True:
        batch = fetch_movies_missing_posters(offset)
        if not batch:
            break

        for movie in batch:
            processed += 1
            title = (movie.get("title") or "").strip()
            year = movie.get("year")
            tmdb_id = movie.get("tmdb_id")

            poster_path = None
            tmdb_lookup_id = None

            if tmdb_id:
                details = tmdb_movie_details(tmdb_id)
                if details:
                    poster_path = details.get("poster_path")
                    tmdb_lookup_id = tmdb_id
            elif title:
                result = tmdb_search(title, year)
                if result and is_safe_tmdb_match(title, year, result):
                    poster_path = result.get("poster_path")
                    tmdb_lookup_id = result.get("id")

            if poster_path:
                update_movie(movie.get("id"), poster_path, tmdb_lookup_id)
                updated += 1

            if processed % 25 == 0:
                print(
                    f"Processed {processed}/{missing_count} missing | Updated {updated} | Total movies {total_movies}",
                    flush=True,
                )

            if SLEEP_SECONDS:
                time.sleep(SLEEP_SECONDS)

        offset += BATCH_SIZE

    print("Done.")
    print(f"Processed {processed}/{missing_count} missing | Updated {updated} | Total movies {total_movies}")


if __name__ == "__main__":
    try:
        main()
    except requests.HTTPError as exc:
        print(f"HTTP error: {exc}")
        sys.exit(1)

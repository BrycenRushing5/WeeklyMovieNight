#!/usr/bin/env python3
"""
Import recent TMDB movies into the local movies table using conservative matching.

Usage:
  SUPABASE_URL=... SUPABASE_KEY=... TMDB_API_KEY=... python3 scripts/sync_recent_tmdb_movies.py

Optional env:
  DRY_RUN=1
  TMDB_PAGES=2
  TMDB_ENDPOINTS=now_playing,upcoming,popular
  SLEEP_SECONDS=0.2

This script does not require tmdb_id to be unique in the database.
It only updates an existing row when the title/year match looks safe.
"""

import json
import os
import re
import sys
import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
TMDB_API_KEY = os.environ.get("TMDB_API_KEY")
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"
TMDB_PAGES = int(os.environ.get("TMDB_PAGES", "2"))
TMDB_ENDPOINTS = [item.strip() for item in os.environ.get("TMDB_ENDPOINTS", "now_playing,upcoming,popular").split(",") if item.strip()]
SLEEP_SECONDS = float(os.environ.get("SLEEP_SECONDS", "0.2"))
TIMEOUT_SECONDS = float(os.environ.get("TIMEOUT_SECONDS", "60"))
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "5"))
BACKOFF_FACTOR = float(os.environ.get("BACKOFF_FACTOR", "0.5"))

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

TMDB_APP_GENRE_MAP = {
    28: "Action",
    12: "Adventure",
    35: "Comedy",
    99: "Documentary",
    14: "Fantasy",
    27: "Horror",
    10749: "Romance",
    878: "Sci-Fi",
    53: "Mystery & thriller",
    80: "Mystery & thriller",
    9648: "Mystery & thriller",
}

session = requests.Session()
retry = Retry(
    total=MAX_RETRIES,
    connect=MAX_RETRIES,
    read=MAX_RETRIES,
    status=MAX_RETRIES,
    backoff_factor=BACKOFF_FACTOR,
    status_forcelist=(429, 500, 502, 503, 504),
    allowed_methods=("GET", "POST", "PATCH"),
)
adapter = HTTPAdapter(max_retries=retry)
session.mount("https://", adapter)


def normalize_title(value):
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def map_tmdb_genres(genre_ids):
    return sorted({TMDB_APP_GENRE_MAP[genre_id] for genre_id in (genre_ids or []) if genre_id in TMDB_APP_GENRE_MAP})


def fetch_tmdb_endpoint(endpoint, page):
    response = session.get(
        f"https://api.themoviedb.org/3/movie/{endpoint}",
        headers=TMDB_HEADERS,
        params={
            "api_key": TMDB_API_KEY,
            "language": "en-US",
            "page": page,
            "include_adult": "false",
            "region": "US",
        },
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json() or {}
    return payload.get("results", [])


def fetch_existing_candidates(title, year):
    params = {
        "select": "id,title,year,tmdb_id,description,poster_path,genre,source",
        "title": f"ilike.*{title}*",
        "limit": "20",
    }
    if year:
        params["year"] = f"eq.{year}"
    response = session.get(
        f"{REST_URL}/movies",
        headers=SUPABASE_HEADERS,
        params=params,
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def choose_existing_movie(tmdb_movie):
    title = (tmdb_movie.get("title") or "").strip()
    year = (tmdb_movie.get("release_date") or "")[:4] or None
    if not title:
        return None

    candidates = fetch_existing_candidates(title, year)
    normalized_title = normalize_title(title)

    exact_candidates = [
        candidate for candidate in candidates
        if normalize_title(candidate.get("title")) == normalized_title
        and (not year or str(candidate.get("year") or "") == year)
    ]

    if len(exact_candidates) == 1:
        return exact_candidates[0]

    if len(exact_candidates) > 1:
        return sorted(exact_candidates, key=lambda candidate: candidate.get("id"))[0]

    return None


def build_insert_payload(tmdb_movie):
    release_date = tmdb_movie.get("release_date") or ""
    year = release_date[:4] if release_date else None
    return {
        "title": tmdb_movie.get("title"),
        "description": tmdb_movie.get("overview") or None,
        "poster_path": tmdb_movie.get("poster_path") or None,
        "year": year,
        "genre": map_tmdb_genres(tmdb_movie.get("genre_ids")),
        "tmdb_id": tmdb_movie.get("id"),
        "rt_score": None,
        "source": "tmdb",
    }


def build_update_payload(existing_movie, insert_payload):
    update_payload = {}

    if not existing_movie.get("description") and insert_payload.get("description"):
        update_payload["description"] = insert_payload["description"]

    if not existing_movie.get("poster_path") and insert_payload.get("poster_path"):
        update_payload["poster_path"] = insert_payload["poster_path"]

    if not existing_movie.get("year") and insert_payload.get("year"):
        update_payload["year"] = insert_payload["year"]

    existing_genres = existing_movie.get("genre") or []
    if not existing_genres and insert_payload.get("genre"):
        update_payload["genre"] = insert_payload["genre"]

    if not existing_movie.get("tmdb_id") and insert_payload.get("tmdb_id"):
        update_payload["tmdb_id"] = insert_payload["tmdb_id"]

    if not existing_movie.get("source"):
        update_payload["source"] = "tmdb"

    return update_payload


def insert_movie(payload):
    if DRY_RUN:
        return True
    response = session.post(
        f"{REST_URL}/movies",
        headers={**SUPABASE_HEADERS, "Prefer": "return=representation"},
        data=json.dumps(payload),
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return True


def update_movie(movie_id, payload):
    if not payload:
        return False
    if DRY_RUN:
        return True
    response = session.patch(
        f"{REST_URL}/movies",
        headers=SUPABASE_HEADERS,
        params={"id": f"eq.{movie_id}"},
        data=json.dumps(payload),
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return True


def load_recent_tmdb_movies():
    movies_by_tmdb_id = {}
    for endpoint in TMDB_ENDPOINTS:
        for page in range(1, TMDB_PAGES + 1):
            results = fetch_tmdb_endpoint(endpoint, page)
            for movie in results:
                tmdb_id = movie.get("id")
                if not tmdb_id or tmdb_id in movies_by_tmdb_id:
                    continue
                movies_by_tmdb_id[tmdb_id] = movie
            if SLEEP_SECONDS:
                time.sleep(SLEEP_SECONDS)
    return list(movies_by_tmdb_id.values())


def main():
    tmdb_movies = load_recent_tmdb_movies()
    inserted = 0
    updated = 0
    skipped = 0

    print(f"Loaded {len(tmdb_movies)} TMDB movies from {', '.join(TMDB_ENDPOINTS)}.")

    for index, tmdb_movie in enumerate(tmdb_movies, start=1):
        payload = build_insert_payload(tmdb_movie)
        if not payload.get("title"):
            skipped += 1
            continue

        existing_movie = choose_existing_movie(tmdb_movie)
        if existing_movie:
            update_payload = build_update_payload(existing_movie, payload)
            if update_payload:
                update_movie(existing_movie["id"], update_payload)
                updated += 1
            else:
                skipped += 1
        else:
            insert_movie(payload)
            inserted += 1

        if index % 25 == 0:
            print(
                f"Processed {index}/{len(tmdb_movies)} | Inserted {inserted} | Updated {updated} | Skipped {skipped}",
                flush=True,
            )

        if SLEEP_SECONDS:
            time.sleep(SLEEP_SECONDS)

    print("Done.")
    print(f"Processed {len(tmdb_movies)} | Inserted {inserted} | Updated {updated} | Skipped {skipped}")


if __name__ == "__main__":
    try:
        main()
    except requests.HTTPError as exc:
        print(f"HTTP error: {exc}")
        sys.exit(1)

import { createClient } from "npm:@supabase/supabase-js@2";

type MovieRow = {
  id: number;
  title: string | null;
  year: string | number | null;
  tmdb_id: number | null;
  description: string | null;
  poster_path: string | null;
  genre: string[] | null;
  source: string | null;
};

type TmdbMovie = {
  id: number;
  title?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  release_date?: string | null;
  genre_ids?: number[] | null;
};

type SyncRequestBody = {
  dryRun?: boolean;
  pages?: number;
  endpoints?: string[];
  mode?: "recent" | "backfill" | "backfill-start" | "backfill-runner" | "backfill-status";
  years?: number[];
  startYear?: number;
  endYear?: number;
  pagesPerYear?: number;
  pageStart?: number;
  pageCount?: number;
  jobKey?: string;
  restart?: boolean;
};

type DiscoverRange = {
  label: string;
  releaseDateGte: string;
  releaseDateLte: string;
  startPage: number;
  maxPages: number;
};

type BackfillJobRow = {
  id: number;
  job_key: string;
  status: "active" | "complete" | "paused" | "failed";
  start_year: number;
  end_year: number;
  current_year: number;
  next_page: number;
  page_count: number;
  last_total_pages: number | null;
  last_run_at: string | null;
  completed_at: string | null;
  last_result: Record<string, unknown> | null;
};

const TMDB_APP_GENRE_MAP: Record<number, string> = {
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
};

const DEFAULT_ENDPOINTS = ["now_playing", "upcoming", "popular"];

function normalizeTitle(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mapTmdbGenres(genreIds: number[] | null | undefined) {
  return [...new Set((genreIds ?? []).map((genreId) => TMDB_APP_GENRE_MAP[genreId]).filter(Boolean))];
}

function parseYear(releaseDate: string | null | undefined) {
  return releaseDate?.slice(0, 4) || null;
}

function getNumericEnv(name: string, fallback: number) {
  const value = Number(Deno.env.get(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getBooleanEnv(name: string, fallback = false) {
  const value = Deno.env.get(name);
  if (!value) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function buildTmdbUrl(endpoint: string, page: number, apiKey: string) {
  const url = new URL(`https://api.themoviedb.org/3/movie/${endpoint}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");
  url.searchParams.set("page", String(page));
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("region", "US");
  return url;
}

function buildTmdbDiscoverUrl(range: DiscoverRange, page: number, apiKey: string) {
  const url = new URL("https://api.themoviedb.org/3/discover/movie");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");
  url.searchParams.set("page", String(page));
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("region", "US");
  url.searchParams.set("sort_by", "primary_release_date.desc");
  url.searchParams.set("primary_release_date.gte", range.releaseDateGte);
  url.searchParams.set("primary_release_date.lte", range.releaseDateLte);
  return url;
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url: URL, timeoutMs: number, maxRetries: number, backoffFactor: number) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < maxRetries) {
          throw new Error(`TMDB responded with ${response.status}`);
        }
        throw new Error(`TMDB request failed with ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= maxRetries) break;
      await sleep(backoffFactor * 1000 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("TMDB request failed");
}

async function fetchTmdbEndpoint(
  endpoint: string,
  page: number,
  apiKey: string,
  timeoutMs: number,
  maxRetries: number,
  backoffFactor: number,
) {
  const payload = await fetchJsonWithRetry(buildTmdbUrl(endpoint, page, apiKey), timeoutMs, maxRetries, backoffFactor);
  return Array.isArray(payload?.results) ? (payload.results as TmdbMovie[]) : [];
}

async function fetchTmdbDiscoverRange(
  range: DiscoverRange,
  apiKey: string,
  timeoutMs: number,
  maxRetries: number,
  backoffFactor: number,
) {
  const firstPayload = await fetchJsonWithRetry(
    buildTmdbDiscoverUrl(range, 1, apiKey),
    timeoutMs,
    maxRetries,
    backoffFactor,
  );
  const totalPages = Math.max(1, Number(firstPayload?.total_pages ?? 1));
  const cappedPages = Math.min(range.maxPages, totalPages);
  const firstResults = Array.isArray(firstPayload?.results) ? (firstPayload.results as TmdbMovie[]) : [];

  return {
    results: firstResults,
    totalPages: cappedPages,
  };
}

async function loadRecentTmdbMovies(
  apiKey: string,
  endpoints: string[],
  pages: number,
  sleepSeconds: number,
  timeoutMs: number,
  maxRetries: number,
  backoffFactor: number,
) {
  const moviesByTmdbId = new Map<number, TmdbMovie>();

  for (const endpoint of endpoints) {
    for (let page = 1; page <= pages; page += 1) {
      const results = await fetchTmdbEndpoint(endpoint, page, apiKey, timeoutMs, maxRetries, backoffFactor);
      for (const movie of results) {
        if (!movie?.id || moviesByTmdbId.has(movie.id)) continue;
        moviesByTmdbId.set(movie.id, movie);
      }
      await sleep(sleepSeconds * 1000);
    }
  }

  return [...moviesByTmdbId.values()];
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildBackfillRanges(body: SyncRequestBody, today: Date) {
  const currentYear = today.getUTCFullYear();
  const requestedYears = Array.isArray(body.years) && body.years.length > 0
    ? body.years
    : (() => {
      const startYear = Number(body.startYear);
      const endYear = Number(body.endYear);
      if (Number.isFinite(startYear) && Number.isFinite(endYear) && startYear <= endYear) {
        const years: number[] = [];
        for (let year = startYear; year <= endYear; year += 1) {
          years.push(year);
        }
        return years;
      }
      return [];
    })();

  const startPage = Number.isFinite(Number(body.pageStart)) && Number(body.pageStart) > 0
    ? Number(body.pageStart)
    : 1;

  const pagesPerYear = Number.isFinite(Number(body.pageCount)) && Number(body.pageCount) > 0
    ? Number(body.pageCount)
    : Number.isFinite(Number(body.pagesPerYear)) && Number(body.pagesPerYear) > 0
    ? Number(body.pagesPerYear)
    : 25;

  return requestedYears
    .map((year) => Number(year))
    .filter((year) => Number.isInteger(year) && year >= 1900 && year <= currentYear)
    .sort((left, right) => left - right)
    .map((year) => ({
      label: String(year),
      releaseDateGte: `${year}-01-01`,
      releaseDateLte: year === currentYear ? formatIsoDate(today) : `${year}-12-31`,
      startPage,
      maxPages: pagesPerYear,
    }));
}

function normalizeBackfillJobKey(body: SyncRequestBody) {
  if (body.jobKey?.trim()) {
    return body.jobKey.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  }

  const startYear = Number(body.startYear);
  const endYear = Number(body.endYear);
  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    return `backfill-${startYear}-${endYear}`;
  }

  return "backfill-movies";
}

function getBackfillYears(body: SyncRequestBody, today: Date) {
  const currentYear = today.getUTCFullYear();
  const years = Array.isArray(body.years) && body.years.length > 0
    ? body.years.map((year) => Number(year))
    : (() => {
      const startYear = Number(body.startYear);
      const endYear = Number(body.endYear);
      if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || startYear > endYear) {
        return [];
      }
      const values: number[] = [];
      for (let year = startYear; year <= endYear; year += 1) {
        values.push(year);
      }
      return values;
    })();

  return years
    .filter((year) => Number.isInteger(year) && year >= 1900 && year <= currentYear)
    .sort((left, right) => left - right);
}

async function loadBackfillTmdbMovies(
  apiKey: string,
  ranges: DiscoverRange[],
  sleepSeconds: number,
  timeoutMs: number,
  maxRetries: number,
  backoffFactor: number,
) {
  const moviesByTmdbId = new Map<number, TmdbMovie>();

  for (const range of ranges) {
    const firstPageNumber = range.startPage;
    const firstPagePayload = await fetchJsonWithRetry(
      buildTmdbDiscoverUrl(range, firstPageNumber, apiKey),
      timeoutMs,
      maxRetries,
      backoffFactor,
    );
    const totalPages = Math.max(1, Number(firstPagePayload?.total_pages ?? 1));
    const cappedLastPage = Math.min(totalPages, range.startPage + range.maxPages - 1);
    const firstResults = Array.isArray(firstPagePayload?.results) ? (firstPagePayload.results as TmdbMovie[]) : [];

    for (const movie of firstResults) {
      if (!movie?.id || moviesByTmdbId.has(movie.id)) continue;
      moviesByTmdbId.set(movie.id, movie);
    }

    await sleep(sleepSeconds * 1000);

    for (let page = firstPageNumber + 1; page <= cappedLastPage; page += 1) {
      const payload = await fetchJsonWithRetry(
        buildTmdbDiscoverUrl(range, page, apiKey),
        timeoutMs,
        maxRetries,
        backoffFactor,
      );
      const results = Array.isArray(payload?.results) ? (payload.results as TmdbMovie[]) : [];
      for (const movie of results) {
        if (!movie?.id || moviesByTmdbId.has(movie.id)) continue;
        moviesByTmdbId.set(movie.id, movie);
      }
      await sleep(sleepSeconds * 1000);
    }
  }

  return [...moviesByTmdbId.values()];
}

async function loadBackfillChunk(
  apiKey: string,
  range: DiscoverRange,
  sleepSeconds: number,
  timeoutMs: number,
  maxRetries: number,
  backoffFactor: number,
) {
  const moviesByTmdbId = new Map<number, TmdbMovie>();
  const firstPageNumber = range.startPage;
  const firstPagePayload = await fetchJsonWithRetry(
    buildTmdbDiscoverUrl(range, firstPageNumber, apiKey),
    timeoutMs,
    maxRetries,
    backoffFactor,
  );
  const totalPages = Math.max(1, Number(firstPagePayload?.total_pages ?? 1));
  const endPage = Math.min(totalPages, range.startPage + range.maxPages - 1);
  const firstResults = Array.isArray(firstPagePayload?.results) ? (firstPagePayload.results as TmdbMovie[]) : [];

  for (const movie of firstResults) {
    if (!movie?.id || moviesByTmdbId.has(movie.id)) continue;
    moviesByTmdbId.set(movie.id, movie);
  }

  await sleep(sleepSeconds * 1000);

  for (let page = firstPageNumber + 1; page <= endPage; page += 1) {
    const payload = await fetchJsonWithRetry(
      buildTmdbDiscoverUrl(range, page, apiKey),
      timeoutMs,
      maxRetries,
      backoffFactor,
    );
    const results = Array.isArray(payload?.results) ? (payload.results as TmdbMovie[]) : [];
    for (const movie of results) {
      if (!movie?.id || moviesByTmdbId.has(movie.id)) continue;
      moviesByTmdbId.set(movie.id, movie);
    }
    await sleep(sleepSeconds * 1000);
  }

  return {
    movies: [...moviesByTmdbId.values()],
    totalPages,
    startPage: firstPageNumber,
    endPage,
    range,
  };
}

async function fetchExistingCandidates(
  supabase: ReturnType<typeof createClient>,
  title: string,
  year: string | null,
) {
  let query = supabase
    .from("movies")
    .select("id,title,year,tmdb_id,description,poster_path,genre,source")
    .ilike("title", `%${title}%`)
    .limit(20);

  if (year) {
    query = query.eq("year", year);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MovieRow[];
}

async function chooseExistingMovie(
  supabase: ReturnType<typeof createClient>,
  tmdbMovie: TmdbMovie,
) {
  const title = tmdbMovie.title?.trim();
  const year = parseYear(tmdbMovie.release_date);
  if (!title) return null;

  const candidates = await fetchExistingCandidates(supabase, title, year);
  const normalizedTitle = normalizeTitle(title);
  const exactCandidates = candidates.filter(
    (candidate) =>
      normalizeTitle(candidate.title) === normalizedTitle &&
      (!year || String(candidate.year ?? "") === year),
  );

  if (exactCandidates.length === 0) return null;
  return [...exactCandidates].sort((left, right) => left.id - right.id)[0];
}

function buildInsertPayload(tmdbMovie: TmdbMovie) {
  return {
    title: tmdbMovie.title?.trim() || null,
    description: tmdbMovie.overview?.trim() || null,
    poster_path: tmdbMovie.poster_path || null,
    year: parseYear(tmdbMovie.release_date),
    genre: mapTmdbGenres(tmdbMovie.genre_ids),
    tmdb_id: tmdbMovie.id,
    rt_score: null,
    source: "tmdb",
  };
}

function buildUpdatePayload(existingMovie: MovieRow, insertPayload: ReturnType<typeof buildInsertPayload>) {
  const updatePayload: Record<string, unknown> = {};

  if (!existingMovie.description && insertPayload.description) {
    updatePayload.description = insertPayload.description;
  }

  if (!existingMovie.poster_path && insertPayload.poster_path) {
    updatePayload.poster_path = insertPayload.poster_path;
  }

  if (!existingMovie.year && insertPayload.year) {
    updatePayload.year = insertPayload.year;
  }

  if ((!existingMovie.genre || existingMovie.genre.length === 0) && insertPayload.genre.length > 0) {
    updatePayload.genre = insertPayload.genre;
  }

  if (!existingMovie.tmdb_id && insertPayload.tmdb_id) {
    updatePayload.tmdb_id = insertPayload.tmdb_id;
  }

  if (!existingMovie.source) {
    updatePayload.source = "tmdb";
  }

  return updatePayload;
}

function isAuthorized(request: Request, cronSecret: string) {
  const requestSecret = request.headers.get("x-cron-secret");
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return requestSecret === cronSecret || bearerToken === cronSecret;
}

async function getActiveBackfillJob(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("tmdb_backfill_jobs")
    .select("id,job_key,status,start_year,end_year,current_year,next_page,page_count,last_total_pages,last_run_at,completed_at,last_result")
    .eq("status", "active")
    .order("id", { ascending: true })
    .limit(1);

  if (error) throw error;
  return ((data ?? [])[0] ?? null) as BackfillJobRow | null;
}

async function getBackfillJobByKey(supabase: ReturnType<typeof createClient>, jobKey: string) {
  const { data, error } = await supabase
    .from("tmdb_backfill_jobs")
    .select("id,job_key,status,start_year,end_year,current_year,next_page,page_count,last_total_pages,last_run_at,completed_at,last_result")
    .eq("job_key", jobKey)
    .order("id", { ascending: false })
    .limit(1);

  if (error) throw error;
  return ((data ?? [])[0] ?? null) as BackfillJobRow | null;
}

async function upsertBackfillJob(
  supabase: ReturnType<typeof createClient>,
  body: SyncRequestBody,
  today: Date,
) {
  const years = getBackfillYears(body, today);
  if (years.length === 0) {
    throw new Error("Backfill start requires valid years or a valid startYear/endYear range");
  }

  const startPage = Number.isFinite(Number(body.pageStart)) && Number(body.pageStart) > 0 ? Number(body.pageStart) : 1;
  const pageCount = Number.isFinite(Number(body.pageCount)) && Number(body.pageCount) > 0
    ? Number(body.pageCount)
    : Number.isFinite(Number(body.pagesPerYear)) && Number(body.pagesPerYear) > 0
    ? Number(body.pagesPerYear)
    : 5;
  const jobKey = normalizeBackfillJobKey(body);
  const existing = await getBackfillJobByKey(supabase, jobKey);

  if (existing && body.restart !== true && existing.status === "active") {
    return existing;
  }

  const payload = {
    job_key: jobKey,
    status: "active",
    start_year: years[0],
    end_year: years[years.length - 1],
    current_year: years[0],
    next_page: startPage,
    page_count: pageCount,
    last_total_pages: null,
    last_run_at: null,
    completed_at: null,
    last_result: null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from("tmdb_backfill_jobs")
      .update(payload)
      .eq("id", existing.id)
      .select("id,job_key,status,start_year,end_year,current_year,next_page,page_count,last_total_pages,last_run_at,completed_at,last_result")
      .single();
    if (error) throw error;
    return data as BackfillJobRow;
  }

  const { data, error } = await supabase
    .from("tmdb_backfill_jobs")
    .insert(payload)
    .select("id,job_key,status,start_year,end_year,current_year,next_page,page_count,last_total_pages,last_run_at,completed_at,last_result")
    .single();
  if (error) throw error;
  return data as BackfillJobRow;
}

Deno.serve(async (request) => {
  if (!["GET", "POST"].includes(request.method)) {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const tmdbApiKey = Deno.env.get("TMDB_API_KEY");

  if (!cronSecret || !supabaseUrl || !serviceRoleKey || !tmdbApiKey) {
    return Response.json({ error: "Missing required function secrets" }, { status: 500 });
  }

  if (!isAuthorized(request, cronSecret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const timeoutMs = getNumericEnv("TIMEOUT_SECONDS", 60) * 1000;
  const maxRetries = getNumericEnv("MAX_RETRIES", 5);
  const backoffFactor = Number(Deno.env.get("BACKOFF_FACTOR") ?? "0.5");
  const sleepSeconds = Number(Deno.env.get("SLEEP_SECONDS") ?? "0.2");
  const defaultPages = getNumericEnv("TMDB_PAGES", 2);
  const defaultEndpoints = (Deno.env.get("TMDB_ENDPOINTS") ?? DEFAULT_ENDPOINTS.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const defaultDryRun = getBooleanEnv("DRY_RUN", false);

  let requestBody: SyncRequestBody = {};
  let overridePages = defaultPages;
  let overrideEndpoints = defaultEndpoints;
  let dryRun = defaultDryRun;
  let mode: NonNullable<SyncRequestBody["mode"]> = "recent";
  let backfillRanges: DiscoverRange[] = [];

  if (request.method === "POST") {
    try {
      requestBody = (await request.json()) as SyncRequestBody;
      if (requestBody.mode) {
        mode = requestBody.mode;
      }
      if (Number.isFinite(Number(requestBody?.pages)) && Number(requestBody.pages) > 0) {
        overridePages = Number(requestBody.pages);
      }
      if (Array.isArray(requestBody?.endpoints) && requestBody.endpoints.length > 0) {
        overrideEndpoints = requestBody.endpoints.map((item: string) => item.trim()).filter(Boolean);
      }
      if (typeof requestBody?.dryRun === "boolean") {
        dryRun = requestBody.dryRun;
      }
      if (mode === "backfill") {
        backfillRanges = buildBackfillRanges(requestBody, new Date());
      }
    } catch {
      // Empty or invalid JSON body falls back to env defaults.
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (mode === "backfill-start") {
      const job = await upsertBackfillJob(supabase, requestBody, new Date());
      return Response.json({ ok: true, mode, job });
    }

    if (mode === "backfill-status") {
      const jobKey = requestBody.jobKey?.trim();
      const job = jobKey
        ? await getBackfillJobByKey(supabase, jobKey)
        : await getActiveBackfillJob(supabase);
      return Response.json({ ok: true, mode, job });
    }

    if (mode === "backfill-runner") {
      const activeJob = await getActiveBackfillJob(supabase);
      if (!activeJob) {
        return Response.json({ ok: true, mode, status: "idle" });
      }

      const currentRange: DiscoverRange = {
        label: String(activeJob.current_year),
        releaseDateGte: `${activeJob.current_year}-01-01`,
        releaseDateLte: activeJob.current_year === new Date().getUTCFullYear()
          ? formatIsoDate(new Date())
          : `${activeJob.current_year}-12-31`,
        startPage: activeJob.next_page,
        maxPages: activeJob.page_count,
      };

      const chunk = await loadBackfillChunk(
        tmdbApiKey,
        currentRange,
        sleepSeconds,
        timeoutMs,
        maxRetries,
        backoffFactor,
      );

      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      for (const tmdbMovie of chunk.movies) {
        const insertPayload = buildInsertPayload(tmdbMovie);
        if (!insertPayload.title) {
          skipped += 1;
          continue;
        }

        const existingMovie = await chooseExistingMovie(supabase, tmdbMovie);
        if (existingMovie) {
          const updatePayload = buildUpdatePayload(existingMovie, insertPayload);
          if (Object.keys(updatePayload).length === 0) {
            skipped += 1;
            continue;
          }

          const { error } = await supabase.from("movies").update(updatePayload).eq("id", existingMovie.id);
          if (error) throw error;
          updated += 1;
          continue;
        }

        const { error } = await supabase.from("movies").insert(insertPayload);
        if (error) throw error;
        inserted += 1;
      }

      const nextYear = chunk.endPage >= chunk.totalPages ? activeJob.current_year + 1 : activeJob.current_year;
      const nextPage = chunk.endPage >= chunk.totalPages ? 1 : chunk.endPage + 1;
      const isComplete = chunk.endPage >= chunk.totalPages && activeJob.current_year >= activeJob.end_year;
      const lastResult = {
        processed: chunk.movies.length,
        inserted,
        updated,
        skipped,
        currentYear: activeJob.current_year,
        startPage: chunk.startPage,
        endPage: chunk.endPage,
        totalPages: chunk.totalPages,
      };

      const { data: updatedJob, error: updateJobError } = await supabase
        .from("tmdb_backfill_jobs")
        .update({
          status: isComplete ? "complete" : "active",
          current_year: isComplete ? activeJob.current_year : nextYear,
          next_page: isComplete ? nextPage : nextPage,
          last_total_pages: chunk.totalPages,
          last_run_at: new Date().toISOString(),
          completed_at: isComplete ? new Date().toISOString() : null,
          last_result: lastResult,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeJob.id)
        .select("id,job_key,status,start_year,end_year,current_year,next_page,page_count,last_total_pages,last_run_at,completed_at,last_result")
        .single();
      if (updateJobError) throw updateJobError;

      return Response.json({
        ok: true,
        mode,
        job: updatedJob,
        result: lastResult,
      });
    }

    if (mode === "backfill" && backfillRanges.length === 0) {
      return Response.json(
        { ok: false, error: "Backfill mode requires valid years or a valid startYear/endYear range" },
        { status: 400 },
      );
    }

    const tmdbMovies = mode === "backfill"
      ? await loadBackfillTmdbMovies(
        tmdbApiKey,
        backfillRanges,
        sleepSeconds,
        timeoutMs,
        maxRetries,
        backoffFactor,
      )
      : await loadRecentTmdbMovies(
        tmdbApiKey,
        overrideEndpoints,
        overridePages,
        sleepSeconds,
        timeoutMs,
        maxRetries,
        backoffFactor,
      );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const tmdbMovie of tmdbMovies) {
      const insertPayload = buildInsertPayload(tmdbMovie);
      if (!insertPayload.title) {
        skipped += 1;
        continue;
      }

      const existingMovie = await chooseExistingMovie(supabase, tmdbMovie);
      if (existingMovie) {
        const updatePayload = buildUpdatePayload(existingMovie, insertPayload);
        if (Object.keys(updatePayload).length === 0) {
          skipped += 1;
          continue;
        }

        if (!dryRun) {
          const { error } = await supabase.from("movies").update(updatePayload).eq("id", existingMovie.id);
          if (error) throw error;
        }
        updated += 1;
        continue;
      }

      if (!dryRun) {
        const { error } = await supabase.from("movies").insert(insertPayload);
        if (error) throw error;
      }
      inserted += 1;
    }

    return Response.json({
      ok: true,
      processed: tmdbMovies.length,
      inserted,
      updated,
      skipped,
      dryRun,
      mode,
      endpoints: overrideEndpoints,
      pages: overridePages,
      ranges: backfillRanges,
    });
  } catch (error) {
    console.error("sync-recent-movies failed", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});

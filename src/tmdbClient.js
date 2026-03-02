const API_KEY = import.meta.env.VITE_TMDB_API_KEY
const BASE_URL = 'https://api.themoviedb.org/3'
export const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500'
const TMDB_GENRE_NAMES = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
}

const TMDB_APP_GENRE_MAP = {
  28: 'Action',
  12: 'Adventure',
  35: 'Comedy',
  99: 'Documentary',
  14: 'Fantasy',
  27: 'Horror',
  10749: 'Romance',
  878: 'Sci-Fi',
  53: 'Mystery & thriller',
  80: 'Mystery & thriller',
  9648: 'Mystery & thriller',
}

if (!API_KEY) {
  console.error('Missing VITE_TMDB_API_KEY')
}

export function mapTmdbGenreIdsToAppGenres(genreIds = []) {
  return Array.from(new Set((genreIds || []).map((genreId) => TMDB_APP_GENRE_MAP[genreId]).filter(Boolean)))
}

export function mapTmdbGenreIdsToNames(genreIds = []) {
  return Array.from(new Set((genreIds || []).map((genreId) => TMDB_GENRE_NAMES[genreId]).filter(Boolean)))
}

export async function searchTmdb(query, { limit = 20 } = {}) {
  if (!query || !API_KEY) return [];
  try {
    const res = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`)
    const data = await res.json()
    return (data.results || []).slice(0, limit).map(mapTmdbToMovie)
  } catch (error) {
    console.error("TMDB Search Error:", error)
    return []
  }
}

export function mapTmdbToMovie(tmdbMovie) {
  return {
    title: tmdbMovie.title,
    poster_path: tmdbMovie.poster_path,
    tmdb_id: tmdbMovie.id,
    description: tmdbMovie.overview,
    rt_score: null,
    year: tmdbMovie.release_date ? tmdbMovie.release_date.split('-')[0] : null,
    genre: mapTmdbGenreIdsToAppGenres(tmdbMovie.genre_ids),
    tmdb_genres: mapTmdbGenreIdsToNames(tmdbMovie.genre_ids),
    source: 'tmdb',
  }
}

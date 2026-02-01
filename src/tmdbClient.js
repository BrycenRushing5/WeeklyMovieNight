const API_KEY = import.meta.env.VITE_TMDB_API_KEY
const BASE_URL = 'https://api.themoviedb.org/3'
export const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500'

if (!API_KEY) {
  console.error('Missing VITE_TMDB_API_KEY')
}

export async function searchTmdb(query) {
  if (!query) return [];
  try {
    const res = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}`)
    const data = await res.json()
    return (data.results || []).map(mapTmdbToMovie)
  } catch (error) {
    console.error("TMDB Search Error:", error)
    return []
  }
}

export function mapTmdbToMovie(tmdbMovie) {
  return {
    poster_path: tmdbMovie.poster_path,
    tmdb_id: tmdbMovie.id,
    description: tmdbMovie.overview,
    rt_score: tmdbMovie.vote_average ? Math.round(tmdbMovie.vote_average * 10) : null,
    year: tmdbMovie.release_date ? tmdbMovie.release_date.split('-')[0] : null,
  }
}

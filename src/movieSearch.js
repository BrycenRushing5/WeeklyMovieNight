import { supabase } from './supabaseClient'

const SEARCH_STOPWORDS = new Set(['a', 'an', 'and', 'for', 'of', 'the', 'to'])

export function normalizeMovieSearchText(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function tokenizeMovieSearchText(value) {
  return (value || '')
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function buildMovieSearchTokens(query) {
  const baseTokens = tokenizeMovieSearchText(query)
  const expandedTokens = new Set()

  baseTokens.forEach(token => {
    if (token.length < 2) return

    if (!SEARCH_STOPWORDS.has(token) || baseTokens.length === 1) {
      expandedTokens.add(token)
    }

    if (token.endsWith('ies') && token.length > 4) {
      expandedTokens.add(`${token.slice(0, -3)}y`)
    }

    if (token.endsWith('es') && token.length > 4) {
      expandedTokens.add(token.slice(0, -2))
    }

    if (token.endsWith('s') && token.length > 3) {
      expandedTokens.add(token.slice(0, -1))
    }
  })

  if (expandedTokens.size === 0) {
    baseTokens.forEach(token => expandedTokens.add(token))
  }

  return Array.from(expandedTokens)
}

function getMovieSearchTokenMatchCount(movie, tokens) {
  const normalizedTitle = normalizeMovieSearchText(movie?.title)
  return tokens.reduce((count, token) => count + (normalizedTitle.includes(token) ? 1 : 0), 0)
}

function getMovieSearchRank(movie, normalizedQuery) {
  const normalizedTitle = normalizeMovieSearchText(movie?.title)

  if (!normalizedQuery) return 3
  if (normalizedTitle === normalizedQuery) return 0
  if (normalizedTitle.startsWith(normalizedQuery)) return 1
  if (normalizedTitle.includes(normalizedQuery)) return 2
  return 3
}

export function mergeMovieSearchResults(query, ...resultSets) {
  const normalizedQuery = normalizeMovieSearchText(query)
  const searchTokens = buildMovieSearchTokens(query)
  const seen = new Set()
  const merged = []

  resultSets.flat().forEach(movie => {
    if (!movie?.id || seen.has(movie.id)) return
    seen.add(movie.id)
    merged.push(movie)
  })

  return merged.sort((left, right) => {
    const rankDiff = getMovieSearchRank(left, normalizedQuery) - getMovieSearchRank(right, normalizedQuery)
    if (rankDiff !== 0) return rankDiff

    const tokenMatchDiff = getMovieSearchTokenMatchCount(right, searchTokens) - getMovieSearchTokenMatchCount(left, searchTokens)
    if (tokenMatchDiff !== 0) return tokenMatchDiff

    const scoreDiff = (right?.rt_score ?? -1) - (left?.rt_score ?? -1)
    if (scoreDiff !== 0) return scoreDiff

    return (left?.title || '').localeCompare(right?.title || '')
  })
}

export async function searchMoviesByText(query, { limit = 20 } = {}) {
  const trimmedQuery = query.trim()
  const tokenVariants = buildMovieSearchTokens(trimmedQuery)
  const expandedLimit = Math.max(limit * 4, 60)

  if (!trimmedQuery) return []

  const [titleResponse, fuzzyResponse, tokenResponse] = await Promise.all([
    supabase
      .from('movies')
      .select('*')
      .ilike('title', `%${trimmedQuery}%`)
      .order('title', { ascending: true })
      .limit(expandedLimit),
    supabase.rpc('search_movies_fuzzy', { query: trimmedQuery, limit_count: expandedLimit }),
    tokenVariants.length > 0
      ? supabase
          .from('movies')
          .select('*')
          .or(tokenVariants.map(token => `title.ilike.%${token}%`).join(','))
          .order('title', { ascending: true })
          .limit(expandedLimit)
      : Promise.resolve({ data: [], error: null })
  ])

  if (titleResponse.error) {
    console.error('Error loading direct title matches:', titleResponse.error)
  }

  if (fuzzyResponse.error) {
    console.error('Error loading fuzzy title matches:', fuzzyResponse.error)
  }

  if (tokenResponse.error) {
    console.error('Error loading token title matches:', tokenResponse.error)
  }

  return mergeMovieSearchResults(
    trimmedQuery,
    titleResponse.data || [],
    fuzzyResponse.data || [],
    tokenResponse.data || []
  ).slice(0, limit)
}

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion' 
import { X, Search, Filter, Book, Ticket, Users, ChevronDown, ChevronUp, Minus, Plus, Check } from 'lucide-react' 
import { supabase } from './supabaseClient'

const DEFAULT_GENRES = ['Action', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Thriller', 'Family']
const COMMON_GENRES = ['Action', 'Adventure', 'Comedy', 'Documentary', 'Holiday', 'Horror', 'Romance', 'Sci-Fi', 'Mystery & thriller', 'Fantasy']

export default function SearchMovies({ eventId, groupId, onClose, onNominate, customAction, customRemoveAction }) {
  const isEventMode = !!eventId
  const isWatchlistMode = !isEventMode
  const [activeTab, setActiveTab] = useState('search') 
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [watchlistScope, setWatchlistScope] = useState('mine')
  const [genres, setGenres] = useState(DEFAULT_GENRES)
  const searchRequestId = useRef(0)
  const theaterSearchRequestId = useRef(0)
  const searchInputRef = useRef(null)
  const theaterSearchInputRef = useRef(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  
  // Lists
  const [myWatchlist, setMyWatchlist] = useState([])
  const [crewWatchlistEntries, setCrewWatchlistEntries] = useState([])
  const [crewOnlyMine, setCrewOnlyMine] = useState(false)
  const [crewExcludeMe, setCrewExcludeMe] = useState(false)
  const [collapsedCrewGroups, setCollapsedCrewGroups] = useState({})
  
  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [minScore, setMinScore] = useState(70)
  const [useScoreFilter, setUseScoreFilter] = useState(false)
  const [genreFilters, setGenreFilters] = useState([])
  const [showAllGenres, setShowAllGenres] = useState(false)
  const [showNominationGuide, setShowNominationGuide] = useState(true)

  // Write In
  const [isWritingIn, setIsWritingIn] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newGenres, setNewGenres] = useState([])
  const [newGenreOption, setNewGenreOption] = useState(DEFAULT_GENRES[0])
  const [newScore, setNewScore] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [theaterName, setTheaterName] = useState('')
  const [theaterNotes, setTheaterNotes] = useState('')
  const [theaterSearchTerm, setTheaterSearchTerm] = useState('')
  const [theaterResults, setTheaterResults] = useState([])
  const [theaterSelectedMovie, setTheaterSelectedMovie] = useState(null)
  const [theaterWriteInMode, setTheaterWriteInMode] = useState(false)
  const [theaterWriteInTitle, setTheaterWriteInTitle] = useState('')
  const [theaterWriteInGenres, setTheaterWriteInGenres] = useState([])
  const [theaterWriteInGenreOption, setTheaterWriteInGenreOption] = useState(DEFAULT_GENRES[0])
  const [theaterWriteInScore, setTheaterWriteInScore] = useState('')
  const [theaterWriteInDescription, setTheaterWriteInDescription] = useState('')
  const [writeInError, setWriteInError] = useState('')
  const [theaterError, setTheaterError] = useState('')

  const parsedWriteInScore = Number.parseInt(newScore, 10)
  const writeInScoreColor = Number.isFinite(parsedWriteInScore)
    ? parsedWriteInScore >= 80
      ? '#4ade80'
      : parsedWriteInScore >= 60
        ? '#facc15'
        : '#94a3b8'
    : '#94a3b8'
  const parsedTheaterWriteInScore = Number.parseInt(theaterWriteInScore, 10)
  const theaterWriteInScoreColor = Number.isFinite(parsedTheaterWriteInScore)
    ? parsedTheaterWriteInScore >= 80
      ? '#4ade80'
      : parsedTheaterWriteInScore >= 60
        ? '#facc15'
        : '#94a3b8'
    : '#94a3b8'

  useEffect(() => {
    if (activeTab === 'search' && !isWritingIn) {
        const delayDebounceFn = setTimeout(() => searchMovies(), 300)
        return () => clearTimeout(delayDebounceFn)
    }
    if (activeTab === 'watchlist' && watchlistScope === 'mine') fetchMyWatchlist()
    if (activeTab === 'watchlist' && watchlistScope === 'crew') fetchCrewWatchlists()
  }, [searchTerm, activeTab, watchlistScope, genreFilters, minScore, useScoreFilter, isWritingIn, eventId, groupId])

  useEffect(() => {
    if (isWatchlistMode) fetchMyWatchlist()
  }, [isWatchlistMode])

  useEffect(() => {
    let isMounted = true
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (isMounted) setCurrentUserId(user?.id || null)
    }
    loadUser()
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    let isMounted = true
    async function loadGenres() {
      const { data, error } = await supabase.rpc('get_unique_genres')
      if (error || !Array.isArray(data) || data.length === 0) return
      const cleaned = data.filter(Boolean)
      if (!isMounted || cleaned.length === 0) return
      setGenres(cleaned)
      setNewGenreOption(prev => (cleaned.includes(prev) ? prev : cleaned[0]))
      setTheaterWriteInGenreOption(prev => (cleaned.includes(prev) ? prev : cleaned[0]))
    }
    loadGenres()
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    const dismissed = localStorage.getItem('nominationGuideDismissed')
    setShowNominationGuide(dismissed !== 'true')
  }, [])

  useEffect(() => {
    if (activeTab !== 'theater') return
    const delayDebounceFn = setTimeout(() => searchTheaterMovies(), 300)
    return () => clearTimeout(delayDebounceFn)
  }, [activeTab, theaterSearchTerm])

  // 1. GLOBAL SEARCH
  async function searchMovies() {
    const requestId = ++searchRequestId.current
    let data = null
    if (searchTerm) {
      const { data: fuzzyData } = await supabase.rpc('search_movies_fuzzy', {
        query: searchTerm,
        limit_count: 20
      })
      data = fuzzyData
    } else {
      let query = supabase.from('movies').select()
      if (genreFilters.length > 0) query = query.overlaps('genre', genreFilters)
      if (useScoreFilter) query = query.or(`rt_score.gte.${minScore},rt_score.is.null`)
      query = query.limit(20)
      const { data: listData } = await query
      data = listData
    }
    if (requestId !== searchRequestId.current) return
    setResults(applyFilters(data || [], { skipSearchMatch: Boolean(searchTerm) }))
  }

  async function searchTheaterMovies() {
    const requestId = ++theaterSearchRequestId.current
    const trimmed = theaterSearchTerm.trim()
    if (!trimmed) {
      setTheaterResults([])
      return
    }
    const { data: fuzzyData } = await supabase.rpc('search_movies_fuzzy', {
      query: trimmed,
      limit_count: 12
    })
    if (requestId !== theaterSearchRequestId.current) return
    setTheaterResults(fuzzyData || [])
  }

  function handleSearchSubmit(e) {
    e.preventDefault()
    searchMovies()
    setShowFilters(false)
    searchInputRef.current?.blur()
  }

  function handleTheaterSearchSubmit(e) {
    e.preventDefault()
    searchTheaterMovies()
    theaterSearchInputRef.current?.blur()
  }

  // 2. MY WATCHLIST
  async function fetchMyWatchlist() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('user_wishlist').select('movie:movies (*)').eq('user_id', user.id)
    setMyWatchlist(data ? data.map(i => i.movie) : [])
  }

  // 3. CREW WATCHLISTS (New!)
  async function fetchCrewWatchlists() {
    if (!eventId && !groupId) return
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id

    let memberRows = []
    if (eventId) {
      const { data } = await supabase
        .from('event_attendees')
        .select('user_id, profiles(display_name, username)')
        .eq('event_id', eventId)
      memberRows = data || []
    } else {
      const { data } = await supabase
        .from('group_members')
        .select('user_id, profiles(display_name, username)')
        .eq('group_id', groupId)
      memberRows = data || []
    }

    const nameByUserId = memberRows.reduce((acc, member) => {
      const name = member.profiles?.display_name || member.profiles?.username || 'Movie Fan'
      acc[member.user_id] = name
      return acc
    }, {})

    const memberIds = memberRows.map(m => m.user_id)
    if (userId && !memberIds.includes(userId)) memberIds.push(userId)
    if (memberIds.length === 0) return setCrewWatchlistEntries([])

    const { data } = await supabase
      .from('user_wishlist')
      .select('movie:movies (*), user_id, profiles(display_name, username)')
      .in('user_id', memberIds)

    const movieMap = new Map()
    data?.forEach(item => {
      if (!item?.movie) return
      const existing = movieMap.get(item.movie.id) || { movie: item.movie, users: [], userIds: new Set() }
      const name = item.profiles?.display_name || item.profiles?.username || nameByUserId[item.user_id] || 'Movie Fan'
      if (!existing.userIds.has(item.user_id)) {
        existing.userIds.add(item.user_id)
        existing.users.push({ id: item.user_id, name })
      }
      movieMap.set(item.movie.id, existing)
    })

    setCrewWatchlistEntries(Array.from(movieMap.values()))
  }

  const sortedGenres = [...genres].sort((a, b) => a.localeCompare(b))
  const commonGenres = COMMON_GENRES.filter(g => genres.includes(g))
  const visibleGenres = showAllGenres ? sortedGenres : commonGenres

  // Helper: Apply Genre & Score Filters locally
  function applyFilters(list, options = {}) {
    const { skipSearchMatch = false } = options
    const normalizedTerm = normalizeText(searchTerm)
    return list.filter(m => {
        const score = m.rt_score === null ? 100 : m.rt_score // Treat null as 100
        const scorePass = !useScoreFilter || score >= minScore
        const movieGenres = Array.isArray(m.genre) ? m.genre : (m.genre ? [m.genre] : [])
        const genrePass = genreFilters.length === 0 || genreFilters.some(g => movieGenres.includes(g))
        const normalizedTitle = normalizeText(m.title)
        const searchPass = skipSearchMatch || !searchTerm || normalizedTitle.includes(normalizedTerm)
        return scorePass && genrePass && searchPass
    })
  }

  function normalizeText(value) {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  }
  
  const toggleGenreFilter = (genre) => {
    setGenreFilters(prev => prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre])
  }

  const clearGenreFilters = () => setGenreFilters([])

  const filteredCrewEntries = (() => {
    if (crewWatchlistEntries.length === 0) return []
    const filteredMovies = applyFilters(crewWatchlistEntries.map(entry => entry.movie))
    const allowedIds = new Set(filteredMovies.map(m => m.id))
    let filtered = crewWatchlistEntries.filter(entry => allowedIds.has(entry.movie.id))
    if (crewOnlyMine && currentUserId) {
      return filtered.filter(entry => entry.userIds.has(currentUserId))
    }
    if (crewExcludeMe && currentUserId) {
      filtered = filtered.map(entry => {
        const users = entry.users.filter(user => user.id !== currentUserId)
        const userIds = new Set(users.map(user => user.id))
        return { ...entry, users, userIds }
      }).filter(entry => entry.users.length > 0)
    }
    return filtered
  })()

  const crewGroups = (() => {
    if (filteredCrewEntries.length === 0) return []
    const grouped = new Map()
    filteredCrewEntries.forEach(entry => {
      const count = entry.users.length
      if (!grouped.has(count)) grouped.set(count, [])
      grouped.get(count).push(entry)
    })
    return Array.from(grouped.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([count, entries]) => ({ count, entries }))
  })()

  function normalizeWriteInScore(value) {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  async function createWriteInMovie({ title, description, genres, score }) {
    const { data: movie } = await supabase.from('movies').insert([{ 
        title, 
        description: description || 'User Write-in', 
        genre: genres, 
        rt_score: score,
        source: 'write in'
      }]).select().single()
    return movie
  }

  async function handleWriteIn() {
    const titleToUse = (newTitle || searchTerm).trim()
    if (!titleToUse) {
      setWriteInError('Please enter a movie title before saving.')
      return
    }
    setWriteInError('')
    const genresToUse = newGenres.length > 0 ? newGenres : [newGenreOption]
    const movie = await createWriteInMovie({
      title: titleToUse,
      description: newDescription.trim(),
      genres: genresToUse,
      score: normalizeWriteInScore(newScore)
    })

    if (movie) handleSelect(movie, false)
  }

  async function handleTheaterNomination() {
    const theaterDetails = {
      theater_name: theaterName.trim() || null,
      theater_notes: theaterNotes.trim() || null
    }
    if (theaterSelectedMovie) {
      handleSelect(theaterSelectedMovie, true, theaterDetails)
      return
    }
    if (!theaterWriteInMode) {
      setTheaterError('')
      handleSelect(null, true, theaterDetails)
      return
    }
    const titleToUse = theaterWriteInTitle.trim()
    if (!titleToUse) {
      setTheaterError('Please enter a movie title for the write-in.')
      return
    }
    setTheaterError('')
    const genresToUse = theaterWriteInGenres.length > 0 ? theaterWriteInGenres : [theaterWriteInGenreOption]
    const movie = await createWriteInMovie({
      title: titleToUse,
      description: theaterWriteInDescription.trim(),
      genres: genresToUse,
      score: normalizeWriteInScore(theaterWriteInScore)
    })

    if (movie) handleSelect(movie, true, theaterDetails)
  }

  const handleSelect = (movie, isTheater = false, theaterDetails = null) => {
    if (customAction) customAction(movie)
    else onNominate(movie, isTheater, theaterDetails) 
    onClose()
  }

  async function handleWatchlistToggle(movie) {
    const isInWatchlist = myWatchlist.some(item => item.id === movie.id)
    if (isInWatchlist) {
      if (customRemoveAction) {
        await customRemoveAction(movie)
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { error } = await supabase
          .from('user_wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('movie_id', movie.id)
        if (error) return
      }
      setMyWatchlist(prev => prev.filter(item => item.id !== movie.id))
      return
    }

    if (customAction) {
      await customAction(movie)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('user_wishlist').insert([{ user_id: user.id, movie_id: movie.id }])
      if (error) return
    }
    setMyWatchlist(prev => (prev.some(item => item.id === movie.id) ? prev : [movie, ...prev]))
  }

  const filteredMyWatchlist = applyFilters(myWatchlist)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} style={{ width: '100%', maxWidth: '500px', height: '85svh', background: '#1a1a2e', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '20px', paddingTop: 'max(20px, env(safe-area-inset-top))', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 40px rgba(0,0,0,0.5)' }}>
        
        <div className="flex-between" style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>{isEventMode ? 'Nominate' : 'Add to Watchlist'}</h2>
          <button
            onClick={onClose}
            style={{
              background: '#333',
              width: '36px',
              height: '36px',
              padding: 0,
              borderRadius: '999px',
              color: 'white',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* TABS */}
        {isEventMode && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '5px', justifyContent: 'center' }}>
              <TabButton active={activeTab === 'search'} onClick={() => {setActiveTab('search'); setIsWritingIn(false)}}><Search size={16}/> Search</TabButton>
              <TabButton active={activeTab === 'watchlist'} onClick={() => { setActiveTab('watchlist'); setIsWritingIn(false) }}><Book size={16}/> Watchlist</TabButton>
              <TabButton active={activeTab === 'theater'} onClick={() => { setActiveTab('theater'); setIsWritingIn(false) }}><Ticket size={16}/> Theatre</TabButton>
          </div>
        )}

        {isEventMode && showNominationGuide && (
          <div style={{ position: 'relative', marginBottom: '14px', paddingTop: '8px', paddingRight: '12px' }}>
            <div
              style={{
                padding: '14px',
                borderRadius: '14px',
                border: '1px dashed rgba(0,229,255,0.35)',
                background: 'rgba(0,229,255,0.06)',
                textAlign: 'center'
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '6px', color: '#e2e8f0' }}>
                Welcome to nominations!
              </div>
              <div className="text-sm" style={{ color: '#cbd5e1' }}>
                You have 3 different ways to nominate movies. You can search for the movie, check out what is on you or your friends watchlists, or suggest going to a theater! Once options are nominated, users can vote for the movies they want
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('nominationGuideDismissed', 'true')
                setShowNominationGuide(false)
              }}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                background: 'rgba(0,229,255,0.28)',
                color: '#00E5FF',
                borderRadius: '999px',
                padding: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 16px rgba(0,229,255,0.2)'
              }}
              aria-label="Minimize nominations guide"
              title="Dismiss"
            >
              <Minus size={14} />
            </button>
          </div>
        )}

        {/* FILTERS (Shared across lists) */}
        {activeTab !== 'theater' && !isWritingIn && (
            <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                <form className="flex-between" onSubmit={handleSearchSubmit}>
                    <div style={{display:'flex', gap:'10px', alignItems:'center', flex: 1}}>
                        <Search size={16} color="#888"/>
                        <input
                          ref={searchInputRef}
                          type="text"
                          enterKeyHint="search"
                          placeholder="Search for movie..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          style={{background:'transparent', border:'none', padding:0, height:'auto', width: '100%'}}
                        />
                        {searchTerm && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchTerm('')
                              searchInputRef.current?.focus()
                            }}
                            style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#cbd5e1', padding: '4px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            aria-label="Clear search"
                          >
                            <X size={14} />
                          </button>
                        )}
                    </div>
                    <button type="button" onClick={() => setShowFilters(!showFilters)} style={{ background: 'none', padding: '4px', marginLeft: '6px', display: 'inline-flex', alignItems: 'center' }}>
                      <Filter size={16} color={showFilters ? '#00E5FF' : '#666'} />
                    </button>
                </form>
                {showFilters && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #333' }}>
                         <div style={{ marginBottom: '10px' }}>
                            <div className="flex-gap" style={{ flexWrap: 'wrap' }}>
                              {visibleGenres.map(g => (
                                <button
                                  key={g}
                                  onClick={() => toggleGenreFilter(g)}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: '999px',
                                    border: '1px solid #333',
                                    background: genreFilters.includes(g) ? '#00E5FF' : 'rgba(255,255,255,0.08)',
                                    color: genreFilters.includes(g) ? 'black' : 'white',
                                    fontSize: '0.75rem',
                                    fontWeight: 600
                                  }}
                                >
                                  {g}
                                </button>
                              ))}
                            </div>
                            {genres.length > 8 && (
                              <button
                                onClick={() => setShowAllGenres(prev => !prev)}
                                style={{
                                  marginTop: '8px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#9ca3af',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                {showAllGenres ? 'See less' : 'See more'} {showAllGenres ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            )}
                            {genreFilters.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                {genreFilters.map(g => (
                                  <button
                                    key={g}
                                    onClick={() => toggleGenreFilter(g)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '4px 8px',
                                      borderRadius: '999px',
                                      border: '1px solid rgba(0,229,255,0.4)',
                                      background: 'rgba(0,229,255,0.12)',
                                      color: '#00E5FF',
                                      fontSize: '0.75rem'
                                    }}
                                  >
                                    {g}
                                    <X size={12} />
                                  </button>
                                ))}
                                <button
                                  onClick={clearGenreFilters}
                                  style={{ padding: '4px 8px', borderRadius: '999px', border: '1px solid #333', background: 'transparent', color: '#9ca3af', fontSize: '0.75rem' }}
                                >
                                  Clear
                                </button>
                              </div>
                            )}
                         </div>
                         <div className="flex-between">
                            <span className="text-sm">Minimum Rotten Tomato Score</span>
                            <input className="toggle" type="checkbox" checked={useScoreFilter} onChange={(e) => setUseScoreFilter(e.target.checked)} />
                         </div>
                         {useScoreFilter && (
                           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                             <input type="range" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} style={{ flex: 1 }} />
                             <span className="text-sm" style={{ minWidth: '48px', textAlign: 'right' }}>{minScore}%</span>
                           </div>
                         )}
                    </div>
                )}
            </div>
        )}

        {/* WATCHLIST SUB-TABS */}
        {activeTab === 'watchlist' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setWatchlistScope('mine')}
                style={{ flex: 1, padding: '10px', borderRadius: '12px', background: watchlistScope === 'mine' ? '#00E5FF' : 'rgba(255,255,255,0.1)', color: watchlistScope === 'mine' ? 'black' : 'white', fontWeight: 700 }}
              >
                My Watchlist
              </button>
              <button
                onClick={() => setWatchlistScope('crew')}
                style={{ flex: 1, padding: '10px', borderRadius: '12px', background: watchlistScope === 'crew' ? '#00E5FF' : 'rgba(255,255,255,0.1)', color: watchlistScope === 'crew' ? 'black' : 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Users size={16} /> Crew's Watchlist
              </button>
            </div>
            {watchlistScope === 'crew' && (
              <div className="flex-between" style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '12px', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input className="toggle" type="checkbox" checked={crewOnlyMine} onChange={(e) => setCrewOnlyMine(e.target.checked)} />
                  <span className="text-sm">Only include my watchlist</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input className="toggle" type="checkbox" checked={crewExcludeMe} onChange={(e) => setCrewExcludeMe(e.target.checked)} />
                  <span className="text-sm">Exclude me</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LIST RENDERING */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px', scrollbarGutter: 'stable' }}>
            {activeTab === 'search' && !isWritingIn && results.map(m => (
              <MovieRow
                key={m.id}
                movie={m}
                onSelect={isEventMode ? () => handleSelect(m) : undefined}
                showWatchlistAction={isWatchlistMode}
                isInWatchlist={myWatchlist.some(item => item.id === m.id)}
                onToggleWatchlist={handleWatchlistToggle}
              />
            ))}
            {activeTab === 'watchlist' && watchlistScope === 'mine' && filteredMyWatchlist.map(m => <MovieRow key={m.id} movie={m} onSelect={() => handleSelect(m)} />)}
            {activeTab === 'watchlist' && watchlistScope === 'crew' && crewGroups.map(group => (
              <div key={group.count} style={{ marginBottom: '16px' }}>
                <button
                  onClick={() => setCollapsedCrewGroups(prev => ({ ...prev, [group.count]: !prev[group.count] }))}
                  style={{ width: '100%', background: 'none', border: 'none', color: '#00E5FF', marginBottom: '10px', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {collapsedCrewGroups[group.count] ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  <span className="text-sm" style={{ letterSpacing: '1px' }}>
                    In {group.count} member{group.count === 1 ? '' : 's'} watchlists
                  </span>
                </button>
                {!collapsedCrewGroups[group.count] && group.entries.map(entry => (
                  <CrewWatchlistRow key={entry.movie.id} entry={entry} onSelect={() => handleSelect(entry.movie)} />
                ))}
              </div>
            ))}
            
            {/* Empty States */}
            {activeTab === 'watchlist' && watchlistScope === 'crew' && filteredCrewEntries.length === 0 && (
              <p className="text-sm" style={{textAlign:'center'}}>
                {crewOnlyMine ? 'Nothing from your watchlist yet.' : 'No watchlists found for this event.'}
              </p>
            )}
            
            {/* Write In Form */}
            {isWritingIn && (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div className="flex-gap" style={{ alignItems: 'center' }}>
                      <input
                        placeholder="Movie Title"
                        value={newTitle || searchTerm}
                        onChange={(e) => setNewTitle(e.target.value)}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '4px 8px', border: `1px solid ${writeInScoreColor}`, color: writeInScoreColor, height: '32px' }}>
                        <span role="img" aria-label="tomato" style={{ fontSize: '1.1rem' }}>🍅</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={newScore}
                          onChange={(e) => setNewScore(e.target.value.replace(/[^0-9]/g, ''))}
                          style={{ width: '24px', background: 'transparent', border: 'none', color: writeInScoreColor, textAlign: 'center', padding: 0 }}
                        />
                        <span style={{ fontWeight: 700 }}>%</span>
                      </div>
                    </div>
                    <textarea
                      placeholder="Write a description for the movie here!"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      style={{ minHeight: '90px', resize: 'none' }}
                    />
                    {writeInError && (
                      <div className="glass-panel" style={{ border: '1px solid rgba(255,0,85,0.35)', background: 'rgba(255,0,85,0.12)', color: '#ffd1dc', textAlign: 'center' }}>
                        {writeInError}
                      </div>
                    )}
                    <div className="flex-gap" style={{ alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="text-sm" style={{ color: '#9ca3af' }}>Add what genres you think it hits!</div>
                        <div className="flex-gap">
                          <select value={newGenreOption} onChange={(e) => setNewGenreOption(e.target.value)} style={{ flex: 1, height: '52px', paddingRight: '64px' }}>
                            {genres.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                          <button
                            onClick={() => setNewGenres(prev => prev.includes(newGenreOption) ? prev : [...prev, newGenreOption])}
                            style={{ height: '36px', alignSelf: 'center', padding: '0 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 }}
                          >
                            Add
                          </button>
                        </div>
                        {newGenres.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {newGenres.map(g => (
                              <button
                                key={g}
                                onClick={() => setNewGenres(prev => prev.filter(item => item !== g))}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 10px',
                                  borderRadius: '999px',
                                  border: '1px solid rgba(0,229,255,0.4)',
                                  background: 'rgba(0,229,255,0.12)',
                                  color: '#00E5FF',
                                  fontSize: '0.75rem'
                                }}
                              >
                                {g}
                                <X size={12} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleWriteIn()} style={{ background: '#00E5FF', color: 'black', padding: '15px', borderRadius: '12px' }}>Save & Select</button>
                    <button onClick={() => { setIsWritingIn(false); setActiveTab('search') }} className="text-sm" style={{background:'none'}}>Cancel</button>
                 </div>
            )}

            {/* Theater Form */}
            {activeTab === 'theater' && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <Ticket size={48} color="gold" style={{marginBottom:'10px'}}/>
                    <h3 style={{color:'gold'}}>Let's Go Out</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                      <input placeholder="Theater (Optional)" value={theaterName} onChange={(e) => setTheaterName(e.target.value)} />
                      <textarea placeholder="Trip Notes (Optional)" value={theaterNotes} onChange={(e) => setTheaterNotes(e.target.value)} style={{ minHeight: '90px', resize: 'none' }} />
                    </div>

                    <div style={{ marginTop: '18px', textAlign: 'left' }}>
                      <div className="text-sm" style={{ color: '#9ca3af', marginBottom: '8px' }}>Search for your movie</div>
                      <form onSubmit={handleTheaterSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', padding: '8px 10px', borderRadius: '12px' }}>
                        <Search size={16} color="#9ca3af" />
                        <input
                          ref={theaterSearchInputRef}
                          type="text"
                          enterKeyHint="search"
                          placeholder="Search movies..."
                          value={theaterSearchTerm}
                          onChange={(e) => setTheaterSearchTerm(e.target.value)}
                          style={{ background: 'transparent', border: 'none', color: 'white', width: '100%' }}
                        />
                        {theaterSearchTerm && (
                          <button
                            type="button"
                            onClick={() => {
                              setTheaterSearchTerm('')
                              setTheaterResults([])
                              theaterSearchInputRef.current?.focus()
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#9ca3af', padding: 0 }}
                            aria-label="Clear search"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </form>
                      {theaterResults.length > 0 && (
                        <div style={{ marginTop: '12px' }}>
                          {theaterResults.map(m => (
                            <MovieRow
                              key={m.id}
                              movie={m}
                              onSelect={() => {
                                setTheaterSelectedMovie(m)
                                setTheaterWriteInMode(false)
                                setTheaterSearchTerm('')
                                setTheaterResults([])
                                setTheaterError('')
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {theaterSelectedMovie && (
                        <div className="glass-panel" style={{ marginTop: '12px', padding: '12px', borderRadius: '12px', textAlign: 'left' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                            <div style={{ fontWeight: 700 }}>{theaterSelectedMovie.title}</div>
                            <button
                              type="button"
                              onClick={() => setTheaterSelectedMovie(null)}
                              style={{ background: 'transparent', border: 'none', color: '#9ca3af', display: 'inline-flex' }}
                              aria-label="Clear selected movie"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <div className="text-sm" style={{ color: '#9ca3af', marginTop: '6px' }}>
                            Selected movie for this theater trip.
                          </div>
                        </div>
                      )}
                    </div>

                    {!theaterWriteInMode && (
                      <div style={{ marginTop: '18px', textAlign: 'left' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setTheaterWriteInMode(true)
                            setTheaterWriteInTitle((current) => (current || theaterSearchTerm).trim())
                            setTheaterSearchTerm('')
                            setTheaterResults([])
                            setTheaterSelectedMovie(null)
                            setTheaterError('')
                          }}
                          style={{ background: 'transparent', border: '1px dashed rgba(255,215,0,0.5)', color: 'gold', padding: '10px 12px', borderRadius: '12px', width: '100%' }}
                        >
                          Can’t find it? Write in a movie
                        </button>
                      </div>
                    )}

                    {theaterWriteInMode && (
                      <div style={{ marginTop: '16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="flex-gap" style={{ alignItems: 'center' }}>
                          <input
                            placeholder="Movie Title"
                            value={theaterWriteInTitle}
                            onChange={(e) => setTheaterWriteInTitle(e.target.value)}
                            style={{ flex: 1, minWidth: 0 }}
                          />
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '4px 8px', border: `1px solid ${theaterWriteInScoreColor}`, color: theaterWriteInScoreColor, height: '32px' }}>
                            <span role="img" aria-label="tomato" style={{ fontSize: '1.1rem' }}>🍅</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={theaterWriteInScore}
                              onChange={(e) => setTheaterWriteInScore(e.target.value.replace(/[^0-9]/g, ''))}
                              style={{ width: '24px', background: 'transparent', border: 'none', color: theaterWriteInScoreColor, textAlign: 'center', padding: 0 }}
                            />
                            <span style={{ fontWeight: 700 }}>%</span>
                          </div>
                        </div>
                        <textarea
                          placeholder="Write a description for the movie here!"
                          value={theaterWriteInDescription}
                          onChange={(e) => setTheaterWriteInDescription(e.target.value)}
                          style={{ minHeight: '90px', resize: 'none' }}
                        />
                        <div className="text-sm" style={{ color: '#9ca3af' }}>Add what genres you think it hits!</div>
                        <div className="flex-gap">
                          <select value={theaterWriteInGenreOption} onChange={(e) => setTheaterWriteInGenreOption(e.target.value)} style={{ flex: 1, height: '52px', paddingRight: '64px' }}>
                            {genres.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                          <button
                            onClick={() => setTheaterWriteInGenres(prev => prev.includes(theaterWriteInGenreOption) ? prev : [...prev, theaterWriteInGenreOption])}
                            style={{ height: '36px', alignSelf: 'center', padding: '0 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 }}
                          >
                            Add
                          </button>
                        </div>
                        {theaterWriteInGenres.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {theaterWriteInGenres.map(g => (
                              <button
                                key={g}
                                onClick={() => setTheaterWriteInGenres(prev => prev.filter(item => item !== g))}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 10px',
                                  borderRadius: '999px',
                                  border: '1px solid rgba(0,229,255,0.4)',
                                  background: 'rgba(0,229,255,0.12)',
                                  color: '#00E5FF',
                                  fontSize: '0.75rem'
                                }}
                              >
                                {g}
                                <X size={12} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {theaterError && (
                      <div className="glass-panel" style={{ marginTop: '14px', border: '1px solid rgba(255,0,85,0.35)', background: 'rgba(255,0,85,0.12)', color: '#ffd1dc', textAlign: 'center' }}>
                        {theaterError}
                      </div>
                    )}

                    <button onClick={handleTheaterNomination} style={{ background: 'gold', color: 'black', width: '100%', padding: '15px', borderRadius: '12px', marginTop: '15px' }}>Nominate Trip</button>
                </div>
            )}
        </div>

        {activeTab === 'search' && !isWritingIn && (
          <button
            onClick={() => {
              setActiveTab('search')
              setIsWritingIn(true)
            }}
            style={{ width: '100%', marginTop: '12px', background: '#00E5FF', color: 'black', padding: '12px', borderRadius: '12px', fontWeight: 700 }}
          >
            + Write In Movie
          </button>
        )}
      </motion.div>
    </div>
  )
}

function TabButton({ active, children, onClick }) {
    return <button onClick={onClick} style={{ padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', background: active ? 'white' : 'rgba(255,255,255,0.1)', color: active ? 'black' : 'white', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>{children}</button>
}

function MovieRow({ movie, onSelect, showWatchlistAction = false, isInWatchlist = false, onToggleWatchlist }) {
    const description = movie.description?.trim()
    const scoreColor = movie.rt_score >= 80 ? '#4ade80' : movie.rt_score >= 60 ? '#facc15' : '#94a3b8'
    const yearLabel = movie.year ? ` (${movie.year})` : ''
    const isClickable = typeof onSelect === 'function'
    return (
      <div onClick={isClickable ? onSelect : undefined} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', marginBottom: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', cursor: isClickable ? 'pointer' : 'default', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '600' }}>
            {movie.title}
            {movie.year ? (
              <span className="text-sm" style={{ color: '#94a3b8', marginLeft: '6px' }}>{yearLabel}</span>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            {movie.rt_score !== null && movie.rt_score !== undefined && (
              <span
                style={{
                  border: `1px solid ${scoreColor}`,
                  color: scoreColor,
                  padding: '4px 8px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              >
                🍅 {movie.rt_score}%
              </span>
            )}
            {(movie.rt_score !== null && movie.rt_score !== undefined) && (
              <span className="text-sm" style={{ color: '#64748b' }}>|</span>
            )}
            <div className="text-sm">{movie.genre?.join(', ')}</div>
          </div>
          {description && (
            <div className="text-sm" style={{ color: '#9ca3af', marginTop: '6px' }}>
              {description}
            </div>
          )}
        </div>
        {showWatchlistAction && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleWatchlist?.(movie)
            }}
            style={{
              border: `1px solid ${isInWatchlist ? 'rgba(0,229,255,0.45)' : 'rgba(255,255,255,0.35)'}`,
              background: isInWatchlist ? 'rgba(0,229,255,0.18)' : 'rgba(255,255,255,0.08)',
              color: isInWatchlist ? '#00E5FF' : '#ffffff',
              width: '34px',
              height: '34px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
            aria-pressed={isInWatchlist}
            aria-label={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isInWatchlist ? 'check' : 'plus'}
                initial={{ scale: 0.6, rotate: -90, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.6, rotate: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{ display: 'flex' }}
              >
                {isInWatchlist ? <Check size={16} /> : <Plus size={16} />}
              </motion.span>
            </AnimatePresence>
          </button>
        )}
      </div>
    )
}

function CrewWatchlistRow({ entry, onSelect }) {
    const { movie, users } = entry
    const description = movie.description?.trim()
    const scoreColor = movie.rt_score >= 80 ? '#4ade80' : movie.rt_score >= 60 ? '#facc15' : '#94a3b8'
    const names = users.map(u => u.name)
    const displayNames = names.length > 4 ? `${names.slice(0, 4).join(', ')} +${names.length - 4} more` : names.join(', ')
    return (
      <div onClick={onSelect} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', marginBottom: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', cursor: 'pointer', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '600' }}>{movie.title}</div>
          <div className="text-sm">{movie.genre?.join(', ')}</div>
          {description && (
            <div className="text-sm" style={{ color: '#9ca3af', marginTop: '6px' }}>
              {description}
            </div>
          )}
          {displayNames && (
            <div className="text-sm" style={{ color: '#cbd5e1', marginTop: '6px' }}>
              On: {displayNames}
            </div>
          )}
        </div>
        {movie.rt_score !== null && movie.rt_score !== undefined && (
          <span
            style={{
              border: `1px solid ${scoreColor}`,
              color: scoreColor,
              padding: '4px 8px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            🍅 {movie.rt_score}%
          </span>
        )}
      </div>
    )
}

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion' 
import { X, Search, Filter, Book, Ticket, Users, ChevronDown, ChevronUp, Minus, Plus, Check } from 'lucide-react' 
import { supabase } from './supabaseClient'
import { POSTER_BASE_URL } from './tmdbClient'

const DEFAULT_GENRES = ['Action', 'Adventure', 'Comedy', 'Documentary', 'Holiday', 'Horror', 'Romance', 'Sci-Fi', 'Mystery & thriller', 'Fantasy']
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
    const resolvedDetails = theaterDetails || (isTheater ? {
      theater_name: theaterName.trim() || null,
      theater_notes: theaterNotes.trim() || null
    } : null)
    if (customAction) customAction(movie)
    else onNominate(movie, isTheater, resolvedDetails, isTheater ? 'theater' : null) 
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm">
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-lg h-[85svh] bg-slate-900 border-t border-white/10 rounded-t-3xl p-5 pt-[max(20px,env(safe-area-inset-top))] flex flex-col shadow-2xl">
        
        <div className="flex justify-between items-center mb-5">
          <h2 className="m-0 text-xl font-bold">{isEventMode ? 'Nominate' : 'Add to Watchlist'}</h2>
          <button
            onClick={onClose}
            className="bg-slate-700 w-9 h-9 p-0 rounded-full text-white inline-flex items-center justify-center shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* TABS */}
        {isEventMode && (
          <div className="flex gap-2.5 mb-4 overflow-x-auto pb-1.5 justify-center">
              <TabButton active={activeTab === 'search'} onClick={() => {setActiveTab('search'); setIsWritingIn(false)}}><Search size={16}/> Search</TabButton>
              <TabButton active={activeTab === 'watchlist'} onClick={() => { setActiveTab('watchlist'); setIsWritingIn(false) }}><Book size={16}/> Watchlist</TabButton>
              <TabButton active={activeTab === 'theater'} onClick={() => { setActiveTab('theater'); setIsWritingIn(false) }}><Ticket size={16}/> Theatre</TabButton>
          </div>
        )}

        {isEventMode && showNominationGuide && (
          <div className="relative mb-3.5 pt-2 pr-3">
            <div
              className="p-3.5 rounded-2xl border-dashed border border-accent/40 bg-accent/10 text-center"
            >
              <div className="font-bold mb-1.5 text-slate-200">
                Welcome to nominations!
              </div>
              <div className="text-sm text-slate-300">
                You have 3 different ways to nominate movies. You can search for the movie, check out what is on you or your friends watchlists, or suggest going to a theater! Once options are nominated, users can vote for the movies they want
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('nominationGuideDismissed', 'true')
                setShowNominationGuide(false)
              }}
              className="absolute top-0 right-0 bg-accent/30 text-accent rounded-full p-1.5 inline-flex items-center justify-center shadow-lg shadow-accent/20"
              aria-label="Minimize nominations guide"
              title="Dismiss"
            >
              <Minus size={14} />
            </button>
          </div>
        )}

        {/* FILTERS (Shared across lists) */}
        {activeTab !== 'theater' && !isWritingIn && (
            <div className="mb-4 p-2.5 bg-white/5 rounded-lg">
                <form className="flex justify-between items-center" onSubmit={handleSearchSubmit}>
                    <div className="flex gap-2.5 items-center flex-1">
                        <Search size={16} className="text-slate-400"/>
                        <input
                          ref={searchInputRef}
                          type="text"
                          enterKeyHint="search"
                          placeholder="Search for movie..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="bg-transparent border-none p-0 h-auto w-full text-white"
                        />
                        {searchTerm && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchTerm('')
                              searchInputRef.current?.focus()
                            }}
                            className="bg-white/10 border-none text-slate-300 p-1 rounded-full inline-flex items-center justify-center"
                            aria-label="Clear search"
                          >
                            <X size={14} />
                          </button>
                        )}
                    </div>
                    <button type="button" onClick={() => setShowFilters(!showFilters)} className="bg-none p-1 ml-1.5 inline-flex items-center">
                      <Filter size={16} className={showFilters ? 'text-accent' : 'text-slate-500'} />
                    </button>
                </form>
                {showFilters && (
                    <div className="mt-2.5 pt-2.5 border-t border-white/10">
                         <div className="mb-2.5">
                            <div className="flex gap-1.5 flex-wrap">
                              {visibleGenres.map(g => (
                                <button
                                  key={g}
                                  onClick={() => toggleGenreFilter(g)}
                                  className={`px-2.5 py-1.5 rounded-full border text-xs font-semibold ${genreFilters.includes(g) ? 'bg-accent text-black border-transparent' : 'bg-white/10 border-white/10'}`}
                                >
                                  {g}
                                </button>
                              ))}
                            </div>
                            {genres.length > 8 && (
                              <button
                                onClick={() => setShowAllGenres(prev => !prev)}
                                className="mt-2 bg-transparent border-none text-slate-400 text-xs flex items-center gap-1.5"
                              >
                                {showAllGenres ? 'See less' : 'See more'} {showAllGenres ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            )}
                            {genreFilters.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {genreFilters.map(g => (
                                  <button
                                    key={g}
                                    onClick={() => toggleGenreFilter(g)}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-accent/40 bg-accent/20 text-accent text-xs"
                                  >
                                    {g}
                                    <X size={12} />
                                  </button>
                                ))}
                                <button
                                  onClick={clearGenreFilters}
                                  className="px-2 py-1 rounded-full border border-white/20 bg-transparent text-slate-400 text-xs"
                                >
                                  Clear
                                </button>
                              </div>
                            )}
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-sm">Minimum Rotten Tomato Score</span>
                            <input className="toggle" type="checkbox" checked={useScoreFilter} onChange={(e) => setUseScoreFilter(e.target.checked)} />
                         </div>
                         {useScoreFilter && (
                           <div className="flex items-center gap-2.5">
                             <input type="range" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="flex-1" />
                             <span className="text-sm min-w-[48px] text-right">{minScore}%</span>
                           </div>
                         )}
                    </div>
                )}
            </div>
        )}

        {/* WATCHLIST SUB-TABS */}
        {activeTab === 'watchlist' && (
          <div className="flex flex-col gap-2.5 mb-3">
            <div className="flex gap-2.5">
              <button
                onClick={() => setWatchlistScope('mine')}
                className={`flex-1 p-2.5 rounded-lg font-bold ${watchlistScope === 'mine' ? 'bg-accent text-black' : 'bg-white/10 text-white'}`}
              >
                My Watchlist
              </button>
              <button
                onClick={() => setWatchlistScope('crew')}
                className={`flex-1 p-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 ${watchlistScope === 'crew' ? 'bg-accent text-black' : 'bg-white/10 text-white'}`}
              >
                <Users size={16} /> Crew's Watchlist
              </button>
            </div>
            {watchlistScope === 'crew' && (
              <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg gap-3">
                <div className="flex items-center gap-1.5">
                  <input className="toggle" type="checkbox" checked={crewOnlyMine} onChange={(e) => setCrewOnlyMine(e.target.checked)} />
                  <span className="text-sm">Only include my watchlist</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input className="toggle" type="checkbox" checked={crewExcludeMe} onChange={(e) => setCrewExcludeMe(e.target.checked)} />
                  <span className="text-sm">Exclude me</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LIST RENDERING */}
        <div className="flex-1 overflow-y-auto pr-3" style={{ scrollbarGutter: 'stable' }}>
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
              <div key={group.count} className="mb-4">
                <button
                  onClick={() => setCollapsedCrewGroups(prev => ({ ...prev, [group.count]: !prev[group.count] }))}
                  className="w-full bg-none border-none text-accent mb-2.5 p-0 cursor-pointer flex items-center gap-2"
                >
                  {collapsedCrewGroups[group.count] ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  <span className="text-sm tracking-wider">
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
              <p className="text-sm text-center">
                {crewOnlyMine ? 'Nothing from your watchlist yet.' : 'No watchlists found for this event.'}
              </p>
            )}
            
            {/* Write In Form */}
            {isWritingIn && (
                 <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2.5">
                      <input
                        placeholder="Movie Title"
                        value={newTitle || searchTerm}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="flex-1 min-w-0 bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base"
                      />
                      <div className={`inline-flex items-center gap-1 bg-black/30 rounded-lg p-1 border ${writeInScoreColor}`} style={{ color: writeInScoreColor, borderColor: writeInScoreColor }}>
                        <span role="img" aria-label="tomato" className="text-lg">🍅</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={newScore}
                          onChange={(e) => setNewScore(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-6 bg-transparent border-none text-center p-0"
                          style={{ color: writeInScoreColor }}
                        />
                        <span className="font-bold">%</span>
                      </div>
                    </div>
                    <textarea
                      placeholder="Write a description for the movie here!"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="min-h-[90px] resize-none bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base"
                    />
                    {writeInError && (
                      <div className="border border-red-500/40 bg-red-500/10 text-red-300 text-center p-3 rounded-lg">
                        {writeInError}
                      </div>
                    )}
                    <div className="flex items-start gap-2.5">
                      <div className="flex-1 flex flex-col gap-2.5">
                        <div className="text-sm text-slate-400">Add what genres you think it hits!</div>
                        <div className="flex gap-2.5">
                          <select value={newGenreOption} onChange={(e) => setNewGenreOption(e.target.value)} className="flex-1 h-14 pr-16 bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base">
                            {genres.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                          <button
                            onClick={() => setNewGenres(prev => prev.includes(newGenreOption) ? prev : [...prev, newGenreOption])}
                            className="self-center px-3 h-9 rounded-lg bg-white/10 text-white font-bold"
                          >
                            Add
                          </button>
                        </div>
                        {newGenres.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {newGenres.map(g => (
                              <button
                                key={g}
                                onClick={() => setNewGenres(prev => prev.filter(item => item !== g))}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-accent/40 bg-accent/20 text-accent text-xs"
                              >
                                {g}
                                <X size={12} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleWriteIn()} className="bg-accent text-black p-4 rounded-lg font-bold">Save & Select</button>
                    <button onClick={() => { setIsWritingIn(false); setActiveTab('search') }} className="text-sm bg-transparent">Cancel</button>
                 </div>
            )}

            {/* Theater Form */}
            {activeTab === 'theater' && (
                <div className="text-center mt-5">
                    <Ticket size={48} className="text-amber-400 mb-2.5 mx-auto"/>
                    <h3 className="text-amber-400 font-bold">Let's Go Out</h3>
                    <div className="flex flex-col gap-2.5 mt-5">
                      <input placeholder="Theater (Optional)" value={theaterName} onChange={(e) => setTheaterName(e.target.value)} className="w-full bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base" />
                      <textarea placeholder="Trip Notes (Optional)" value={theaterNotes} onChange={(e) => setTheaterNotes(e.target.value)} className="min-h-[90px] resize-none bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base" />
                    </div>

                    <div className="mt-4 text-left">
                      <div className="text-sm text-slate-400 mb-2">Search for your movie</div>
                      <form onSubmit={handleTheaterSearchSubmit} className="flex items-center gap-2 bg-white/10 p-2 rounded-lg">
                        <Search size={16} className="text-slate-400" />
                        <input
                          ref={theaterSearchInputRef}
                          type="text"
                          enterKeyHint="search"
                          placeholder="Search movies..."
                          value={theaterSearchTerm}
                          onChange={(e) => setTheaterSearchTerm(e.target.value)}
                          className="bg-transparent border-none text-white w-full"
                        />
                        {theaterSearchTerm && (
                          <button
                            type="button"
                            onClick={() => {
                              setTheaterSearchTerm('')
                              setTheaterResults([])
                              theaterSearchInputRef.current?.focus()
                            }}
                            className="bg-transparent border-none text-slate-400 p-0"
                            aria-label="Clear search"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </form>
                      {theaterResults.length > 0 && (
                        <div className="mt-3">
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
                        <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-lg p-3 mt-3 text-left">
                          <div className="flex justify-between gap-2.5 items-center">
                            <div className="font-bold">{theaterSelectedMovie.title}</div>
                            <button
                              type="button"
                              onClick={() => setTheaterSelectedMovie(null)}
                              className="bg-transparent border-none text-slate-400 inline-flex"
                              aria-label="Clear selected movie"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <div className="text-sm text-slate-400 mt-1.5">
                            Selected movie for this theater trip.
                          </div>
                        </div>
                      )}
                    </div>

                    {!theaterWriteInMode && (
                      <div className="mt-4 text-left">
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
                          className="border border-dashed border-amber-400/50 text-amber-400 p-2.5 rounded-lg w-full"
                        >
                          Can’t find it? Write in a movie
                        </button>
                      </div>
                    )}

                    {theaterWriteInMode && (
                      <div className="mt-4 text-left flex flex-col gap-3">
                        <div className="flex items-center gap-2.5">
                          <input
                            placeholder="Movie Title"
                            value={theaterWriteInTitle}
                            onChange={(e) => setTheaterWriteInTitle(e.target.value)}
                            className="flex-1 min-w-0 bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base"
                          />
                          <div className={`inline-flex items-center gap-1 bg-black/30 rounded-lg p-1 border`} style={{ color: theaterWriteInScoreColor, borderColor: theaterWriteInScoreColor }}>
                            <span role="img" aria-label="tomato" className="text-lg">🍅</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={theaterWriteInScore}
                              onChange={(e) => setTheaterWriteInScore(e.target.value.replace(/[^0-9]/g, ''))}
                              className="w-6 bg-transparent border-none text-center p-0"
                              style={{ color: theaterWriteInScoreColor }}
                            />
                            <span className="font-bold">%</span>
                          </div>
                        </div>
                        <textarea
                          placeholder="Write a description for the movie here!"
                          value={theaterWriteInDescription}
                          onChange={(e) => setTheaterWriteInDescription(e.target.value)}
                          className="min-h-[90px] resize-none bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base"
                        />
                        <div className="text-sm text-slate-400">Add what genres you think it hits!</div>
                        <div className="flex gap-2.5">
                          <select value={theaterWriteInGenreOption} onChange={(e) => setTheaterWriteInGenreOption(e.target.value)} className="flex-1 h-14 pr-16 bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base">
                            {genres.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                          <button
                            onClick={() => setTheaterWriteInGenres(prev => prev.includes(theaterWriteInGenreOption) ? prev : [...prev, theaterWriteInGenreOption])}
                            className="self-center px-3 h-9 rounded-lg bg-white/10 text-white font-bold"
                          >
                            Add
                          </button>
                        </div>
                        {theaterWriteInGenres.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {theaterWriteInGenres.map(g => (
                              <button
                                key={g}
                                onClick={() => setTheaterWriteInGenres(prev => prev.filter(item => item !== g))}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-accent/40 bg-accent/20 text-accent text-xs"
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
                      <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-2xl p-3 text-center mt-4">
                        {theaterError}
                      </div>
                    )}

                    <button onClick={handleTheaterNomination} className="bg-amber-400 text-black w-full p-4 rounded-lg mt-4 font-bold">Nominate Trip</button>
                </div>
            )}
        </div>

        {activeTab === 'search' && !isWritingIn && (
          <button
            onClick={() => {
              setActiveTab('search')
              setIsWritingIn(true)
            }}
            className="w-full mt-3 bg-accent text-black p-3 rounded-lg font-bold"
          >
            + Write In Movie
          </button>
        )}
      </motion.div>
    </div>
  )
}

function TabButton({ active, children, onClick }) {
    return <button onClick={onClick} className={`px-4 py-2 rounded-full whitespace-nowrap ${active ? 'bg-white text-black' : 'bg-white/10 text-white'} flex items-center gap-1.5 text-sm font-semibold`}>{children}</button>
}

function MovieRow({ movie, onSelect, showWatchlistAction = false, isInWatchlist = false, onToggleWatchlist }) {
    const description = movie.description?.trim()
    const scoreColor = movie.rt_score >= 80 ? 'text-green-400 border-green-400' : movie.rt_score >= 60 ? 'text-yellow-400 border-yellow-400' : 'text-slate-400 border-slate-400'
    const yearLabel = movie.year ? ` (${movie.year})` : ''
    const isClickable = typeof onSelect === 'function'
    const posterUrl = movie.poster_path ? `${POSTER_BASE_URL}${movie.poster_path}` : null

    return (
      <div onClick={isClickable ? onSelect : undefined} className={`flex justify-between items-center p-3 mb-2 bg-white/5 rounded-lg gap-3 ${isClickable ? 'cursor-pointer' : ''}`}>
        {posterUrl && <img src={posterUrl} alt={movie.title} className="w-10 h-14 object-cover rounded-md bg-slate-800" />}
        <div className="flex-1 min-w-0">
          <div className="font-semibold">
            {movie.title}
            {movie.year ? (
              <span className="text-sm text-slate-400 ml-1.5">{yearLabel}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {movie.rt_score !== null && movie.rt_score !== undefined && (
              <span
                className={`border px-2 py-1 rounded-lg text-xs font-bold ${scoreColor}`}
              >
                🍅 {movie.rt_score}%
              </span>
            )}
            {(movie.rt_score !== null && movie.rt_score !== undefined) && (
              <span className="text-sm text-slate-600">|</span>
            )}
            <div className="text-sm text-slate-400">{movie.genre?.join(', ')}</div>
          </div>
          {description && (
            <div className="text-sm text-slate-400 mt-1.5">
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
            className={`border w-9 h-9 rounded-full inline-flex items-center justify-center cursor-pointer shrink-0 ${isInWatchlist ? 'border-accent/50 bg-accent/20 text-accent' : 'border-white/30 bg-white/10 text-white'}`}
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
                className="flex"
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
    const scoreColor = movie.rt_score >= 80 ? 'text-green-400 border-green-400' : movie.rt_score >= 60 ? 'text-yellow-400 border-yellow-400' : 'text-slate-400 border-slate-400'
    const names = users.map(u => u.name)
    const displayNames = names.length > 4 ? `${names.slice(0, 4).join(', ')} +${names.length - 4} more` : names.join(', ')
    const posterUrl = movie.poster_path ? `${POSTER_BASE_URL}${movie.poster_path}` : null

    return (
      <div onClick={onSelect} className="flex justify-between items-center p-3 mb-2 bg-white/5 rounded-lg cursor-pointer gap-3">
        {posterUrl && <img src={posterUrl} alt={movie.title} className="w-10 h-14 object-cover rounded-md bg-slate-800" />}
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{movie.title}</div>
          <div className="text-sm text-slate-400">{movie.genre?.join(', ')}</div>
          {description && (
            <div className="text-sm text-slate-400 mt-1.5">
              {description}
            </div>
          )}
          {displayNames && (
            <div className="text-sm text-slate-300 mt-1.5">
              On: {displayNames}
            </div>
          )}
        </div>
        {movie.rt_score !== null && movie.rt_score !== undefined && (
          <span
            className={`border px-2 py-1 rounded-lg text-xs font-bold ${scoreColor}`}
          >
            🍅 {movie.rt_score}%
          </span>
        )}
      </div>
    )
}

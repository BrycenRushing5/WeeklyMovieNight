import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion' 
import { X, Search, Filter, Book, Ticket, Users, ChevronDown, ChevronUp, Minus, Plus, Check, SquarePen, Film, Star } from 'lucide-react' 
import { supabase } from './supabaseClient'
import { normalizeMovieSearchText, searchMoviesByText } from './movieSearch'
import MoviePoster from './MoviePoster'

const DEFAULT_GENRES = ['Action', 'Adventure', 'Comedy', 'Documentary', 'Horror', 'Romance', 'Sci-Fi', 'Mystery & thriller', 'Fantasy']
const COMMON_GENRES = ['Action', 'Adventure', 'Comedy', 'Documentary', 'Horror', 'Romance', 'Sci-Fi', 'Mystery & thriller', 'Fantasy']
const DEFAULT_MIN_SCORE = 0

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
  const listRef = useRef(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [selectedMovie, setSelectedMovie] = useState(null)
  
  // Lists
  const [myWatchlist, setMyWatchlist] = useState([])
  const [crewWatchlistEntries, setCrewWatchlistEntries] = useState([])
  const [crewOnlyMine, setCrewOnlyMine] = useState(false)
  const [crewExcludeMe, setCrewExcludeMe] = useState(false)
  const [collapsedCrewGroups, setCollapsedCrewGroups] = useState({})
  
  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [minScore, setMinScore] = useState(DEFAULT_MIN_SCORE)
  const [genreFilters, setGenreFilters] = useState([])
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
  }, [searchTerm, activeTab, watchlistScope, genreFilters, minScore, isWritingIn, eventId, groupId])

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
      data = await searchMoviesByText(searchTerm, { limit: 20 })
    } else {
      let query = supabase.from('movies').select()
      if (genreFilters.length > 0) query = query.overlaps('genre', genreFilters)
      if (minScore > 0) query = query.gte('rt_score', minScore)
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
    const data = await searchMoviesByText(trimmed, { limit: 12 })
    if (requestId !== theaterSearchRequestId.current) return
    setTheaterResults(data || [])
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

  // Helper: Apply Genre & Score Filters locally
  function applyFilters(list, options = {}) {
    const { skipSearchMatch = false } = options
    const normalizedTerm = normalizeText(searchTerm)
    return list.filter(m => {
        const score = typeof m.rt_score === 'number' ? m.rt_score : 0
        const scorePass = score >= minScore
        const movieGenres = Array.isArray(m.genre) ? m.genre : (m.genre ? [m.genre] : [])
        const genrePass = genreFilters.length === 0 || genreFilters.some(g => movieGenres.includes(g))
        const normalizedTitle = normalizeText(m.title)
        const searchPass = skipSearchMatch || !searchTerm || normalizedTitle.includes(normalizedTerm)
        return scorePass && genrePass && searchPass
    })
  }

  function normalizeText(value) {
    return normalizeMovieSearchText(value)
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md h-[85dvh] bg-gradient-to-b from-slate-950 via-slate-900 to-black border border-white/10 rounded-3xl p-6 flex flex-col shadow-2xl overflow-hidden">
        
        <div className="flex justify-between items-center mb-5 shrink-0">
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
          <div className="flex gap-2.5 mb-4 overflow-x-auto pb-1.5 justify-center shrink-0">
              <TabButton active={activeTab === 'search'} onClick={() => {setActiveTab('search'); setIsWritingIn(false)}}><Search size={16}/> Search</TabButton>
              <TabButton active={activeTab === 'watchlist'} onClick={() => { setActiveTab('watchlist'); setIsWritingIn(false) }}><Book size={16}/> Watchlist</TabButton>
              <TabButton active={activeTab === 'theater'} onClick={() => { setActiveTab('theater'); setIsWritingIn(false) }}><Ticket size={16}/> Theatre</TabButton>
          </div>
        )}

        {isEventMode && showNominationGuide && (
          <div className="relative mb-3.5 pt-2 pr-3 shrink-0">
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
            <div className="mb-4 shrink-0">
                <div className="flex gap-2">
                    <form onSubmit={handleSearchSubmit} className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            enterKeyHint="search"
                            placeholder="Search movies..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-base focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('')
                                    searchInputRef.current?.focus()
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </form>
                    <button 
                        onClick={() => {
                            setShowFilters(!showFilters)
                            if (listRef.current) listRef.current.scrollTop = 0
                        }}
                        className={`p-2.5 rounded-xl border transition-colors ${showFilters ? 'bg-indigo-500/20 border-indigo-500 text-indigo-500' : 'bg-slate-900 border-white/10 text-slate-400'}`}
                    >
                        <Filter size={20} />
                    </button>
                </div>
            </div>
        )}

        {/* WATCHLIST SUB-TABS */}
        {activeTab === 'watchlist' && (
          <div className="flex flex-col gap-2.5 mb-3 shrink-0">
            <div className="flex gap-2.5">
              <button
                onClick={() => setWatchlistScope('mine')}
                className={`flex-1 p-2.5 rounded-lg font-bold ${watchlistScope === 'mine' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white'}`}
              >
                My Watchlist
              </button>
              <button
                onClick={() => setWatchlistScope('crew')}
                className={`flex-1 p-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 ${watchlistScope === 'crew' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white'}`}
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
        <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
            {showFilters && activeTab !== 'theater' && !isWritingIn && (
                <div className="mb-4 p-4 bg-slate-900 border border-white/10 rounded-xl space-y-4">
                        <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Genre</label>
                        <div className="flex flex-wrap gap-2">
                            <button 
                                onClick={clearGenreFilters}
                                className={`px-3 py-1 rounded-full text-xs font-bold border ${genreFilters.length === 0 ? 'bg-white text-black border-white' : 'border-white/10 text-slate-400'}`}
                            >
                                All
                            </button>
                            {DEFAULT_GENRES.map(g => (
                            <button
                                key={g}
                                onClick={() => toggleGenreFilter(g)}
                                className={`px-3 py-1 rounded-full text-xs font-bold border ${genreFilters.includes(g) ? 'bg-indigo-500 text-white border-indigo-500' : 'border-white/10 text-slate-400'}`}
                            >
                                {g}
                            </button>
                            ))}
                        </div>
                        </div>
                        <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Min Score: {minScore}%</label>
                        <input 
                            type="range" min="0" max="100" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} 
                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, #6366f1 ${minScore}%, #1e293b ${minScore}%)` }}
                        />
                        </div>
                </div>
            )}

            {activeTab === 'search' && !isWritingIn && (
                <>
                    <button 
                      onClick={() => setIsWritingIn(true)}
                      className="w-full py-2.5 px-4 mb-3 bg-[#121214]/50 border border-[#2a2a2e] rounded-lg flex items-center justify-between group transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-[#2a2a2e] rounded text-slate-400 transition-colors">
                          <SquarePen size={12} />
                        </div>
                        <span className="text-xs font-medium text-slate-400 transition-colors">
                          Can't find a movie?
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                        Write In
                      </span>
                    </button>

                    {results.map(m => (
                      <MovieCard
                        key={m.id}
                        movie={m}
                        onClick={() => setSelectedMovie(m)}
                        showWatchlistAction={isWatchlistMode}
                        isInWatchlist={myWatchlist.some(item => item.id === m.id)}
                        onToggleWatchlist={handleWatchlistToggle}
                        onSelect={isEventMode ? () => handleSelect(m) : undefined}
                      />
                    ))}
                </>
            )}
            {activeTab === 'watchlist' && watchlistScope === 'mine' && filteredMyWatchlist.map(m => <MovieCard key={m.id} movie={m} onClick={() => setSelectedMovie(m)} onSelect={() => handleSelect(m)} />)}
            {activeTab === 'watchlist' && watchlistScope === 'crew' && crewGroups.map(group => (
              <div key={group.count} className="mb-4">
                <button
                  onClick={() => setCollapsedCrewGroups(prev => ({ ...prev, [group.count]: !prev[group.count] }))}
                  className="w-full bg-none border-none text-indigo-400 mb-2.5 p-0 cursor-pointer flex items-center gap-2"
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
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/20 text-indigo-400 text-xs"
                              >
                                {g}
                                <X size={12} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleWriteIn()} className="bg-indigo-500 text-white p-4 rounded-lg font-bold">Save & Select</button>
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
                          className="bg-transparent border-none text-white w-full text-base"
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
                            <MovieCard
                              key={m.id}
                              movie={m}
                              onClick={() => setTheaterSelectedMovie(m)}
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
                          <div className="flex justify-between gap-2.5 items-start">
                            <div className="font-bold leading-snug break-words whitespace-normal flex-1 min-w-0">{theaterSelectedMovie.title}</div>
                            <button
                              type="button"
                              onClick={() => setTheaterSelectedMovie(null)}
                              className="bg-transparent border-none text-slate-400 inline-flex shrink-0 mt-0.5"
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

        {/* Expanded Card Modal */}
        <AnimatePresence>
            {selectedMovie && (
                <ExpandedCard 
                    movie={selectedMovie}
                    onClose={() => setSelectedMovie(null)}
                    onAction={() => {
                        if (activeTab === 'theater') {
                            setTheaterSelectedMovie(selectedMovie)
                            setTheaterWriteInMode(false)
                            setTheaterSearchTerm('')
                            setTheaterResults([])
                            setTheaterError('')
                            setSelectedMovie(null)
                        } else if (isEventMode) {
                            handleSelect(selectedMovie)
                        } else {
                            handleWatchlistToggle(selectedMovie)
                        }
                    }}
                    actionLabel={activeTab === 'theater' ? 'Select for Trip' : (isEventMode ? 'Nominate' : (myWatchlist.some(m => m.id === selectedMovie.id) ? 'Remove from Watchlist' : 'Add to Watchlist'))}
                    isAdded={!isEventMode && myWatchlist.some(m => m.id === selectedMovie.id)}
                />
            )}
        </AnimatePresence>

      </motion.div>
    </div>
  )
}

function TabButton({ active, children, onClick }) {
    return <button onClick={onClick} className={`px-4 py-2 rounded-full whitespace-nowrap ${active ? 'bg-white text-black' : 'bg-white/10 text-white'} flex items-center gap-1.5 text-sm font-semibold`}>{children}</button>
}

function MovieCard({ movie, onClick, showWatchlistAction, isInWatchlist, onToggleWatchlist, onSelect }) {
    const score = movie.rt_score || movie.vote_average ? Math.round(movie.rt_score || (movie.vote_average * 10)) + '%' : null
    const isWatchlistSearchCard = Boolean(showWatchlistAction && !onSelect)

    return (
      <div className="flex gap-3 p-3 bg-slate-900/40 border border-white/5 rounded-xl group cursor-pointer transition-colors mb-3">
        <div className="flex gap-3 flex-1 min-w-0 cursor-pointer" onClick={onClick}>
            <MoviePoster
              title={movie.title}
              posterPath={movie.poster_path}
              className="w-20 h-28 shrink-0 rounded-lg"
              iconSize={20}
            />

            <div className="flex-1 flex flex-col min-w-0">
              <div>
                <div className="flex justify-between items-start gap-2">
                  <h3 className={`font-bold text-slate-100 text-sm leading-tight break-words whitespace-normal ${isWatchlistSearchCard ? 'line-clamp-3' : 'line-clamp-2'}`}>
                    {movie.title}
                  </h3>
                  {score && <span className="text-[10px] text-emerald-400 font-medium shrink-0">{score}</span>}
                </div>
                <p className="text-xs text-slate-500 mt-1">{movie.year || (movie.release_date ? movie.release_date.substring(0, 4) : '')}</p>
                {movie.description && (
                  <p className={`mt-2 leading-relaxed break-words whitespace-normal ${isWatchlistSearchCard ? 'text-[11px] text-slate-400 line-clamp-3' : 'text-[10px] text-slate-600 line-clamp-2'}`}>
                    {movie.description}
                  </p>
                )}
              </div>

              {isWatchlistSearchCard && (
                <div className="mt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleWatchlist(movie)
                    }}
                    className={`h-9 px-4 rounded-full inline-flex items-center gap-2 text-xs font-bold transition-all border active:scale-95 ${isInWatchlist ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/10 text-slate-200'}`}
                  >
                    {isInWatchlist ? <><Check size={14} /> Remove</> : <><Plus size={14} /> Add to Watchlist</>}
                  </button>
                </div>
              )}
            </div>
        </div>
        
        {!isWatchlistSearchCard && (
        <div className="flex items-center justify-end gap-3 mt-2 self-center">
            {showWatchlistAction && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggleWatchlist(movie) }}
                  className={`p-2 rounded-full transition-all ${isInWatchlist ? 'text-indigo-500 bg-indigo-500/10' : 'text-slate-500'}`}
                >
                  {isInWatchlist ? <Check size={20} /> : <Plus size={20} />}
                </button>
            )}
            {onSelect && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onSelect(movie) }}
                  className="h-9 px-4 rounded-full flex items-center gap-2 text-xs font-bold transition-all bg-white/5 text-slate-200 border border-white/10"
                 >
                  <Plus size={14} /> Nominate
                </button>
            )}
        </div>
        )}
      </div>
    )
}

function ExpandedCard({ movie, onClose, onAction, actionLabel, isAdded }) {
    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-lg max-h-[85vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex-1 overflow-y-auto p-6 pb-24">
                    <div className="flex gap-4 mb-4">
                        <MoviePoster
                            title={movie.title}
                            posterPath={movie.poster_path}
                            className="w-28 shrink-0 aspect-[2/3] rounded-xl shadow-lg"
                            iconSize={24}
                            showTitle
                        />
                        <div>
                            <h2 className="text-2xl font-bold leading-tight mb-1">{movie.title}</h2>
                            <div className="text-sm text-slate-400 mb-2">{movie.year || 'N/A'}</div>
                            {movie.rt_score && (
                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-xs font-bold text-yellow-400">
                                    <Star size={12} fill="currentColor" /> {movie.rt_score}%
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-6">
                        {movie.genre?.map(g => (
                            <span key={g} className="text-xs bg-white/10 px-2 py-1 rounded-full">{g}</span>
                        ))}
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {movie.description || "No description available."}
                    </p>
                </div>

                {/* Action Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-6 pt-12 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent flex justify-center gap-4 z-10">
                    <button onClick={onAction} className={`flex-1 h-12 rounded-xl border-2 flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 font-bold ${isAdded ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/10 text-white'}`}>
                        {isAdded ? <><Check size={18} /> Added</> : <><Plus size={18} /> {actionLabel}</>}
                        </button>
                </div>
            </div>
            
            <button className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white/70 backdrop-blur-sm border border-white/10 z-20" onClick={onClose}>
                <X size={20} />
            </button>
        </div>
    )
}

function CrewWatchlistRow({ entry, onSelect }) {
    const { movie, users } = entry
    const description = movie.description?.trim()
    const scoreColor = movie.rt_score >= 80 ? 'text-green-400 border-green-400' : movie.rt_score >= 60 ? 'text-yellow-400 border-yellow-400' : 'text-slate-400 border-slate-400'
    const names = users.map(u => u.name)
    const displayNames = names.length > 4 ? `${names.slice(0, 4).join(', ')} +${names.length - 4} more` : names.join(', ')

    return (
      <div onClick={onSelect} className="flex justify-between items-center p-3 mb-2 bg-white/5 rounded-lg cursor-pointer gap-3 transition-colors">
        <MoviePoster
          title={movie.title}
          posterPath={movie.poster_path}
          className="w-10 h-14 shrink-0 rounded-md"
          iconSize={16}
        />
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{movie.title}</div>
          <div className="text-sm text-slate-400">{movie.genre?.join(', ')}</div>
          {description && (
            <div className="text-sm text-slate-400 mt-1.5 line-clamp-1">
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

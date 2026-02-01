import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Minus, Heart, Clock, Users, ChevronRight, ChevronLeft, 
  X, Check, Sparkles, MoreHorizontal, Film, Ticket, MapPin, SquarePen, Star
} from 'lucide-react'
import { POSTER_BASE_URL } from './tmdbClient'
import LoadingSpinner from './LoadingSpinner'

const DEFAULT_GENRES = ['Action', 'Adventure', 'Comedy', 'Documentary', 'Holiday', 'Horror', 'Romance', 'Sci-Fi', 'Mystery & thriller', 'Fantasy']

export default function NominateView() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  
  // --- State Management ---
  const [activeTab, setActiveTab] = useState('search') // 'search', 'watchlist', 'history', 'theater'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [nominations, setNominations] = useState([]) // Current event nominations
  const [userWatchlist, setUserWatchlist] = useState(new Set()) // IDs of movies in watchlist
  const [myWatchlistMovies, setMyWatchlistMovies] = useState([]) // Full movie objects
  const [watchlistScope, setWatchlistScope] = useState('mine') // 'mine' | 'audience'
  const [crewWatchlist, setCrewWatchlist] = useState([])
  const [pastEvents, setPastEvents] = useState([])
  const [isBallotOpen, setIsBallotOpen] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  
  // Theater State
  const [theaterName, setTheaterName] = useState('')
  const [theaterNotes, setTheaterNotes] = useState('')
  const [theaterSearchQuery, setTheaterSearchQuery] = useState('')
  const [theaterSearchResults, setTheaterSearchResults] = useState([])
  const [theaterSelectedMovie, setTheaterSelectedMovie] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [recentNominations, setRecentNominations] = useState([])

  // Manual Entry State
  const [manualTitle, setManualTitle] = useState('')
  const [manualDescription, setManualDescription] = useState('')
  const [manualScore, setManualScore] = useState('')
  const [manualGenres, setManualGenres] = useState([])
  const [selectedMovie, setSelectedMovie] = useState(null)

  const searchTimeout = useRef(null)
  const theaterSearchTimeout = useRef(null)

  const manualScoreNum = parseInt(manualScore, 10)
  const manualScoreColor = !isNaN(manualScoreNum)
    ? (manualScoreNum >= 80 ? 'text-green-400 border-green-500/50' : manualScoreNum >= 60 ? 'text-yellow-400 border-yellow-500/50' : 'text-slate-400 border-slate-500/50')
    : 'text-slate-500 border-[#2a2a2e]'

  useEffect(() => {
    loadInitialData()
  }, [code])

  useEffect(() => {
    if (activeTab === 'search') {
        if (searchTimeout.current) clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => performSearch(searchQuery), 300)
    }
  }, [searchQuery, activeTab])

  useEffect(() => {
    if (activeTab === 'theater') {
        if (theaterSearchTimeout.current) clearTimeout(theaterSearchTimeout.current)
        theaterSearchTimeout.current = setTimeout(() => performTheaterSearch(theaterSearchQuery), 300)
    }
  }, [theaterSearchQuery, activeTab])

  async function loadInitialData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        navigate('/')
        return
    }
    setUserId(user.id)

    // 1. Fetch Current Nominations
    await fetchNominations()

    // 2. Fetch User Watchlist (Full objects)
    const { data: wlData } = await supabase.from('user_wishlist').select('movie:movies(*)').eq('user_id', user.id)
    const movies = wlData?.map(i => i.movie).filter(Boolean) || []
    setMyWatchlistMovies(movies)
    setUserWatchlist(new Set(movies.map(m => m.id)))

    // 3. Fetch Crew Watchlist (Attendees of this event)
    await fetchCrewWatchlist(user.id)

    // 4. Fetch History (Past Events & Recent Nominations)
    await fetchHistory(user.id)

    setLoading(false)
  }

  async function fetchNominations() {
    const { data } = await supabase
      .from('nominations')
      .select('id, movie:movies(*), nomination_type, theater_name, theater_notes, nominated_by')
      .eq('event_id', code)
    
    // Flatten structure for easier UI consumption
    const flatNoms = (data || []).map(n => ({
        ...n.movie,
        nominationId: n.id,
        nominationType: n.nomination_type,
        theaterName: n.theater_name,
        theaterNotes: n.theater_notes,
        nominated_by: n.nominated_by
    })).filter(m => m.id) // Ensure movie exists
    
    setNominations(flatNoms)
  }

  async function fetchCrewWatchlist(currentUserId) {
    // Get attendees
    const { data: attendees } = await supabase
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', code)
    
    const attendeeIds = attendees?.map(a => a.user_id).filter(id => id !== currentUserId) || []
    
    if (attendeeIds.length === 0) {
        setCrewWatchlist([])
        return
    }

    const { data: crewWl } = await supabase
        .from('user_wishlist')
        .select('movie:movies(*), user_id, profiles(display_name, username)')
        .in('user_id', attendeeIds)
    
    // Group by movie to count how many crew members added it
    const movieMap = new Map()
    crewWl?.forEach(item => {
        if (!item.movie) return
        // Check if we already have this movie in the map
        const existing = movieMap.get(item.movie.id) || { ...item.movie, addedByCount: 0, addedByNames: [] }
        existing.addedByCount += 1
        
        const name = item.profiles?.display_name || item.profiles?.username || 'Movie Fan'
        // Add name to list if not already present
        if (name && !existing.addedByNames.includes(name)) {
            existing.addedByNames.push(name)
        }
        
        movieMap.set(item.movie.id, existing)
    })
    
    // Sort by number of watchlists (descending)
    setCrewWatchlist(Array.from(movieMap.values()).sort((a, b) => b.addedByCount - a.addedByCount))
  }

  async function fetchHistory(currentUserId) {
    // 1. Recent Nominations (Last 20)
    const { data: recentNoms } = await supabase
        .from('nominations')
        .select('movie:movies(*)')
        .eq('nominated_by', currentUserId)
        .order('id', { ascending: false })
        .limit(20)
    
    if (recentNoms) {
        const uniqueMovies = []
        const seenIds = new Set()
        recentNoms.forEach(item => {
            if (item.movie && !seenIds.has(item.movie.id)) {
                seenIds.add(item.movie.id)
                uniqueMovies.push(item.movie)
            }
        })
        setRecentNominations(uniqueMovies)
    }

    // 2. Past Events (Smart Import)
    // Get all event IDs the user has attended
    const { data: attendeeData } = await supabase
        .from('event_attendees')
        .select('event_id')
        .eq('user_id', currentUserId)
    
    if (!attendeeData || attendeeData.length === 0) return

    const allEventIds = attendeeData.map(a => a.event_id).filter(id => id != code)
    
    if (allEventIds.length === 0) return

    // Fetch the actual event details for the last 3 events
    const { data: events } = await supabase
        .from('events')
        .select('*')
        .in('id', allEventIds)
        .order('id', { ascending: false })
        .limit(3)
    
    if (!events || events.length === 0) return

    const targetEventIds = events.map(e => e.id)
    const { data: pastNoms } = await supabase
        .from('nominations')
        .select('event_id, movie:movies(*)')
        .in('event_id', targetEventIds)
        .eq('nominated_by', currentUserId)

    const eventsWithNoms = events.map(evt => {
        const userNominations = pastNoms
            ?.filter(n => n.event_id === evt.id && n.movie)
            .map(n => ({ ...n.movie, won: evt.selected_movie_id === n.movie.id })) || []
        return {
            ...evt,
            userNominations
        }
    }).filter(e => e.userNominations.length > 0)

    setPastEvents(eventsWithNoms)
  }

  async function performSearch(query) {
    if (!query.trim()) {
        setSearchResults([])
        return
    }
    setIsSearching(true)
    const { data } = await supabase.rpc('search_movies_fuzzy', { query, limit_count: 20 })
    setSearchResults(data || [])
    setIsSearching(false)
  }

  async function performTheaterSearch(query) {
    if (!query.trim()) {
        setTheaterSearchResults([])
        return
    }
    const { data } = await supabase.rpc('search_movies_fuzzy', { query, limit_count: 10 })
    setTheaterSearchResults(data || [])
  }

  // --- Actions ---

  const toggleNomination = async (movie, isTheater = false, theaterDetails = null) => {
    // Check if already nominated (by ID and Type)
    const type = isTheater ? 'theater' : 'streaming'
    const existing = nominations.find(n => n.id === movie.id && n.nominationType === type)

    if (existing) {
      // Remove
      const { error } = await supabase.from('nominations').delete().eq('id', existing.nominationId)
      if (!error) {
        setNominations(prev => prev.filter(n => n.nominationId !== existing.nominationId))
      }
    } else {
      // Add
      const { data, error } = await supabase.from('nominations').insert([{
        event_id: code,
        movie_id: movie.id,
        nominated_by: userId,
        nomination_type: type,
        theater_name: theaterDetails?.name || null,
        theater_notes: theaterDetails?.notes || null
      }]).select('id').single()

      if (!error && data) {
        setNominations(prev => [...prev, { 
            ...movie, 
            nominationId: data.id, 
            nominationType: type,
            theaterName: theaterDetails?.name,
            theaterNotes: theaterDetails?.notes,
            nominated_by: userId
        }])
      }
    }
  }

  const toggleWatchlist = async (e, movie) => {
    e.stopPropagation()
    const movieId = movie.id
    const inList = userWatchlist.has(movieId)
    
    // Optimistic Update
    const newSet = new Set(userWatchlist)
    if (inList) {
        newSet.delete(movieId)
        setMyWatchlistMovies(prev => prev.filter(m => m.id !== movieId))
    } else {
        newSet.add(movieId)
        setMyWatchlistMovies(prev => [movie, ...prev])
    }
    setUserWatchlist(newSet)

    if (inList) {
        await supabase.from('user_wishlist').delete().eq('user_id', userId).eq('movie_id', movieId)
    } else {
        await supabase.from('user_wishlist').insert([{ user_id: userId, movie_id: movieId }])
    }
  }

  const handleBulkImport = async (evt) => {
    const candidates = evt.userNominations.filter(m => !m.won)
    const newAdds = candidates.filter(c => !nominations.some(n => n.id === c.id))
    
    if (newAdds.length === 0) return alert("No new movies to import!")

    const inserts = newAdds.map(m => ({
        event_id: code,
        movie_id: m.id,
        nominated_by: userId,
        nomination_type: 'streaming'
    }))

    const { data, error } = await supabase.from('nominations').insert(inserts).select('id, movie_id')
    
    if (!error && data) {
        fetchNominations()
        alert(`Imported ${data.length} movies!`)
    }
  }

  const handleManualEntry = async () => {
    if (!manualTitle) return
    
    // Create movie in DB
    const score = parseInt(manualScore, 10)
    const { data: movie, error } = await supabase.from('movies').insert([{
        title: manualTitle,
        description: manualDescription || 'User Write-in',
        genre: manualGenres,
        rt_score: isNaN(score) ? null : score,
        source: 'write in'
    }]).select().single()

    if (movie) {
        // If we are in theater tab, nominate as theater
        const isTheater = activeTab === 'theater'
        if (isTheater) {
            setTheaterSelectedMovie(movie)
            setTheaterSearchQuery('')
            setTheaterSearchResults([])
        } else {
            await toggleNomination(movie, isTheater, isTheater ? { name: theaterName, notes: theaterNotes } : null)
        }
        setShowManualEntry(false)
        resetManualForm()
    }
  }

  const handleTheaterSubmit = async () => {
    if (theaterSelectedMovie) {
        await toggleNomination(theaterSelectedMovie, true, { name: theaterName, notes: theaterNotes })
        setTheaterSelectedMovie(null)
        setTheaterName('')
        setTheaterNotes('')
        setTheaterSearchQuery('')
        setTheaterSearchResults([])
        alert("Theater trip nominated!")
    }
  }
  
  function resetManualForm() {
    setManualTitle('')
    setManualDescription('')
    setManualScore('')
    setManualGenres([])
  }

  // --- Components ---

  const MovieCard = ({ movie, context = 'search', isTheater = false, onClick, showActions = true, onSelect, hideNominate = false }) => {
    const isNominated = nominations.some(n => n.id === movie.id && n.nominationType === (isTheater ? 'theater' : 'streaming'))
    const inWatchlist = userWatchlist.has(movie.id)
    const posterUrl = movie.poster_path ? `${POSTER_BASE_URL}${movie.poster_path}` : null
    const score = movie.rt_score || movie.vote_average ? Math.round(movie.rt_score || (movie.vote_average * 10)) + '%' : null

    return (
      <div className="bg-[#121214] border border-[#2a2a2e] rounded-xl p-3 flex gap-3 mb-3 group hover:border-rose-500/50 transition-colors">
        <div className="flex gap-3 flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        
        {/* Poster - Clickable */}
        <div className="w-20 h-28 shrink-0 rounded-lg bg-slate-800 flex items-center justify-center relative overflow-hidden">
          {posterUrl ? (
            <img src={posterUrl} alt={movie.title} className="w-full h-full object-cover" />
          ) : (
            <Film className="text-white/20" size={20} />
          )}
          {movie.won && (
            <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[8px] font-bold px-1.5 py-0.5 rounded-bl">WINNER</div>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
          <div>
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-bold text-slate-100 text-sm leading-tight truncate w-full">{movie.title}</h3>
              {score && <span className="text-[10px] text-emerald-400 font-medium shrink-0">{score}</span>}
            </div>
            <p className="text-xs text-slate-500 mt-1">{movie.year || (movie.release_date ? movie.release_date.substring(0, 4) : '')}</p>
            {context === 'crew' && movie.addedByNames?.length > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 bg-indigo-500/10 px-2 py-0.5 rounded text-[10px] text-indigo-400">
                <Users size={10} />
                In {movie.addedByNames.join(', ')}'s watchlist
              </div>
            )}
            {movie.description && <p className="text-[10px] text-slate-600 mt-2 line-clamp-2 leading-relaxed">{movie.description}</p>}
          </div>
        </div>
        </div>
        
        {showActions && (
          <div className="flex items-center justify-end gap-3 mt-2">
            {/* Watchlist Action */}
            <button 
              onClick={(e) => toggleWatchlist(e, movie)}
              className={`p-2 rounded-full transition-all ${inWatchlist ? 'text-pink-500 bg-pink-500/10' : 'text-slate-600 hover:text-slate-400'}`}
            >
              <Heart size={18} fill={inWatchlist ? "currentColor" : "none"} />
            </button>

            {/* Nominate/Select Action */}
            {!hideNominate && (
              onSelect ? (
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(movie)
                  }}
                  className="h-9 px-4 rounded-full flex items-center gap-2 text-xs font-bold transition-all bg-[#1c1c1f] text-slate-200 border border-[#2a2a2e] hover:border-amber-500 hover:text-amber-500"
                >
                  <Check size={14} /> Select
                </button>
              ) : (
                <button 
              onClick={(e) => {
                e.stopPropagation()
                toggleNomination(movie, isTheater, isTheater ? { name: theaterName, notes: theaterNotes } : null)
              }}
              className={`
                h-9 px-4 rounded-full flex items-center gap-2 text-xs font-bold transition-all
                ${isNominated 
                  ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]' 
                  : 'bg-[#1c1c1f] text-slate-200 border border-[#2a2a2e] hover:border-rose-500'
                }
              `}
            >
              {isNominated ? (
                <>
                  <Check size={14} /> Added
                </>
              ) : (
                <>
                  <Plus size={14} /> Nominate
                </>
              )}
            </button>
              )
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <LoadingSpinner label="Loading nominations..." />

  return (
    <div className="h-screen w-full bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 flex flex-col gap-4 bg-gradient-to-b from-black/80 to-transparent z-20 shrink-0">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate(`/room/${code}`)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-2xl font-black tracking-tighter text-rose-500">
                Nominate
                </h1>
            </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1 bg-white/10 rounded-xl overflow-x-auto">
          {['search', 'watchlist', 'history', 'theater'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg capitalize transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 py-4 flex-1 overflow-y-auto pb-32 touch-auto">
        
        {/* --- SEARCH TAB --- */}
        {activeTab === 'search' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="relative">
              <input 
                type="text"
                placeholder="Search movies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121214] border border-[#2a2a2e] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
              />
              <Search className="absolute left-4 top-3.5 text-slate-600" size={18} />
            </div>

            <button 
              onClick={() => setShowManualEntry(true)}
              className="w-full py-2.5 px-4 bg-[#121214]/50 border border-[#2a2a2e] rounded-lg flex items-center justify-between group hover:bg-[#121214] transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#2a2a2e] rounded text-slate-400 group-hover:text-white transition-colors">
                  <SquarePen size={12} />
                </div>
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                  Can't find a movie?
                </span>
              </div>
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                Write In
              </span>
            </button>

            {searchQuery ? (
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Results</h3>
                {isSearching ? (
                    <div className="text-center text-slate-500 py-8">Searching...</div>
                ) : searchResults.length > 0 ? (
                    searchResults.map(movie => (
                        <MovieCard key={movie.id} movie={movie} onClick={() => setSelectedMovie(movie)} />
                    ))
                ) : (
                    <div className="text-center text-slate-500 py-4">No results found.</div>
                )}
              </div>
            ) : (
              <div className="text-center py-20 opacity-40">
                <Search size={48} className="mx-auto mb-4 text-slate-600" />
                <p className="text-sm">Search for movies to nominate</p>
              </div>
            )}
          </div>
        )}

        {/* --- WATCHLIST TAB --- */}
        {activeTab === 'watchlist' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex bg-white/5 p-1 rounded-xl mb-4">
                <button 
                    onClick={() => setWatchlistScope('mine')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${watchlistScope === 'mine' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                    My Watchlist
                </button>
                <button 
                    onClick={() => setWatchlistScope('audience')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${watchlistScope === 'audience' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                    Audience Watchlist
                </button>
            </div>

            {watchlistScope === 'mine' && (
                <div>
                    {myWatchlistMovies.length === 0 && <p className="text-sm text-slate-600 italic text-center py-8">Your watchlist is empty.</p>}
                    {myWatchlistMovies.map(movie => (
                        <MovieCard key={movie.id} movie={movie} onClick={() => setSelectedMovie(movie)} />
                    ))}
                </div>
            )}

            {watchlistScope === 'audience' && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Users size={12} /> Crew Favorites
              </h3>
              {crewWatchlist.length === 0 && <p className="text-sm text-slate-600 italic">No crew favorites found.</p>}
              {crewWatchlist.map(movie => (
                <MovieCard key={movie.id} movie={movie} context="crew" onClick={() => setSelectedMovie(movie)} />
              ))}
            </div>)}
          </div>
        )}

        {/* --- HISTORY TAB --- */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             
             {/* 1. Smart Import (Events) */}
             <div className="bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-500/20 rounded-xl p-4">
               <h3 className="text-blue-400 text-sm font-bold flex items-center gap-2 mb-2">
                 <Sparkles size={14} /> Smart Import
               </h3>
               <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                 Bring back your nominations from past events. Winners are automatically excluded.
               </p>
               {pastEvents.length === 0 ? (
                   <p className="text-xs text-slate-500">No past events found.</p>
               ) : (
                   pastEvents.map(evt => (
                     <div key={evt.id} className="bg-[#050505] rounded-lg p-3 border border-blue-500/10 mb-3 last:mb-0">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-bold text-sm text-slate-200">{evt.title}</span>
                          <span className="text-[10px] text-slate-500">{new Date(evt.event_date || evt.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex -space-x-2 overflow-hidden mb-3 pl-2">
                          {evt.userNominations.filter(m => !m.won).slice(0, 5).map(m => (
                             <div key={m.id} className="w-8 h-8 rounded-full border border-[#050505] bg-slate-800 overflow-hidden">
                                {m.poster_path ? <img src={`${POSTER_BASE_URL}${m.poster_path}`} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-700" />}
                             </div>
                          ))}
                          {evt.userNominations.filter(m => !m.won).length > 5 && (
                            <div className="w-8 h-8 rounded-full border border-[#050505] bg-slate-800 flex items-center justify-center text-[10px] text-slate-400">
                              +{evt.userNominations.filter(m => !m.won).length - 5}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => handleBulkImport(evt)}
                          className="w-full py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-bold rounded-lg transition-colors"
                        >
                          Import {evt.userNominations.filter(m => !m.won).length} Movies
                        </button>
                     </div>
                   ))
               )}
             </div>

             {/* 2. Recent Nominations */}
             <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Clock size={12} /> Recent Nominations
                </h3>
                {recentNominations.length === 0 ? (
                    <p className="text-sm text-slate-600 italic">No recent nominations found.</p>
                ) : (
                    recentNominations.map(movie => (
                        <MovieCard key={movie.id} movie={movie} onClick={() => setSelectedMovie(movie)} />
                    ))
                )}
             </div>
          </div>
        )}

        {/* --- THEATER TAB --- */}
        {activeTab === 'theater' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2 text-amber-500">
                        <Ticket size={18} />
                        <h3 className="font-bold text-sm">Plan a Theater Trip</h3>
                    </div>
                    <div className="space-y-3">
                        <input 
                            placeholder="Theater Name (e.g. AMC Downtown)" 
                            value={theaterName}
                            onChange={(e) => setTheaterName(e.target.value)}
                            className="w-full bg-[#050505] border border-amber-500/30 rounded-lg p-2.5 text-sm text-white focus:border-amber-500 outline-none"
                        />
                        <textarea 
                            placeholder="Notes (Showtimes, location, etc.)" 
                            value={theaterNotes}
                            onChange={(e) => setTheaterNotes(e.target.value)}
                            className="w-full bg-[#050505] border border-amber-500/30 rounded-lg p-2.5 text-sm text-white focus:border-amber-500 outline-none min-h-[60px]"
                        />
                    </div>
                </div>

                <div className="relative">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Movie</h3>
                    {!theaterSelectedMovie ? (
                        <>
                            <input 
                                type="text"
                                placeholder="Search movie for trip..."
                                value={theaterSearchQuery}
                                onChange={(e) => setTheaterSearchQuery(e.target.value)}
                                className="w-full bg-[#121214] border border-[#2a2a2e] rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:border-amber-500 outline-none"
                            />
                            <Search className="absolute left-4 top-9 text-slate-600" size={18} />
                            
                            <div className="mt-3 space-y-2">
                                {theaterSearchResults.map(movie => (
                                    <div key={movie.id} className="cursor-pointer">
                                        <MovieCard movie={movie} isTheater={true} onClick={() => setSelectedMovie(movie)} onSelect={() => {
                                            setTheaterSelectedMovie(movie)
                                            setTheaterSearchQuery('')
                                            setTheaterSearchResults([])
                                        }} />
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="relative">
                            <MovieCard movie={theaterSelectedMovie} isTheater={true} hideNominate={true} onClick={() => setSelectedMovie(theaterSelectedMovie)} />
                            <button
                                onClick={() => setTheaterSelectedMovie(null)}
                                className="absolute top-2 right-2 bg-black/50 p-1 rounded-full text-white hover:bg-red-500"
                            >
                                <X size={14} />
                            </button>
                            <button 
                                onClick={handleTheaterSubmit}
                                className="w-full mt-2 bg-amber-500 text-black font-bold py-3 rounded-xl hover:bg-amber-400 transition-colors"
                            >
                                Confirm Trip Nomination
                            </button>
                        </div>
                    )}
                </div>

                {!theaterSelectedMovie && (
                    <button 
                        onClick={() => setShowManualEntry(true)}
                        className="w-full mt-4 py-3 text-sm text-amber-400 border border-dashed border-amber-500/30 rounded-xl hover:bg-amber-500/5 flex items-center justify-center gap-2"
                    >
                        <SquarePen size={16} />
                        Can't find it? Write in for Theater
                    </button>
                )}
            </div>
        )}

      </div>

      {/* --- BOTTOM ACTION BAR (The Ballot) --- */}
      <div className={`fixed bottom-6 left-4 right-4 transition-all duration-500 z-50 transform`}>
        <div className={`bg-[#121214] rounded-2xl border border-[#2a2a2e] shadow-2xl overflow-hidden transition-all duration-300 ${isBallotOpen ? 'max-h-[80vh]' : 'max-h-20'}`}>
          
          {/* Bar Header */}
          <div 
            onClick={() => setIsBallotOpen(!isBallotOpen)}
            className="p-4 flex items-center justify-between cursor-pointer bg-gradient-to-r from-[#1c1c1f] to-[#121214]"
          >
            {/* Filter nominations to only show user's nominations */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 transition-colors ${nominations.filter(n => n.nominated_by === userId).length > 0 ? 'border-rose-500 text-rose-500 bg-rose-500/10' : 'border-slate-700 text-slate-500'}`}>
                  {nominations.filter(n => n.nominated_by === userId).length}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Ballot</div>
                <div className="text-sm font-bold text-white">
                  {nominations.filter(n => n.nominated_by === userId).length} Selected
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
               {isBallotOpen ? <ChevronRight className="rotate-90 text-slate-500" /> : <ChevronLeft className="rotate-90 text-slate-500" />}
            </div>
          </div>

          {/* Expanded Content */}
          <div className="px-4 pb-4">
            <div className="h-[1px] w-full bg-[#2a2a2e] mb-4" />
            {/* Only show user's nominations */}
            {nominations.filter(n => n.nominated_by === userId).length === 0 ? (
              <p className="text-center text-slate-600 text-xs py-4">Your ballot is empty.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {nominations.filter(n => n.nominated_by === userId).map((nom, idx) => (
                  <div key={nom.nominationId} className="flex items-center justify-between bg-[#050505] p-2 rounded-lg border border-[#2a2a2e]">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-slate-600 w-4 shrink-0">{idx + 1}.</span>
                      <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-200 truncate">{nom.title}</div>
                          {nom.nominationType === 'theater' && (
                              <div className="text-[10px] text-amber-500 flex items-center gap-1">
                                  <Ticket size={10} /> {nom.theaterName || 'Theater Trip'}
                              </div>
                          )}
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleNomination(nom, nom.nominationType === 'theater'); }}
                      className="text-slate-500 hover:text-red-400 p-1 shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Expanded Card Modal */}
      <AnimatePresence>
        {selectedMovie && (
            <ExpandedCard 
                movie={selectedMovie}
                isNominated={nominations.some(n => n.id === selectedMovie.id && n.nominationType === (activeTab === 'theater' ? 'theater' : 'streaming'))}
                inWatchlist={userWatchlist.has(selectedMovie.id)}
                onNominate={() => {
                    if (activeTab === 'theater') {
                        if (theaterSelectedMovie?.id === selectedMovie.id) {
                            setTheaterSelectedMovie(null)
                        } else {
                            setTheaterSelectedMovie(selectedMovie)
                            setTheaterSearchQuery('')
                            setTheaterSearchResults([])
                            setSelectedMovie(null)
                        }
                    } else {
                        toggleNomination(selectedMovie, activeTab === 'theater', activeTab === 'theater' ? { name: theaterName, notes: theaterNotes } : null)
                    }
                }}
                onWatchlist={(e) => toggleWatchlist(e, selectedMovie)}
                onClose={() => setSelectedMovie(null)}
                isSelectionMode={activeTab === 'theater'}
                isSelected={activeTab === 'theater' && theaterSelectedMovie?.id === selectedMovie.id}
            />
        )}
      </AnimatePresence>

      {/* Manual Entry Modal */}
      {showManualEntry && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#121214] w-full max-w-md rounded-2xl border border-[#2a2a2e] p-6 animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-white">Write In {activeTab === 'theater' ? '(Theater)' : ''}</h2>
              <button onClick={() => setShowManualEntry(false)}><X className="text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Movie Title</label>
                <input 
                    type="text" 
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    className="w-full bg-[#050505] border border-[#2a2a2e] rounded-lg p-3 text-white focus:border-rose-500 outline-none" 
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Description</label>
                <textarea 
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    className="w-full bg-[#050505] border border-[#2a2a2e] rounded-lg p-3 text-white focus:border-rose-500 outline-none min-h-[80px]" 
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Rotten Tomatoes Score</label>
                  <div className={`flex items-center gap-3 bg-[#050505] border rounded-lg p-3 transition-colors ${manualScoreColor}`}>
                    <span className="text-xl">🍅</span>
                    <input 
                        type="number" 
                        placeholder="0-100"
                        value={manualScore}
                        onChange={(e) => setManualScore(e.target.value)}
                        className="bg-transparent border-none outline-none text-lg font-bold w-full text-white placeholder-slate-700" 
                    />
                    <span className="text-sm font-bold opacity-50">%</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Genres</label>
                <div className="flex flex-wrap gap-2">
                    {DEFAULT_GENRES.map(g => (
                        <button
                            key={g}
                            onClick={() => setManualGenres(prev => prev.includes(g) ? prev.filter(i => i !== g) : [...prev, g])}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${manualGenres.includes(g) ? 'bg-rose-500 text-white border-rose-500' : 'bg-[#050505] border-[#2a2a2e] text-slate-400'}`}
                        >
                            {g}
                        </button>
                    ))}
                </div>
              </div>
              <button onClick={handleManualEntry} className="w-full bg-white text-black font-bold py-3 rounded-xl mt-2">
                Add to Ballot
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function ExpandedCard({ movie, isNominated, inWatchlist, onNominate, onWatchlist, onClose, isSelectionMode, isSelected }) {
    const posterUrl = movie.poster_path ? `${POSTER_BASE_URL}${movie.poster_path}` : null
    
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
                        <div className="w-28 shrink-0 aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 shadow-lg">
                            {posterUrl ? (
                                <img src={posterUrl} alt={movie.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-600"><Film size={24} /></div>
                            )}
                        </div>
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
                    <button onClick={onWatchlist} className={`w-14 h-14 rounded-full border-2 flex items-center justify-center shadow-lg transition-transform active:scale-95 ${inWatchlist ? 'bg-pink-500 border-pink-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                        <Heart size={24} fill={inWatchlist ? "currentColor" : "none"} />
                    </button>
                    <button onClick={onNominate} className={`h-14 px-8 rounded-full border-2 flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 font-bold ${isSelectionMode ? (isSelected ? 'bg-amber-500 border-amber-500 text-black' : 'bg-slate-900 border-slate-700 text-white hover:border-amber-500 hover:text-amber-500') : (isNominated ? 'bg-rose-500 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-white')}`}>
                        {isSelectionMode ? (
                            isSelected ? <><Check size={24} /> Selected</> : <><Check size={24} /> Select</>
                        ) : (
                            isNominated ? <><Check size={24} /> Added</> : <><Plus size={24} /> Nominate</>
                        )}
                    </button>
                </div>
            </div>
            
            <button className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white/70 hover:text-white backdrop-blur-sm border border-white/10 z-20" onClick={onClose}>
                <X size={20} />
            </button>
        </div>
    )
}

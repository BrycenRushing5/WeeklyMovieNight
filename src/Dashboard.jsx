import { useEffect, useState, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "./supabaseClient"
import SearchMovies from "./SearchMovies"
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion"
import { 
  LogOut, Plus, User, Home, Film, Lightbulb, 
  Settings, Filter, X, Calendar, MapPin, 
  ChevronRight, Star, Trash2, MoreHorizontal, Search,
  Users, Trophy, ChevronDown, Heart, Check
} from "lucide-react"
import DateTimePickerSheet from "./DateTimePickerSheet"
import { POSTER_BASE_URL } from './tmdbClient'
import LoadingSpinner from './LoadingSpinner'

const DEFAULT_GENRES = ['Action', 'Adventure', 'Comedy', 'Documentary', 'Holiday', 'Horror', 'Romance', 'Sci-Fi', 'Mystery & thriller', 'Fantasy']

const Dashboard = ({ session }) => {
  const navigate = useNavigate()
  // Tabs: 0: Ideas, 1: Hub, 2: Watchlist
  const [activeIndex, setActiveIndex] = useState(1)
  
  // Data State
  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [crews, setCrews] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [watchlistLoading, setWatchlistLoading] = useState(true)
  
  // UI State
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showPlusMenu, setShowPlusMenu] = useState(false)
  const [showCrewManager, setShowCrewManager] = useState(false)
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [showWatchlistSearch, setShowWatchlistSearch] = useState(false)
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [showNominateModal, setShowNominateModal] = useState(false)
  const [movieToNominate, setMovieToNominate] = useState(null)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [movieToRemove, setMovieToRemove] = useState(null)
  const [nominationError, setNominationError] = useState("")
  const [nominatedEventIds, setNominatedEventIds] = useState(new Set())
  
  // Filter State
  const [showFilters, setShowFilters] = useState(false)
  const [filterGenre, setFilterGenre] = useState("")
  const [filterScore, setFilterScore] = useState(0)
  const [watchSearchTerm, setWatchSearchTerm] = useState("")

  // Create Event State
  const [newEventTitle, setNewEventTitle] = useState("")
  const [newEventDate, setNewEventDate] = useState("")
  const [newEventLocation, setNewEventLocation] = useState("")
  const [selectedCrewId, setSelectedCrewId] = useState("")
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [shakeDate, setShakeDate] = useState(false)
  
  // Create Crew State
  const [newCrewName, setNewCrewName] = useState("")
  const [creatingCrew, setCreatingCrew] = useState(false)

  // Date Picker
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)
  const [pickedDate, setPickedDate] = useState(null)
  const [pickedTime, setPickedTime] = useState("")
  const [pickedPeriod, setPickedPeriod] = useState("PM")
  const [displayMonth, setDisplayMonth] = useState(() => new Date())

  // Swipe Logic
  const x = useMotionValue(0)
  const containerRef = useRef(null)
  
  // Tab Scroll Refs
  const ideasRef = useRef(null)
  const hubRef = useRef(null)
  const watchlistRef = useRef(null)
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0 })

  const userId = session?.user?.id
  const username = session?.user?.user_metadata?.username || session?.user?.user_metadata?.display_name || 'Movie Fan'

  useEffect(() => {
    if (userId) {
      loadEvents()
      loadCrews()
      loadWatchlist()
    }
  }, [userId])

  // Scroll inactive tabs to top when switching
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeIndex !== 0 && ideasRef.current) ideasRef.current.scrollTop = 0
      if (activeIndex !== 1 && hubRef.current) hubRef.current.scrollTop = 0
      if (activeIndex !== 2 && watchlistRef.current) watchlistRef.current.scrollTop = 0
    }, 500)
    return () => clearTimeout(timer)
  }, [activeIndex])

  // Calculate drag constraints manually to avoid Safari layout bugs
  useEffect(() => {
    const updateConstraints = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth
        setDragConstraints({ left: -width * 2, right: 0 })
      }
    }
    updateConstraints()
    window.addEventListener('resize', updateConstraints)
    return () => window.removeEventListener('resize', updateConstraints)
  }, [])

  const loadEvents = async () => {
    setEventsLoading(true)
    const { data: groups } = await supabase.from("group_members").select("group_id").eq("user_id", userId)
    const groupIds = groups?.map(g => g.group_id) || []
    
    const { data: attending } = await supabase.from("event_attendees").select("event_id").eq("user_id", userId)
    const attendingIds = attending?.map(a => a.event_id) || []

    let query = supabase.from("events").select("*")
    
    const conditions = [`created_by.eq.${userId}`]
    if (groupIds.length) conditions.push(`group_id.in.(${groupIds.join(',')})`)
    if (attendingIds.length) conditions.push(`id.in.(${attendingIds.join(',')})`)
    
    query = query.or(conditions.join(','))
    
    const { data } = await query
    
    if (data) {
        const sorted = data.sort((a, b) => {
            if (!a.event_date) return 1
            if (!b.event_date) return -1
            return new Date(a.event_date) - new Date(b.event_date)
        })
        setEvents(sorted)
    }
    setEventsLoading(false)
  }

  const loadCrews = async () => {
    const { data: created } = await supabase.from("groups").select("*").eq("created_by", userId)
    const { data: memberOf } = await supabase.from("group_members").select("group_id, groups(*)").eq("user_id", userId)
    
    const allCrews = new Map()
    created?.forEach(c => allCrews.set(c.id, c))
    memberOf?.forEach(m => {
        if (m.groups) allCrews.set(m.groups.id, m.groups)
    })
    
    setCrews(Array.from(allCrews.values()))
  }

  const loadWatchlist = async () => {
    setWatchlistLoading(true)
    try {
        const { data, error } = await supabase
        .from("user_wishlist")
        .select("movie:movies (*)")
        .eq("user_id", userId)
        .order('added_at', { ascending: false })
        
        if (error) throw error
        
        if (data) {
            setWatchlist(data.map(d => d.movie).filter(Boolean))
        }
    } catch (err) {
        console.error("Error loading watchlist:", err)
    } finally {
        setWatchlistLoading(false)
    }
  }

  // --- DERIVED STATE ---

  const now = new Date()
  const futureEvents = events.filter(e => !e.event_date || new Date(e.event_date) >= now)
  const pastEvents = events.filter(e => e.event_date && new Date(e.event_date) < now).reverse()
  
  const nextUp = futureEvents[0]
  const upcoming = futureEvents.slice(1)

  const filteredWatchlist = watchlist.filter(m => {
    if (!m) return false
    const title = m.title ? m.title.toLowerCase() : ''
    const search = watchSearchTerm.toLowerCase()
    const matchSearch = !search || title.includes(search)
    const matchGenre = !filterGenre || (m.genre && m.genre.includes(filterGenre))
    const matchScore = !filterScore || (m.rt_score >= filterScore)
    return matchSearch && matchGenre && matchScore
  })

  const uniqueGenres = Array.from(new Set(watchlist.flatMap(m => m.genre || []))).sort()

  // --- ACTIONS ---

  const handleCreateEvent = async () => {
    if (!newEventTitle.trim()) return
    if (!newEventDate) {
        setShakeDate(true)
        setTimeout(() => setShakeDate(false), 500)
        if (navigator.vibrate) navigator.vibrate(200)
        return
    }
    setCreatingEvent(true)
    const { data: newEvent, error } = await supabase.from("events").insert([{
        title: newEventTitle,
        event_date: newEventDate || null,
        location_address: newEventLocation || null,
        group_id: selectedCrewId || null,
        created_by: userId,
        status: 'voting'
    }]).select().single()
    
    if (!error && newEvent) {
        // Add creator as attendee
        let attendeesToAdd = [{ event_id: newEvent.id, user_id: userId }]

        // If crew selected, add crew members
        if (selectedCrewId) {
            const { data: crewMembers } = await supabase.from('group_members').select('user_id').eq('group_id', selectedCrewId)
            if (crewMembers) {
                const crewAttendees = crewMembers.filter(m => m.user_id !== userId).map(m => ({ event_id: newEvent.id, user_id: m.user_id }))
                attendeesToAdd = [...attendeesToAdd, ...crewAttendees]
            }
        }

        await supabase.from('event_attendees').insert(attendeesToAdd)

        setShowCreateEvent(false)
        setNewEventTitle("")
        setNewEventDate("")
        setNewEventLocation("")
        loadEvents()
    }
    setCreatingEvent(false)
  }

  const handleCreateCrew = async () => {
    if (!newCrewName.trim()) return
    setCreatingCrew(true)
    
    const { data: group, error } = await supabase.from("groups").insert([{
        name: newCrewName,
        created_by: userId
    }]).select().single()

    if (group && !error) {
        await supabase.from("group_members").insert([{
            group_id: group.id,
            user_id: userId
        }])
        setNewCrewName("")
        loadCrews()
    }
    setCreatingCrew(false)
  }

  const openNominateModal = async (movie) => {
    setMovieToNominate(movie)
    setNominationError("")
    
    if (userId && futureEvents.length > 0) {
        const { data } = await supabase
            .from('nominations')
            .select('event_id')
            .eq('movie_id', movie.id)
            .in('event_id', futureEvents.map(e => e.id))
        setNominatedEventIds(new Set(data?.map(n => n.event_id) || []))
    } else {
        setNominatedEventIds(new Set())
    }
    setShowNominateModal(true)
  }

  const confirmNomination = async (eventId) => {
    if (!userId || !movieToNominate) return
    setNominationError("")
    const { error } = await supabase.from('nominations').insert([{
        event_id: eventId,
        movie_id: movieToNominate.id,
        nominated_by: userId,
        nomination_type: 'streaming'
    }])
    
    if (error) {
        if (error.code === '23505') {
            setNominationError("This movie is already nominated for this event!")
        } else {
            setNominationError("Error nominating: " + error.message)
        }
        setTimeout(() => setNominationError(""), 3000)
    } else {
        setShowNominateModal(false)
        setMovieToNominate(null)
        setNominatedEventIds(new Set())
    }
  }

  const openRemoveModal = (movie) => {
    setMovieToRemove(movie)
    setShowRemoveModal(true)
  }

  const confirmRemove = async () => {
    if (!movieToRemove) return
    const movieId = movieToRemove.id
    setWatchlist(prev => prev.filter(m => m.id !== movieId))
    await supabase.from("user_wishlist").delete().eq("user_id", userId).eq("movie_id", movieId)
    if (selectedMovie?.id === movieId) setSelectedMovie(null)
    setShowRemoveModal(false)
    setMovieToRemove(null)
  }

  const addToWatchlist = async (movie) => {
    const { error } = await supabase.from("user_wishlist").insert([{ user_id: userId, movie_id: movie.id }])
    if (!error || error.code === '23505') {
        loadWatchlist()
    }
  }

  // --- HELPERS ---

  const openDateTimePicker = () => {
    const now = new Date()
    setPickedDate(now)
    setPickedTime("19:00")
    setPickedPeriod("PM")
    setDisplayMonth(now)
    setShowDateTimePicker(true)
  }

  const confirmDateTime = () => {
    if (!pickedDate || !pickedTime) return
    const [hh, mm] = pickedTime.split(":").map(Number)
    const d = new Date(pickedDate)
    d.setHours(hh, mm)
    setNewEventDate(d.toISOString())
    setShowDateTimePicker(false)
  }

  const formatDateTime = (iso) => {
    if (!iso) return "TBD"
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  // --- SWIPE HANDLER ---
  const handleDragEnd = (e, { offset, velocity }) => {
    const swipe = offset.x
    const threshold = 50
    const velocityThreshold = 500
    
    if ((swipe < -threshold || velocity.x < -velocityThreshold) && activeIndex < 2) {
      setActiveIndex(prev => prev + 1)
    } else if ((swipe > threshold || velocity.x > velocityThreshold) && activeIndex > 0) {
      setActiveIndex(prev => prev - 1)
    }
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white overflow-hidden flex flex-col">
      
      {/* HEADER */}
      <div className="flex justify-between items-start p-6 pt-8 pb-2 z-10 shrink-0">
        <div>
            <h1 className="text-3xl font-black tracking-tight mb-0.5 text-white">Your Hub</h1>
            <p className="text-slate-400 font-medium">@{username}</p>
        </div>

        <div className="relative">
            <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-200 hover:bg-slate-700 transition-colors">
                <User size={20} />
            </button>
            <AnimatePresence>
            {showProfileMenu && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden py-1"
                >
                    <button onClick={() => navigate('/profile')} className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-2 text-sm font-semibold">
                        <Trophy size={16} className="text-[var(--theme-accent)]" /> See Stats
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button onClick={() => supabase.auth.signOut()} className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-2 text-sm font-semibold text-white">
                        <LogOut size={16} className="text-[var(--theme-primary)]" /> Sign Out
                    </button>
                </motion.div>
                </>
            )}
            </AnimatePresence>
        </div>
      </div>

      {/* MAIN CONTENT (CAROUSEL) */}
      <div className="flex-1 relative overflow-hidden overscroll-x-none" ref={containerRef} style={{ perspective: 1000 }}>
        <motion.div
            className="flex h-full"
            style={{ width: '300%', touchAction: 'pan-y', willChange: 'transform' }}
            drag="x"
            dragConstraints={dragConstraints}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            initial={false}
            animate={{ x: `-${activeIndex * 33.333}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
            {/* --- IDEAS TAB (Index 0) --- */}
            <div ref={ideasRef} className="w-[100vw] h-full overflow-y-auto px-4 pb-24 scrollbar-hide">
                <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
                    <div className="w-20 h-20 bg-[var(--theme-accent)]/10 rounded-full flex items-center justify-center mb-4">
                        <Lightbulb size={40} className="text-[var(--theme-accent)]" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Ideas Board</h2>
                    <p className="text-slate-400">This feature is a work in progress. Soon you'll be able to save themes and movie night ideas here!</p>
                </div>
            </div>

            {/* --- HUB TAB (Index 1) --- */}
            <div ref={hubRef} className="w-[100vw] h-full overflow-y-auto px-4 pb-24 scrollbar-hide">
                <div className="space-y-6 pb-20 pt-2">
                    {eventsLoading ? (
                        <LoadingSpinner />
                    ) : (
                        <>
                            {/* NEXT UP */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-[var(--theme-primary)] animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.5)]" />
                                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Next Up</h2>
                                </div>
                                {nextUp ? (
                                    <Link to={`/room/${nextUp.id}`}>
                                        <div className="relative w-full aspect-[2/1] bg-slate-800 rounded-2xl overflow-hidden border border-white/10 shadow-2xl group">
                                            <div className="absolute inset-0 bg-gradient-to-br from-[var(--theme-primary)] via-black/50 to-black/80 group-hover:scale-105 transition-transform duration-700" />
                                            <div className="absolute inset-0 p-5 flex flex-col justify-end">
                                                <div className="flex items-end justify-between gap-4">
                                                    <div>
                                                        <h3 className="text-2xl font-black leading-none mb-2">{nextUp.title}</h3>
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-black/30 px-2 py-1 rounded-lg w-fit backdrop-blur-sm">
                                                            <Calendar size={12} /> {formatDateTime(nextUp.event_date)}
                                                        </div>
                                                    </div>
                                                    <div className="bg-[var(--theme-primary)] text-white text-xs font-bold px-4 py-2 rounded-full shrink-0 hover:bg-rose-700 transition-colors">
                                                        See Details
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ) : (
                                    <div className="p-6 rounded-2xl border border-dashed border-white/10 text-center">
                                        <p className="text-slate-500 text-sm">No upcoming events.</p>
                                        <button onClick={() => setShowCreateEvent(true)} className="mt-2 text-[var(--theme-primary)] text-sm font-bold hover:underline">Plan one now</button>
                                    </div>
                                )}
                            </section>

                            {/* UPCOMING */}
                            {upcoming.length > 0 && (
                                <section>
                                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Upcoming</h2>
                                    <div className="space-y-3">
                                        {upcoming.map(event => (
                                            <Link key={event.id} to={`/room/${event.id}`}>
                                                <div className="flex items-center gap-4 p-4 bg-slate-900/50 border border-white/5 rounded-xl hover:bg-slate-800 transition-colors">
                                                    <div className="w-12 h-12 rounded-lg bg-slate-800 flex flex-col items-center justify-center border border-[var(--theme-primary)] shrink-0">
                                                        <span className="text-[10px] text-slate-500 uppercase font-bold">{new Date(event.event_date).toLocaleString('default', { month: 'short' })}</span>
                                                        <span className="text-lg font-black leading-none">{new Date(event.event_date).getDate()}</span>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="font-bold truncate">{event.title}</h4>
                                                        <p className="text-xs text-slate-400 truncate">{event.location_address || 'No location set'}</p>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* PAST */}
                            {pastEvents.length > 0 && (
                                <section>
                                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Past Events</h2>
                                    <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity">
                                        {pastEvents.map(event => (
                                            <Link key={event.id} to={`/room/${event.id}`}>
                                                <div className="flex items-center justify-between p-3 bg-slate-900/30 border border-white/5 rounded-lg">
                                                    <span className="font-medium text-sm text-slate-300">{event.title}</span>
                                                    <span className="text-xs text-slate-500">{new Date(event.event_date).toLocaleDateString()}</span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* --- WATCHLIST TAB (Index 2) --- */}
            <div ref={watchlistRef} className="w-[100vw] h-full overflow-y-auto px-4 pb-24 scrollbar-hide">
                <div className="space-y-4 pt-2">
                    <div className="flex gap-2">
                        <form onSubmit={(e) => { e.preventDefault(); document.activeElement.blur() }} className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="text" 
                                enterKeyHint="search"
                                placeholder="Search watchlist..." 
                                value={watchSearchTerm}
                                onChange={(e) => setWatchSearchTerm(e.target.value)}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-base focus:outline-none focus:border-[var(--theme-secondary)] transition-colors"
                            />
                            {watchSearchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setWatchSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </form>
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2.5 rounded-xl border transition-colors ${showFilters ? 'bg-[var(--theme-secondary)]/20 border-[var(--theme-secondary)] text-[var(--theme-secondary)]' : 'bg-slate-900 border-white/10 text-slate-400'}`}
                        >
                            <Filter size={20} />
                        </button>
                        <button 
                            onClick={() => setShowWatchlistSearch(true)}
                            className="p-2.5 rounded-xl bg-[var(--theme-secondary)] text-white font-bold"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    {showFilters && (
                        <div className="p-4 bg-slate-900 border border-white/10 rounded-xl space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Genre</label>
                                <div className="flex flex-wrap gap-2">
                                    <button 
                                        onClick={() => setFilterGenre("")}
                                        className={`px-3 py-1 rounded-full text-xs font-bold border ${!filterGenre ? 'bg-white text-black border-white' : 'border-white/10 text-slate-400'}`}
                                    >
                                        All
                                    </button>
                                    {DEFAULT_GENRES.map(g => (
                                        <button 
                                            key={g}
                                            onClick={() => setFilterGenre(g === filterGenre ? "" : g)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold border ${g === filterGenre ? 'bg-[var(--theme-secondary)] text-white border-[var(--theme-secondary)]' : 'border-white/10 text-slate-400'}`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Min Score: {filterScore}%</label>
                                <input 
                                    type="range" 
                                    min="0" max="100" 
                                    value={filterScore} 
                                    onChange={(e) => setFilterScore(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                    onPointerDownCapture={(e) => e.stopPropagation()}
                                    style={{ background: `linear-gradient(to right, #6366f1 ${filterScore}%, #1e293b ${filterScore}%)` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {watchlistLoading ? (
                            <LoadingSpinner />
                        ) : filteredWatchlist.length === 0 ? (
                            <div className="text-center py-10 text-slate-500">
                                <Film size={48} className="mx-auto mb-2 opacity-20" />
                                <p>No movies found.</p>
                                <button onClick={() => setShowWatchlistSearch(true)} className="mt-2 text-[var(--theme-secondary)] text-sm font-bold hover:underline">Add a movie</button>
                            </div>
                        ) : (
                            filteredWatchlist.map(movie => (
                                <div 
                                    key={movie.id} 
                                    onClick={() => setSelectedMovie(movie)}
                                    className="flex gap-3 p-3 bg-slate-900/40 border border-white/5 rounded-xl group cursor-pointer hover:bg-slate-800 transition-colors"
                                >
                                    <div className="w-20 shrink-0 aspect-[2/3] bg-slate-800 rounded-lg overflow-hidden shadow-lg">
                                        {movie.poster_path ? (
                                            <img src={`${POSTER_BASE_URL}${movie.poster_path}`} className="w-full h-full object-cover" alt={movie.title} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-600"><Film size={20} /></div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-sm leading-tight">{movie.title}</h3>
                                            {movie.rt_score && (
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${movie.rt_score >= 60 ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                                                    {movie.rt_score}%
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">{movie.year} • {movie.genre?.[0]}</p>
                                        {movie.description && (
                                            <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{movie.description}</p>
                                        )}
                                        <div className="mt-auto flex gap-2">
                                            <button 
                                                onPointerDownCapture={(e) => e.stopPropagation()}
                                                onClick={(e) => { e.stopPropagation(); openNominateModal(movie) }}
                                                className="flex-1 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-xs font-bold transition-colors"
                                            >
                                                Nominate
                                            </button>
                                            <button 
                                                onPointerDownCapture={(e) => e.stopPropagation()}
                                                onClick={(e) => { e.stopPropagation(); openRemoveModal(movie) }}
                                                className="flex-1 py-2 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-xs font-bold transition-colors"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
      </div>

      {/* FLOATING ACTION BUTTON (Only on Hub) */}
      <AnimatePresence>
        {activeIndex === 1 && (
            <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="fixed bottom-20 right-6 z-20"
            >
                <div className="relative">
                    <button 
                        onClick={() => setShowPlusMenu(!showPlusMenu)} 
                        className="w-14 h-14 rounded-full bg-[var(--theme-primary)] text-white flex items-center justify-center shadow-[0_0_20px_rgba(225,29,72,0.5)] hover:bg-rose-500 transition-colors"
                    >
                        <Plus size={28} strokeWidth={2.5} />
                    </button>
                    {/* Plus Menu Dropdown (positioned bottom-up) */}
                    <AnimatePresence>
                    {showPlusMenu && (
                        <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowPlusMenu(false)} />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="absolute bottom-full right-0 mb-3 w-56 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-40 overflow-hidden py-1 origin-bottom-right"
                        >
                            <button onClick={() => { setShowCreateEvent(true); setShowPlusMenu(false) }} className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 text-sm font-bold">
                                <Calendar size={18} className="text-[var(--theme-secondary)]" /> Create Event
                            </button>
                            <button onClick={() => { setShowCrewManager(true); setShowPlusMenu(false) }} className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 text-sm font-bold">
                                <Plus size={18} className="text-green-400" /> Create Crew
                            </button>
                            <button onClick={() => { setShowCrewManager(true); setShowPlusMenu(false) }} className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 text-sm font-bold">
                                <Users size={18} className="text-purple-400" /> Manage Crews
                            </button>
                        </motion.div>
                        </>
                    )}
                    </AnimatePresence>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM NAVIGATION */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-lg border-t border-white/10 z-30 pb-safe">
        <div className="grid grid-cols-3 py-3">
            <button 
                onClick={() => setActiveIndex(0)}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${activeIndex === 0 ? 'text-[var(--theme-accent)]' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Lightbulb size={24} strokeWidth={activeIndex === 0 ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Ideas</span>
            </button>
            <button 
                onClick={() => setActiveIndex(1)}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${activeIndex === 1 ? 'text-[var(--theme-primary)]' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Home size={24} strokeWidth={activeIndex === 1 ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Hub</span>
            </button>
            <button 
                onClick={() => setActiveIndex(2)}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${activeIndex === 2 ? 'text-[var(--theme-secondary)]' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Film size={24} strokeWidth={activeIndex === 2 ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Watchlist</span>
            </button>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* CREATE EVENT MODAL */}
      <AnimatePresence>
        {showCreateEvent && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowCreateEvent(false)}>
                <motion.div 
                    initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold">New Event</h2>
                        <button onClick={() => setShowCreateEvent(false)} className="p-2 bg-white/5 rounded-full"><X size={20}/></button>
                    </div>
                    <div className="space-y-4">
                        <input 
                            placeholder="Event Title" 
                            value={newEventTitle}
                            onChange={(e) => setNewEventTitle(e.target.value)}
                            className="w-full bg-black/30 border border-white/10 p-4 rounded-xl text-lg font-bold focus:border-[var(--theme-secondary)] outline-none"
                        />
                        <motion.button 
                            onClick={openDateTimePicker} 
                            animate={shakeDate ? { x: [0, -10, 10, -10, 10, 0] } : {}}
                            transition={{ duration: 0.4 }}
                            className="w-full flex items-center gap-3 bg-white/5 p-4 rounded-xl text-left hover:bg-white/10"
                        >
                            <Calendar className="text-indigo-500" />
                            {newEventDate ? formatDateTime(newEventDate) : "Set Date & Time"}
                        </motion.button>
                        <div className="flex items-center gap-2 bg-black/30 border border-white/10 p-4 rounded-xl">
                            <MapPin className="text-[var(--theme-primary)] shrink-0" />
                            <input 
                                placeholder="Location (Optional)" 
                                value={newEventLocation}
                                onChange={(e) => setNewEventLocation(e.target.value)}
                                className="bg-transparent w-full outline-none"
                            />
                        </div>
                        <div className="relative">
                            <select 
                                value={selectedCrewId}
                                onChange={(e) => setSelectedCrewId(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 p-4 rounded-xl outline-none appearance-none pr-10"
                            >
                                <option value="">No Crew (Direct Invite)</option>
                                {crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                        </div>
                        <button 
                            onClick={handleCreateEvent}
                            disabled={creatingEvent || !newEventTitle}
                            className="w-full bg-rose-500 text-white font-black py-4 rounded-xl mt-4 disabled:opacity-50 hover:bg-rose-600 transition-colors"
                        >
                            {creatingEvent ? "Creating..." : "Create Event"}
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* CREW MANAGER MODAL */}
      <AnimatePresence>
        {showCrewManager && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <motion.div 
                    initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl max-h-[80vh] flex flex-col"
                >
                    <div className="flex justify-between items-center mb-6 shrink-0">
                        <h2 className="text-xl font-bold">My Crews</h2>
                        <button onClick={() => setShowCrewManager(false)} className="p-2 bg-white/5 rounded-full"><X size={20}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                        {crews.length === 0 ? (
                            <p className="text-center text-slate-500 py-10">You aren't in any crews yet.</p>
                        ) : (
                            crews.map(crew => (
                                <Link key={crew.id} to={`/group/${crew.id}`} onClick={() => setShowCrewManager(false)}>
                                    <div className="p-4 bg-white/5 rounded-xl flex justify-between items-center hover:bg-white/10 border border-transparent hover:border-white/10 transition-all">
                                        <span className="font-bold">{crew.name}</span>
                                        <ChevronRight size={16} className="text-slate-500" />
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>

                    <div className="shrink-0 pt-4 border-t border-white/10">
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Create New Crew</h3>
                        <div className="flex gap-2">
                            <input 
                                placeholder="Crew Name" 
                                value={newCrewName}
                                onChange={(e) => setNewCrewName(e.target.value)}
                                className="flex-1 bg-black/30 border border-white/10 px-4 rounded-xl outline-none focus:border-[var(--theme-secondary)]"
                            />
                            <button 
                                onClick={handleCreateCrew}
                                disabled={creatingCrew || !newCrewName}
                                className="bg-indigo-500 text-white px-4 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-indigo-600 transition-colors"
                            >
                                {creatingCrew ? "..." : "Create"}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* SEARCH MOVIES OVERLAY */}
      <AnimatePresence>
        {showWatchlistSearch && (
          <SearchMovies
            eventId={null}
            groupId={null}
            onClose={() => setShowWatchlistSearch(false)}
            customAction={addToWatchlist}
            customRemoveAction={(m) => removeFromWatchlist(m.id)}
          />
        )}
      </AnimatePresence>

      {/* EXPANDED MOVIE CARD */}
      <AnimatePresence>
        {selectedMovie && (
            <ExpandedCard 
                movie={selectedMovie}
                onClose={() => setSelectedMovie(null)}
                onRemove={() => openRemoveModal(selectedMovie)}
                onNominate={() => openNominateModal(selectedMovie)}
            />
        )}
      </AnimatePresence>

      <DateTimePickerSheet
        show={showDateTimePicker}
        onClose={() => setShowDateTimePicker(false)}
        displayMonth={displayMonth}
        setDisplayMonth={setDisplayMonth}
        pickedDate={pickedDate}
        setPickedDate={setPickedDate}
        pickedTime={pickedTime}
        setPickedTime={setPickedTime}
        pickedPeriod={pickedPeriod}
        setPickedPeriod={setPickedPeriod}
        onConfirm={confirmDateTime}
      />

      {/* NOMINATE MODAL */}
      <AnimatePresence>
        {showNominateModal && (
            <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowNominateModal(false)}>
                <motion.div 
                    initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Nominate to...</h2>
                        <button onClick={() => setShowNominateModal(false)} className="p-2 bg-white/5 rounded-full"><X size={20}/></button>
                    </div>
                    {nominationError && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center">
                            {nominationError}
                        </div>
                    )}
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {futureEvents.length === 0 ? (
                            <p className="text-slate-500 text-center py-4">No upcoming events found.</p>
                        ) : (
                            <>
                                {futureEvents.filter(e => !nominatedEventIds.has(e.id)).map(evt => (
                                    <button
                                        key={evt.id}
                                        onClick={() => confirmNomination(evt.id)}
                                        className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-between transition-colors text-left"
                                    >
                                        <div>
                                            <div className="font-bold">{evt.title}</div>
                                            <div className="text-xs text-slate-400">{formatDateTime(evt.event_date)}</div>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-500" />
                                    </button>
                                ))}
                                {futureEvents.filter(e => nominatedEventIds.has(e.id)).length > 0 && (
                                    <>
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-4 mb-2 px-2">Already Nominated</div>
                                        {futureEvents.filter(e => nominatedEventIds.has(e.id)).map(evt => (
                                            <div
                                                key={evt.id}
                                                className="w-full p-4 bg-white/5 rounded-xl flex items-center justify-between opacity-50 cursor-not-allowed"
                                            >
                                                <div>
                                                    <div className="font-bold text-slate-400">{evt.title}</div>
                                                    <div className="text-xs text-slate-500">{formatDateTime(evt.event_date)}</div>
                                                </div>
                                                <Check size={16} className="text-green-500" />
                                            </div>
                                        ))}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* REMOVE CONFIRM MODAL */}
      <AnimatePresence>
        {showRemoveModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl text-center"
                >
                    <h2 className="text-xl font-bold mb-2">Remove from Watchlist?</h2>
                    <p className="text-slate-400 mb-6">Are you sure you want to remove "{movieToRemove?.title}"?</p>
                    <div className="flex gap-3">
                        <button onClick={() => setShowRemoveModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors">Cancel</button>
                        <button onClick={confirmRemove} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors">Remove</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ExpandedCard({ movie, onClose, onRemove, onNominate }) {
    const posterUrl = movie.poster_path ? `${POSTER_BASE_URL}${movie.poster_path}` : null
    
    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-lg max-h-[85vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col relative"
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
                <div className="absolute bottom-0 left-0 right-0 p-6 pt-12 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent flex justify-center gap-3 z-10">
                    <button onClick={onNominate} className="flex-1 h-12 rounded-xl border-2 flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 font-bold bg-indigo-500/20 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/30 hover:border-indigo-500">
                        <Plus size={18} /> Nominate
                    </button>
                    <button onClick={onRemove} className="flex-1 h-12 rounded-xl border-2 flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 font-bold bg-white/5 border-white/10 text-[var(--theme-primary)] hover:bg-rose-500/10 hover:border-[var(--theme-primary)]">
                        <Trash2 size={18} /> Remove
                    </button>
                </div>
            </motion.div>
            
            <button className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white/70 hover:text-white backdrop-blur-sm border border-white/10 z-20" onClick={onClose}>
                <X size={20} />
            </button>
        </div>
    )
}

export default Dashboard

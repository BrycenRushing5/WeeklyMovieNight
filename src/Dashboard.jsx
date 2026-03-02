import { useEffect, useState, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "./supabaseClient"
import SearchMovies from "./SearchMovies"
import { AnimatePresence, motion, useAnimationControls } from "framer-motion"
import { 
  LogOut, Plus, User, Home, Film, Lightbulb, 
  Settings, Filter, X, Calendar, MapPin, 
  ChevronRight, Star, Trash2, MoreHorizontal, Search,
  Users, Trophy, ChevronDown, Heart, Check, MessageSquare, ThumbsUp, Edit, CornerDownRight, ChevronLeft
} from "lucide-react"
import DateTimePickerSheet from "./DateTimePickerSheet"
import LoadingSpinner from './LoadingSpinner'
import RateMovie from './RateMovie'
import CrewsSheet from './CrewsSheet'
import PersonAvatar from './PersonAvatar'
import MoviePoster from './MoviePoster'

const DEFAULT_GENRES = ['Action', 'Adventure', 'Comedy', 'Documentary', 'Horror', 'Romance', 'Sci-Fi', 'Mystery & thriller', 'Fantasy']
const CAROUSEL_SPRING = { type: "spring", stiffness: 300, damping: 30 }
const EVENT_END_BUFFER_HOURS = 4
const EVENT_END_BUFFER_MS = EVENT_END_BUFFER_HOURS * 60 * 60 * 1000

function buildReviewPromptKey(eventId, movieId) {
  return `${eventId}:${movieId}`
}

function getStoredReviewPromptDismissals(userId) {
  if (!userId || typeof window === 'undefined') return new Set()

  try {
    const raw = window.localStorage.getItem(`review-prompt-dismissals:${userId}`)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch (error) {
    console.error('Error reading review prompt dismissals:', error)
    return new Set()
  }
}

function setStoredReviewPromptDismissals(userId, keys) {
  if (!userId || typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      `review-prompt-dismissals:${userId}`,
      JSON.stringify(Array.from(keys))
    )
  } catch (error) {
    console.error('Error storing review prompt dismissals:', error)
  }
}

function getEventDateMs(event) {
  if (!event?.event_date) return null
  const timestamp = new Date(event.event_date).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function getEventEndMs(event) {
  const eventDateMs = getEventDateMs(event)
  return eventDateMs === null ? null : eventDateMs + EVENT_END_BUFFER_MS
}

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
  const [reviewsByEventId, setReviewsByEventId] = useState(new Map())
  const [selectedMoviesById, setSelectedMoviesById] = useState(new Map())
  const [dismissedReviewPromptKeys, setDismissedReviewPromptKeys] = useState(new Set())
  
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
  const [activeRateEvent, setActiveRateEvent] = useState(null)
  
  // Filter State
  const [showFilters, setShowFilters] = useState(false)
  const [filterGenres, setFilterGenres] = useState([])
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

  // Feedback State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)

  // Date Picker
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)
  const [pickedDate, setPickedDate] = useState(null)
  const [pickedTime, setPickedTime] = useState("")
  const [pickedPeriod, setPickedPeriod] = useState("PM")
  const [displayMonth, setDisplayMonth] = useState(() => new Date())

  // Swipe Logic
  const carouselControls = useAnimationControls()
  const containerRef = useRef(null)
  const dragDirectionRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(window.innerWidth)
  
  // Tab Scroll Refs
  const ideasRef = useRef(null)
  const hubRef = useRef(null)
  const watchlistRef = useRef(null)
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0 })

  const userId = session?.user?.id
  const username = session?.user?.user_metadata?.username || session?.user?.user_metadata?.display_name || 'Movie Fan'
  const profileAvatarKey = session?.user?.user_metadata?.avatar_key || ''
  const profileAvatarUrl = session?.user?.user_metadata?.avatar_url || ''

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
        setContainerWidth(width)
        setDragConstraints({ left: -width * 2, right: 0 })
      }
    }
    updateConstraints()
    window.addEventListener('resize', updateConstraints)
    return () => window.removeEventListener('resize', updateConstraints)
  }, [])

  useEffect(() => {
    carouselControls.start({
      x: -activeIndex * containerWidth,
      transition: CAROUSEL_SPRING
    })
  }, [activeIndex, containerWidth, carouselControls])

  const loadEvents = async () => {
    setEventsLoading(true)
    const { data: groups } = await supabase.from("group_members").select("group_id").eq("user_id", userId)
    const groupIds = groups?.map(g => g.group_id) || []
    
    const { data: attending } = await supabase
      .from("event_attendees")
      .select("event_id")
      .eq("user_id", userId)
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

        const eventIds = sorted.map(event => event.id)
        const selectedMovieIds = Array.from(new Set(sorted.map(event => event.selected_movie_id).filter(Boolean)))
        const localDismissals = getStoredReviewPromptDismissals(userId)

        const [reviewResponse, movieResponse, dismissalResponse] = await Promise.all([
          eventIds.length > 0
            ? supabase.from('reviews').select('*').eq('user_id', userId).in('event_id', eventIds)
            : Promise.resolve({ data: [], error: null }),
          selectedMovieIds.length > 0
            ? supabase.from('movies').select('*').in('id', selectedMovieIds)
            : Promise.resolve({ data: [], error: null }),
          eventIds.length > 0
            ? supabase.from('review_prompt_dismissals').select('event_id, movie_id').eq('user_id', userId).in('event_id', eventIds)
            : Promise.resolve({ data: [], error: null })
        ])

        if (reviewResponse.error) {
          console.error('Error loading reviews:', reviewResponse.error)
        }

        if (movieResponse.error) {
          console.error('Error loading selected movies:', movieResponse.error)
        }

        if (dismissalResponse.error) {
          console.error('Error loading review prompt dismissals:', dismissalResponse.error)
        }

        const remoteDismissals = new Set(
          (dismissalResponse.data || []).map(row => buildReviewPromptKey(row.event_id, row.movie_id))
        )

        const mergedDismissals = new Set([...localDismissals, ...remoteDismissals])

        setReviewsByEventId(new Map((reviewResponse.data || []).map(review => [review.event_id, review])))
        setSelectedMoviesById(new Map((movieResponse.data || []).map(movie => [movie.id, movie])))
        setDismissedReviewPromptKeys(mergedDismissals)
      } else {
        setReviewsByEventId(new Map())
        setSelectedMoviesById(new Map())
        setDismissedReviewPromptKeys(new Set())
    }
    setEventsLoading(false)
  }

  const loadCrews = async () => {
    const { data: memberOf } = await supabase.from("group_members").select("group_id, groups(*)").eq("user_id", userId)
    
    const allCrews = new Map()
    memberOf?.forEach(m => {
        if (m.groups) allCrews.set(m.groups.id, m.groups)
    })
    
    setCrews(Array.from(allCrews.values()).sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })))
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

  const nowMs = Date.now()
  const futureEvents = events.filter(event => {
    const endMs = getEventEndMs(event)
    return endMs === null || endMs >= nowMs
  })
  const pastEvents = events.filter(event => {
    const endMs = getEventEndMs(event)
    return endMs !== null && endMs < nowMs
  }).reverse()
  
  const nextUp = futureEvents[0]
  const upcoming = futureEvents.slice(1)
  const shouldShowReviewPrompt = (event) => {
    if (!event?.selected_movie_id) return false
    const endMs = getEventEndMs(event)
    if (endMs === null || endMs >= nowMs) return false
    if (reviewsByEventId.has(event.id)) return false
    return !dismissedReviewPromptKeys.has(buildReviewPromptKey(event.id, event.selected_movie_id))
  }
  const reviewPromptEvents = pastEvents.filter(shouldShowReviewPrompt)
  const archivedPastEvents = pastEvents.filter(event => !shouldShowReviewPrompt(event))

  const filteredWatchlist = watchlist.filter(m => {
    if (!m) return false
    const title = m.title ? m.title.toLowerCase() : ''
    const search = watchSearchTerm.toLowerCase()
    const matchSearch = !search || title.includes(search)
    const movieGenres = Array.isArray(m.genre) ? m.genre : (m.genre ? [m.genre] : [])
    const matchGenre = filterGenres.length === 0 || filterGenres.some(genre => movieGenres.includes(genre))
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
    const crewName = newCrewName.trim()
    if (!crewName) return
    setCreatingCrew(true)

    try {
      const { data: group, error } = await supabase
        .from("groups")
        .insert([{
          name: crewName,
          created_by: userId
        }])
        .select()
        .single()

      if (error) throw error
      if (!group?.id) throw new Error("Crew was created without an id.")

      const { error: membershipError } = await supabase
        .from("group_members")
        .upsert([{
          group_id: group.id,
          user_id: userId
        }], { onConflict: 'group_id,user_id' })

      if (membershipError) throw membershipError

      setNewCrewName("")
      await loadCrews()
      setShowCrewManager(false)
      navigate(`/group/${group.id}`)
      return group
    } catch (error) {
      console.error("Error creating crew:", error)
      alert(error?.message || "Could not create crew.")
      return null
    } finally {
      setCreatingCrew(false)
    }
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

  const removeFromWatchlist = async (movieId) => {
    setWatchlist(prev => prev.filter(movie => movie?.id !== movieId))
    if (selectedMovie?.id === movieId) setSelectedMovie(null)

    const { error } = await supabase
      .from("user_wishlist")
      .delete()
      .eq("user_id", userId)
      .eq("movie_id", movieId)

    if (error) {
      console.error("Error removing from watchlist:", error)
      loadWatchlist()
    }
  }

  const dismissReviewPrompt = async (event) => {
    if (!userId || !event?.selected_movie_id) return

    const key = buildReviewPromptKey(event.id, event.selected_movie_id)
    const nextDismissals = new Set(dismissedReviewPromptKeys)
    nextDismissals.add(key)
    setDismissedReviewPromptKeys(nextDismissals)
    setStoredReviewPromptDismissals(userId, nextDismissals)

    const { error } = await supabase
      .from('review_prompt_dismissals')
      .upsert([{
        event_id: event.id,
        user_id: userId,
        movie_id: event.selected_movie_id,
        dismissed_at: new Date().toISOString()
      }], { onConflict: 'event_id,user_id,movie_id' })

    if (error) {
      console.error('Error dismissing review prompt:', error)
    }
  }

  const handleReviewSaved = (review) => {
    setReviewsByEventId(prev => {
      const next = new Map(prev)
      next.set(review.event_id, review)
      return next
    })
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
  const handleDragStart = () => {
    dragDirectionRef.current = null
  }

  const handleDirectionLock = (direction) => {
    dragDirectionRef.current = direction
  }

  const handleDragEnd = (e, { offset, velocity }) => {
    const swipe = offset.x
    const swipeY = offset.y
    const threshold = 50
    const velocityThreshold = 500
    const horizontalTravel = Math.abs(swipe)
    const verticalTravel = Math.abs(swipeY)
    const horizontalVelocity = Math.abs(velocity.x)
    const verticalVelocity = Math.abs(velocity.y)
    const isHorizontalGesture =
      dragDirectionRef.current === 'x' ||
      (dragDirectionRef.current === null && horizontalTravel > verticalTravel * 1.25)

    dragDirectionRef.current = null

    if (!isHorizontalGesture) {
      carouselControls.start({
        x: -activeIndex * containerWidth,
        transition: CAROUSEL_SPRING
      })
      return
    }

    let nextIndex = activeIndex

    if ((swipe < -threshold || (velocity.x < -velocityThreshold && horizontalVelocity > verticalVelocity * 1.25)) && activeIndex < 2) {
      nextIndex = activeIndex + 1
    } else if ((swipe > threshold || (velocity.x > velocityThreshold && horizontalVelocity > verticalVelocity * 1.25)) && activeIndex > 0) {
      nextIndex = activeIndex - 1
    }

    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex)
    } else {
      carouselControls.start({
        x: -activeIndex * containerWidth,
        transition: CAROUSEL_SPRING
      })
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
            <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="rounded-full transition-colors">
                <PersonAvatar
                  name={username}
                  avatarKey={profileAvatarKey}
                  avatarUrl={profileAvatarUrl}
                  size={40}
                  className="border-white/10 bg-slate-800"
                  initialsClassName="text-sm"
                />
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
                    <button onClick={() => navigate('/profile')} className="w-full text-left px-4 py-3 flex items-center gap-2 text-sm font-semibold">
                        <User size={16} className="text-indigo-300" /> Profile
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button onClick={() => supabase.auth.signOut()} className="w-full text-left px-4 py-3 flex items-center gap-2 text-sm font-semibold text-white">
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
            animate={carouselControls}
            drag="x"
            dragConstraints={dragConstraints}
            dragDirectionLock
            dragMomentum={false}
            onDragStart={handleDragStart}
            onDirectionLock={handleDirectionLock}
            onDragEnd={handleDragEnd}
            initial={false}
        >
            {/* --- IDEAS TAB (Index 0) --- */}
            <div ref={ideasRef} className="w-[100vw] h-full overflow-y-auto px-4 pb-24 scrollbar-hide">
                <div className="flex flex-col items-center justify-center h-[70vh] max-w-md mx-auto">
                    <div className="w-20 h-20 bg-[var(--theme-accent)]/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(251,191,36,0.2)]">
                        <Lightbulb size={40} className="text-amber-400" />
                    </div>
                    <h2 className="text-3xl font-black mb-3 text-center">Ideas & Feedback</h2>
                    <p className="text-slate-400 text-center mb-8 text-sm leading-relaxed px-6">
                        Help us improve the app! Submit your ideas for new features or feedback on your experience.
                    </p>
                    <button
                        onClick={() => setShowFeedbackModal(true)}
                        className="bg-amber-400 text-black font-black py-4 px-8 rounded-xl shadow-lg transition-colors active:scale-95"
                    >
                        Improve the App
                    </button>
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
                                            <div className="absolute inset-0 bg-gradient-to-br from-[var(--theme-primary)] via-black/50 to-black/80 transition-transform duration-700" />
                                            <div className="absolute inset-0 p-5 flex flex-col justify-end">
                                                <div className="flex items-end justify-between gap-4">
                                                    <div>
                                                        <h3 className="text-2xl font-black leading-none mb-2">{nextUp.title}</h3>
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-black/30 px-2 py-1 rounded-lg w-fit backdrop-blur-sm">
                                                            <Calendar size={12} /> {formatDateTime(nextUp.event_date)}
                                                        </div>
                                                    </div>
                                                    <div className="bg-[var(--theme-primary)] text-white text-xs font-bold px-4 py-2 rounded-full shrink-0 transition-colors">
                                                        See Details
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ) : (
                                    <div className="p-6 rounded-2xl border border-dashed border-white/10 text-center">
                                        <p className="text-slate-500 text-sm">No upcoming events.</p>
                                        <button onClick={() => setShowCreateEvent(true)} className="mt-2 text-[var(--theme-primary)] text-sm font-bold">Plan one now</button>
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
                                                <div className="flex items-center gap-4 p-4 bg-slate-900/50 border border-white/5 rounded-xl transition-colors">
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
                                    <div className="space-y-3">
                                        {reviewPromptEvents.map(event => {
                                            const selectedMovie = selectedMoviesById.get(event.selected_movie_id)
                                            return (
                                                <div key={event.id} className="p-4 bg-slate-900/60 border border-amber-500/20 rounded-xl shadow-[0_0_20px_rgba(251,191,36,0.08)]">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="min-w-0">
                                                            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.2em] mb-1">Watched It?</div>
                                                            <h4 className="font-bold text-white truncate">{event.title}</h4>
                                                            <p className="text-xs text-slate-400 mt-1">
                                                                {selectedMovie?.title
                                                                  ? `Leave a quick rating for ${selectedMovie.title}.`
                                                                  : 'Leave a quick rating for this movie night.'}
                                                            </p>
                                                            <div className="text-[11px] text-slate-500 mt-2">
                                                                Ended {new Date(event.event_date).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                        {selectedMovie && (
                                                            <MoviePoster
                                                                title={selectedMovie.title}
                                                                posterPath={selectedMovie.poster_path}
                                                                className="w-14 shrink-0 aspect-[2/3] rounded-lg border border-white/10"
                                                                iconSize={16}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="mt-4 flex gap-2">
                                                        <button
                                                            onClick={() => setActiveRateEvent(event)}
                                                            className="flex-1 py-2.5 rounded-lg bg-amber-400 text-black text-sm font-black transition-colors"
                                                        >
                                                            Rate Movie
                                                        </button>
                                                        <button
                                                            onClick={() => dismissReviewPrompt(event)}
                                                            className="px-4 py-2.5 rounded-lg bg-white/5 text-slate-300 text-sm font-bold transition-colors"
                                                        >
                                                            Dismiss
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {archivedPastEvents.length > 0 && (
                                            <div className="space-y-3 opacity-60 transition-opacity">
                                                {archivedPastEvents.map(event => (
                                                    <Link key={event.id} to={`/room/${event.id}`}>
                                                        <div className="flex items-center justify-between p-3 bg-slate-900/30 border border-white/5 rounded-lg">
                                                            <span className="font-medium text-sm text-slate-300">{event.title}</span>
                                                            <span className="text-xs text-slate-500">{new Date(event.event_date).toLocaleDateString()}</span>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
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
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
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
                                        onClick={() => setFilterGenres([])}
                                        className={`px-3 py-1 rounded-full text-xs font-bold border ${filterGenres.length === 0 ? 'bg-white text-black border-white' : 'border-white/10 text-slate-400'}`}
                                    >
                                        All
                                    </button>
                                    {DEFAULT_GENRES.map(g => (
                                        <button 
                                            key={g}
                                            onClick={() => setFilterGenres(prev => prev.includes(g) ? prev.filter(genre => genre !== g) : [...prev, g])}
                                            className={`px-3 py-1 rounded-full text-xs font-bold border ${filterGenres.includes(g) ? 'bg-[var(--theme-secondary)] text-white border-[var(--theme-secondary)]' : 'border-white/10 text-slate-400'}`}
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
                                <button onClick={() => setShowWatchlistSearch(true)} className="mt-2 text-[var(--theme-secondary)] text-sm font-bold">Add a movie</button>
                            </div>
                        ) : (
                            filteredWatchlist.map(movie => (
                                <div 
                                    key={movie.id} 
                                    onClick={() => setSelectedMovie(movie)}
                                    className="flex gap-3 p-3 bg-slate-900/40 border border-white/5 rounded-xl group cursor-pointer transition-colors"
                                >
                                    <MoviePoster
                                        title={movie.title}
                                        posterPath={movie.poster_path}
                                        className="w-20 shrink-0 aspect-[2/3] rounded-lg shadow-lg"
                                        iconSize={20}
                                    />
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
                                                className="flex-1 py-2 bg-indigo-500/10 text-indigo-400 rounded-lg text-xs font-bold transition-colors"
                                            >
                                                Nominate
                                            </button>
                                            <button 
                                                onPointerDownCapture={(e) => e.stopPropagation()}
                                                onClick={(e) => { e.stopPropagation(); openRemoveModal(movie) }}
                                                className="flex-1 py-2 bg-white/5 rounded-lg text-xs font-bold transition-colors"
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
                        className="w-14 h-14 rounded-full bg-[var(--theme-primary)] text-white flex items-center justify-center shadow-[0_0_20px_rgba(225,29,72,0.5)] transition-colors"
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
                            <button onClick={() => { setShowCreateEvent(true); setShowPlusMenu(false) }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm font-bold">
                                <Calendar size={18} className="text-[var(--theme-secondary)]" /> Create Event
                            </button>
                            <button onClick={() => { setShowCrewManager(true); setShowPlusMenu(false) }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm font-bold">
                                <Users size={18} className="text-purple-400" /> Crews
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
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${activeIndex === 0 ? 'text-[var(--theme-accent)]' : 'text-slate-500'}`}
            >
                <Lightbulb size={24} strokeWidth={activeIndex === 0 ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Ideas</span>
            </button>
            <button 
                onClick={() => setActiveIndex(1)}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${activeIndex === 1 ? 'text-[var(--theme-primary)]' : 'text-slate-500'}`}
            >
                <Home size={24} strokeWidth={activeIndex === 1 ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Hub</span>
            </button>
            <button 
                onClick={() => setActiveIndex(2)}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${activeIndex === 2 ? 'text-[var(--theme-secondary)]' : 'text-slate-500'}`}
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
                            className="w-full flex items-center gap-3 bg-white/5 p-4 rounded-xl text-left"
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
                            className="w-full bg-rose-500 text-white font-black py-4 rounded-xl mt-4 disabled:opacity-50 transition-colors"
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
          <CrewsSheet
            crews={crews}
            userId={userId}
            newCrewName={newCrewName}
            setNewCrewName={setNewCrewName}
            onCreateCrew={handleCreateCrew}
            creatingCrew={creatingCrew}
            onClose={() => setShowCrewManager(false)}
          />
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
                                        className="w-full p-4 bg-white/5 rounded-xl flex items-center justify-between transition-colors text-left"
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

      {/* FEEDBACK MODAL */}
      <AnimatePresence>
        {showFeedbackModal && (
            <FeedbackModal userId={userId} onClose={() => setShowFeedbackModal(false)} />
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
                        <button onClick={() => setShowRemoveModal(false)} className="flex-1 py-3 bg-white/5 rounded-xl font-bold transition-colors">Cancel</button>
                        <button onClick={confirmRemove} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold transition-colors">Remove</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeRateEvent && selectedMoviesById.get(activeRateEvent.selected_movie_id) && (
          <RateMovie
            eventId={activeRateEvent.id}
            movie={selectedMoviesById.get(activeRateEvent.selected_movie_id)}
            existingReview={reviewsByEventId.get(activeRateEvent.id) || null}
            onSaved={handleReviewSaved}
            onClose={() => setActiveRateEvent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ExpandedCard({ movie, onClose, onRemove, onNominate }) {
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
                <div className="absolute bottom-0 left-0 right-0 p-6 pt-12 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent flex justify-center gap-3 z-10">
                    <button onClick={onNominate} className="flex-1 h-12 rounded-xl border-2 flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 font-bold bg-indigo-500/20 border-indigo-500/50 text-indigo-400">
                        <Plus size={18} /> Nominate
                    </button>
                    <button onClick={onRemove} className="flex-1 h-12 rounded-xl border-2 flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 font-bold bg-white/5 border-white/10 text-[var(--theme-primary)]">
                        <Trash2 size={18} /> Remove
                    </button>
                </div>
            </motion.div>
            
            <button className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white/70 backdrop-blur-sm border border-white/10 z-20" onClick={onClose}>
                <X size={20} />
            </button>
        </div>
    )
}

function FeedbackModal({ userId, onClose }) {
    const [view, setView] = useState('list') // list, form, detail
    const [items, setItems] = useState([])
    const [myVotes, setMyVotes] = useState(new Set())
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // all, mine
    const [activeItem, setActiveItem] = useState(null)
    const [comments, setComments] = useState([])
    const [newComment, setNewComment] = useState('')
    const [commentLoading, setCommentLoading] = useState(false)
    const [editingCommentId, setEditingCommentId] = useState(null)
    const [editCommentContent, setEditCommentContent] = useState('')

    // Form State
    const [formData, setFormData] = useState({ type: 'idea', content: '', importance: 5 })
    const [submitting, setSubmitting] = useState(false)
    const [editingId, setEditingId] = useState(null)

    useEffect(() => {
        fetchFeedback()
    }, [])

    useEffect(() => {
        if (activeItem) fetchComments(activeItem.id)
    }, [activeItem])

    const fetchFeedback = async () => {
        setLoading(true)
        const { data: feedbackData } = await supabase
            .from('app_feedback')
            .select(`
                *,
                votes:app_feedback_votes(count),
                comments:app_feedback_comments(count)
            `)
            .order('created_at', { ascending: false })
        
        const { data: myVoteData } = await supabase
            .from('app_feedback_votes')
            .select('feedback_id')
            .eq('user_id', userId)
        
        if (feedbackData) setItems(feedbackData)
        if (myVoteData) setMyVotes(new Set(myVoteData.map(v => v.feedback_id)))
        setLoading(false)
    }

    const fetchComments = async (feedbackId) => {
        setCommentLoading(true)
        const { data } = await supabase
            .from('app_feedback_comments')
            .select('*')
            .eq('feedback_id', feedbackId)
            .order('created_at', { ascending: true })
        setComments(data || [])
        setCommentLoading(false)
    }

    const handleVote = async (e, item) => {
        e.stopPropagation()
        const isVoted = myVotes.has(item.id)
        
        // Optimistic update
        setMyVotes(prev => {
            const next = new Set(prev)
            if (isVoted) next.delete(item.id)
            else next.add(item.id)
            return next
        })
        
        // Update items list
        setItems(prev => prev.map(i => {
            if (i.id === item.id) {
                const currentCount = i.votes?.[0]?.count || 0
                return { ...i, votes: [{ count: isVoted ? currentCount - 1 : currentCount + 1 }] }
            }
            return i
        }))

        // Update active item if it matches
        if (activeItem && activeItem.id === item.id) {
             setActiveItem(prev => {
                 const currentCount = prev.votes?.[0]?.count || 0
                 return { ...prev, votes: [{ count: isVoted ? currentCount - 1 : currentCount + 1 }] }
             })
        }

        if (isVoted) {
            await supabase.from('app_feedback_votes').delete().eq('feedback_id', item.id).eq('user_id', userId)
        } else {
            await supabase.from('app_feedback_votes').insert([{ feedback_id: item.id, user_id: userId }])
        }
    }

    const handleSubmit = async () => {
        if (!formData.content.trim()) return
        setSubmitting(true)
        document.activeElement.blur()
        
        const payload = {
            user_id: userId,
            type: formData.type,
            content: formData.content,
            importance: formData.importance
        }

        let error
        if (editingId) {
            const { error: updateError } = await supabase
                .from('app_feedback')
                .update(payload)
                .eq('id', editingId)
            error = updateError
        } else {
            const { error: insertError } = await supabase
                .from('app_feedback')
                .insert([payload])
            error = insertError
        }

        setSubmitting(false)
        if (error) {
            alert("Error: " + error.message)
        } else {
            setFormData({ type: 'idea', content: '', importance: 5 })
            setEditingId(null)
            setView('list')
            fetchFeedback()
        }
    }

    const handleUpdateComment = async (commentId) => {
        if (!editCommentContent.trim()) return
        const { error } = await supabase
            .from('app_feedback_comments')
            .update({ content: editCommentContent.trim() })
            .eq('id', commentId)
        
        if (error) {
            alert("Error updating comment: " + error.message)
        } else {
            setEditingCommentId(null)
            setEditCommentContent('')
            fetchComments(activeItem.id)
        }
    }

    const handleEdit = (item) => {
        setFormData({
            type: item.type,
            content: item.content,
            importance: item.importance
        })
        setEditingId(item.id)
        setView('form')
    }

    const handleDelete = async (itemId) => {
        if (!confirm("Delete this submission?")) return
        await supabase.from('app_feedback').delete().eq('id', itemId)
        setItems(prev => prev.filter(i => i.id !== itemId))
        if (activeItem?.id === itemId) {
            setActiveItem(null)
            setView('list')
        }
    }

    const handlePostComment = async () => {
        if (!newComment.trim() || !activeItem) return
        document.activeElement.blur()
        const { error } = await supabase.from('app_feedback_comments').insert([{
            feedback_id: activeItem.id,
            user_id: userId,
            content: newComment.trim()
        }])
        
        if (!error) {
            setNewComment('')
            fetchComments(activeItem.id)
            // Update comment count in list
            setItems(prev => prev.map(i => {
                if (i.id === activeItem.id) {
                    const current = i.comments?.[0]?.count || 0
                    return { ...i, comments: [{ count: current + 1 }] }
                }
                return i
            }))
        }
    }

    const filteredItems = filter === 'mine' ? items.filter(i => i.user_id === userId) : items

    return (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <motion.div 
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-white/5 shrink-0">
                    {view === 'list' ? (
                        <h2 className="text-xl font-bold">Feedback Hub</h2>
                    ) : (
                        <button onClick={() => { setView('list'); setActiveItem(null); setEditingId(null); setFormData({ type: 'idea', content: '', importance: 5 }) }} className="p-2 -ml-2 rounded-full text-slate-400 transition-colors">
                            <ChevronLeft size={24} />
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X size={20}/></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {view === 'list' && (
                        <>
                            <div className="flex gap-2 mb-4">
                                <button onClick={() => setFilter('all')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${filter === 'all' ? 'bg-white text-black' : 'bg-white/5 text-slate-400'}`}>All</button>
                                <button onClick={() => setFilter('mine')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${filter === 'mine' ? 'bg-white text-black' : 'bg-white/5 text-slate-400'}`}>My Posts</button>
                            </div>

                            <button 
                                onClick={() => { setView('form'); setEditingId(null); setFormData({ type: 'idea', content: '', importance: 5 }) }}
                                className="w-full py-3 mb-4 border border-dashed border-white/20 rounded-xl text-slate-400 flex items-center justify-center gap-2 font-bold"
                            >
                                <Plus size={18} /> Submit New Idea
                            </button>

                            <div className="space-y-3">
                                {loading ? <LoadingSpinner compact /> : filteredItems.length === 0 ? (
                                    <p className="text-center text-slate-500 py-8">No feedback found.</p>
                                ) : (
                                    filteredItems.map(item => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => { setActiveItem(item); setView('detail') }}
                                            className="bg-white/5 rounded-xl p-4 border border-white/5 transition-colors cursor-pointer"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${item.type === 'idea' ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                                    {item.type === 'idea' ? '💡 Idea' : '💬 Feedback'}
                                                </span>
                                                {item.user_id === userId && (
                                                    <div className="flex gap-2">
                                                        <button onClick={(e) => { e.stopPropagation(); handleEdit(item) }} className="text-slate-500"><Edit size={14} /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }} className="text-slate-500"><Trash2 size={14} /></button>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-200 mb-3 line-clamp-3">{item.content}</p>
                                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                                <button 
                                                    onClick={(e) => handleVote(e, item)}
                                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors ${myVotes.has(item.id) ? 'bg-indigo-500/20 text-indigo-400' : ''}`}
                                                >
                                                    <ThumbsUp size={14} className={myVotes.has(item.id) ? "fill-current" : ""} /> {item.votes?.[0]?.count || 0}
                                                </button>
                                                <div className="flex items-center gap-1.5">
                                                    <MessageSquare size={14} /> {item.comments?.[0]?.count || 0}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {view === 'form' && (
                        <div className="space-y-5">
                            <div className="flex bg-black/30 p-1 rounded-xl">
                                <button 
                                    onClick={() => setFormData({...formData, type: 'idea'})}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${formData.type === 'idea' ? 'bg-amber-400 text-black shadow-lg' : 'text-slate-400'}`}
                                >
                                    💡 Idea
                                </button>
                                <button 
                                    onClick={() => setFormData({...formData, type: 'feedback'})}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${formData.type === 'feedback' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400'}`}
                                >
                                    💬 Feedback
                                </button>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                                    {formData.type === 'idea' ? 'What should we build?' : 'What\'s on your mind?'}
                                </label>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                                    placeholder={formData.type === 'idea' ? "I think it would be cool if..." : "I noticed that..."}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-base text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 min-h-[150px] resize-none"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Importance</label>
                                    <span className="text-sm font-bold text-amber-400">{formData.importance}/10</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" max="100"
                                    value={formData.importance * 10}
                                    onChange={(e) => setFormData({...formData, importance: Math.round(e.target.value / 10) || 1})}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                                    style={{ background: `linear-gradient(to right, #fbbf24 ${formData.importance * 10}%, #1e293b ${formData.importance * 10}%)` }}
                                />
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !formData.content.trim()}
                                className="w-full bg-amber-400 text-black font-black py-3.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Saving...' : (editingId ? 'Update' : 'Submit')}
                            </button>
                        </div>
                    )}

                    {view === 'detail' && activeItem && (
                        <div className="flex flex-col h-full">
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${activeItem.type === 'idea' ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                        {activeItem.type === 'idea' ? '💡 Idea' : '💬 Feedback'}
                                    </span>
                                    <span className="text-xs text-slate-500">• Importance: {activeItem.importance}/10</span>
                                </div>
                                <p className="text-base text-white leading-relaxed whitespace-pre-wrap">{activeItem.content}</p>
                                
                                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
                                    <button 
                                        onClick={(e) => handleVote(e, activeItem)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors ${myVotes.has(activeItem.id) ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-slate-300'}`}
                                    >
                                        <ThumbsUp size={16} className={myVotes.has(activeItem.id) ? "fill-current" : ""} /> 
                                        {activeItem.votes?.[0]?.count || 0}
                                    </button>
                                    {activeItem.user_id === userId && (
                                        <button onClick={() => handleDelete(activeItem.id)} className="ml-auto text-xs text-red-400">Delete Post</button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col min-h-0">
                                <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Comments</h3>
                                <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                                    {commentLoading ? <LoadingSpinner compact /> : comments.length === 0 ? (
                                        <p className="text-sm text-slate-600 italic">No comments yet.</p>
                                    ) : (
                                        comments.map(comment => (
                                            <div key={comment.id} className={`p-3 rounded-xl text-sm ${comment.user_id === userId ? 'bg-indigo-500/10 border border-indigo-500/20 ml-4' : 'bg-white/5 mr-4'}`}>
                                                {editingCommentId === comment.id ? (
                                                    <div className="flex flex-col gap-2">
                                                        <textarea 
                                                            value={editCommentContent}
                                                            onChange={(e) => setEditCommentContent(e.target.value)}
                                                            className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
                                                            rows={2}
                                                            autoFocus
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => setEditingCommentId(null)} className="text-xs font-bold text-slate-500 px-2 py-1">Cancel</button>
                                                            <button onClick={() => handleUpdateComment(comment.id)} className="text-xs font-bold bg-indigo-500 text-white px-3 py-1 rounded-lg">Save</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="group">
                                                        <p className="text-slate-200">{comment.content}</p>
                                                        {comment.user_id === userId && (
                                                            <button 
                                                                onClick={() => { setEditingCommentId(comment.id); setEditCommentContent(comment.content) }}
                                                                className="text-[10px] font-bold text-slate-500 mt-2 flex items-center gap-1 opacity-0 transition-opacity"
                                                            >
                                                                <Edit size={10} /> Edit
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="flex gap-2 mt-auto">
                                    <input 
                                        placeholder="Add a comment..." 
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-base focus:border-indigo-500 outline-none"
                                    />
                                    <button 
                                        onClick={handlePostComment}
                                        disabled={!newComment.trim()}
                                        className="bg-indigo-500 text-white p-3 rounded-xl disabled:opacity-50"
                                    >
                                        <CornerDownRight size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    )
}

export default Dashboard

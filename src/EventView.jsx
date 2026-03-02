import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, MapPin, MoreHorizontal, PlayCircle, Plus, ThumbsUp, Film, Users, Trash2, LogOut, Edit, AlertTriangle, Clock, Link as LinkIcon, Check, X, ChevronRight, ChevronLeft, Trophy, Star } from 'lucide-react'
import DateTimePickerSheet from './DateTimePickerSheet'
import LoadingSpinner from './LoadingSpinner'
import RateMovie from './RateMovie'
import PeoplePickerSheet from './PeoplePickerSheet'
import PersonAvatar from './PersonAvatar'
import { loadGroupPeople, loadRecentPeople } from './peopleSearch'
import MoviePoster from './MoviePoster'

export default function EventView() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [editedEventDate, setEditedEventDate] = useState('')
  const [editedLocationAddress, setEditedLocationAddress] = useState('')
  const [attendees, setAttendees] = useState([])
  const [attendeesLoading, setAttendeesLoading] = useState(true)
  const [nominations, setNominations] = useState([])
  const [nominationsLoading, setNominationsLoading] = useState(true)
  const [nominationsError, setNominationsError] = useState('')
  const [userId, setUserId] = useState(null)
  const [myNominationsCount, setMyNominationsCount] = useState(0)
  const [totalNominations, setTotalNominations] = useState(0)
  const [myVotesCount, setMyVotesCount] = useState(0)
  const [groupShareCode, setGroupShareCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [showAddAudience, setShowAddAudience] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [showMapOptions, setShowMapOptions] = useState(false)
  const [selectedAttendee, setSelectedAttendee] = useState(null)
  const [sharedEventCount, setSharedEventCount] = useState(0)
  const [loadingSharedEvents, setLoadingSharedEvents] = useState(false)
  const [winningMovie, setWinningMovie] = useState(null)
  const [userReview, setUserReview] = useState(null)
  const [showRateModal, setShowRateModal] = useState(false)
  const [showFeatureModal, setShowFeatureModal] = useState(false)
  
  // Date Picker State
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)
  const [pickedDate, setPickedDate] = useState(null)
  const [pickedTime, setPickedTime] = useState('')
  const [pickedPeriod, setPickedPeriod] = useState('PM')
  const [displayMonth, setDisplayMonth] = useState(() => new Date())

  useEffect(() => {
    let active = true

    async function loadAll() {
      if (!code) return
      setLoading(true)
      setError('')

      const { data: authData } = await supabase.auth.getUser()
      const currentUserId = authData?.user?.id || null
      if (active) setUserId(currentUserId)

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', code)
        .single()

      if (!active) return

      if (eventError) {
        setError('Could not load event.')
        setEvent(null)
        setLoading(false)
        return
      }

      setEvent(eventData)

      if (eventData?.group_id) {
        const { data: groupData } = await supabase
          .from('groups')
          .select('share_code')
          .eq('id', eventData.group_id)
          .single()
        if (active) setGroupShareCode(groupData?.share_code || '')
      } else if (active) {
        setGroupShareCode('')
      }

      setAttendeesLoading(true)
      const { data: attendeeData } = await supabase
        .from('event_attendees')
        .select('user_id, profiles(*)')
        .eq('event_id', code)
      if (active) {
        const list = (attendeeData || []).map((row) => ({
          id: row.user_id,
          name: row.profiles?.display_name || row.profiles?.username || 'Movie Fan',
          username: row.profiles?.username || '',
          avatarKey: row.profiles?.avatar_key || '',
          avatarUrl: row.profiles?.avatar_url || '',
        }))
        setAttendees(list)
        setAttendeesLoading(false)
      }

      setNominationsLoading(true)
      setNominationsError('')
      const { data: nominationsData, error: nominationsLoadError } = await supabase
        .from('nominations')
        .select('id, nominated_by, movie:movies (*)')
        .eq('event_id', code)

      if (active) {
        if (nominationsLoadError) {
          setNominationsError('Unable to load nominations.')
          setNominations([])
          setTotalNominations(0)
          setMyNominationsCount(0)
        } else {
          const list = nominationsData || []
          setNominations(list.map((row) => row.movie).filter(Boolean))
          setTotalNominations(list.length)
          if (currentUserId) {
            setMyNominationsCount(list.filter((row) => row.nominated_by === currentUserId).length)
          } else {
            setMyNominationsCount(0)
          }
        }
        setNominationsLoading(false)
      }

      if (currentUserId) {
        const { count } = await supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', code)
          .eq('user_id', currentUserId)
        
        if (active) setMyVotesCount(count || 0)
      } else if (active) {
        setMyVotesCount(0)
      }

      // Fetch Selected Movie & User Review
      if (eventData.selected_movie_id) {
        const { data: movieData } = await supabase
            .from('movies')
            .select('*')
            .eq('id', eventData.selected_movie_id)
            .single()
        if (active) setWinningMovie(movieData)

        if (currentUserId && eventData.selected_movie_id) {
            const { data: reviewData } = await supabase
                .from('reviews')
                .select('*')
                .eq('event_id', code)
                .eq('user_id', currentUserId)
                .maybeSingle()
            if (active) setUserReview(reviewData)
        }
      }

      if (active) setLoading(false)
    }

    loadAll()

    return () => {
      active = false
    }
  }, [code])

  useEffect(() => {
    if (event) {
      setEditedTitle(event.title || '')
      setEditedEventDate(event.event_date || '')
      setEditedLocationAddress(event.location_address || '')
    }
  }, [event])

  const formatDateTimeLabel = (value) => {
    if (!value) return "Pick date & time"
    const date = new Date(value)
    if (isNaN(date.getTime())) return "Pick date & time"
    return date.toLocaleString([], { weekday: "short", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })
  }

  const formatDateTime = (value) => {
    if (!value) return 'No date set'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'No date set'
    return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const inviteLink = code 
    ? (groupShareCode ? `${window.location.origin}/join/${groupShareCode}?eventId=${code}&addToGroup=0` : `${window.location.origin}/room/${code}`)
    : ''

  const handleSaveEdit = async () => {
    try {
      if (!editedEventDate) return alert("Please set a date for the event.")
      const { data, error } = await supabase
        .from('events')
        .update({
          title: editedTitle,
          event_date: editedEventDate,
          location_address: editedLocationAddress,
        })
        .eq('id', code)
        .select()

      if (error) {
        throw error
      }

      setEvent(data[0])
      setIsEditing(false)
      setError('')
    } catch (error) {
      console.error('Error saving event:', error)
      setError('Error saving event details.')
    }
  }

  const handleCancelEdit = () => {
    setEditedTitle(event?.title || '')
    setEditedEventDate(event?.event_date || '')
    setEditedLocationAddress(event?.location_address || '')
    setIsEditing(false)
  }

  const openDateTimePicker = () => {
    const existing = editedEventDate ? new Date(editedEventDate) : null
    if (!existing) {
      // Default to 7 PM today if no date set
      const now = new Date()
      now.setHours(19, 0, 0, 0)
      setPickedDate(now)
      setPickedTime("19:00")
      setPickedPeriod("PM")
      setDisplayMonth(new Date(now.getFullYear(), now.getMonth(), 1))
      setShowDateTimePicker(true)
      return
    }
    setPickedDate(existing)
    setPickedTime(`${String(existing.getHours()).padStart(2, "0")}:${String(existing.getMinutes()).padStart(2, "0")}`)
    setPickedPeriod(existing.getHours() >= 12 ? "PM" : "AM")
    setDisplayMonth(new Date(existing.getFullYear(), existing.getMonth(), 1))
    setShowDateTimePicker(true)
  }

  const confirmDateTime = () => {
    if (!pickedDate || !pickedTime) return
    const [hh, mm] = pickedTime.split(":").map(Number)
    const composed = new Date(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate(), hh, mm, 0, 0)
    setEditedEventDate(composed.toISOString())
    setShowDateTimePicker(false)
  }

  const handleCopyInvite = async () => {
    if (!inviteLink) return
    try {
      await copyToClipboard(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  const handleDeleteEvent = async () => {
    if (!code) return
    if (event?.created_by !== userId) {
      alert('Only the creator can delete this event.')
      return
    }
    setIsDeleting(true)
    
    // Manually delete dependencies to avoid FK constraints
    await supabase.from('events').update({ selected_nomination_id: null, selected_movie_id: null }).eq('id', code)
    await supabase.from('votes').delete().eq('event_id', code)
    await supabase.from('nominations').delete().eq('event_id', code)
    await supabase.from('event_attendees').delete().eq('event_id', code)
    await supabase.from('reviews').delete().eq('event_id', code)

    const { error } = await supabase.from('events').delete().eq('id', code)
    if (error) {
      alert('Error deleting event: ' + error.message)
      setIsDeleting(false)
    } else {
      navigate('/')
    }
  }

  const handleLeaveEvent = async () => {
    if (!userId || !code) return
    
    if (event?.created_by === userId) {
        alert('Use Delete Event from the menu if you want to remove this event.')
        return
    }

    setIsLeaving(true)
    const { error } = await supabase
      .from('event_attendees')
      .delete()
      .eq('event_id', code)
      .eq('user_id', userId)

    if (error) {
        alert('Error leaving event: ' + error.message)
        setIsLeaving(false)
    }
    else navigate('/')
  }

  const openMaps = (type) => {
    if (!event?.location_address) return
    const query = encodeURIComponent(event.location_address)
    if (type === 'apple') {
      window.open(`http://maps.apple.com/?q=${query}`, '_blank')
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
    }
    setShowMapOptions(false)
  }

  const handleAttendeeClick = async (person) => {
    setSelectedAttendee(person)
    setLoadingSharedEvents(true)
    setSharedEventCount(0)
    
    if (userId && person.id) {
      // Find events where I am an attendee
      const { data: myEvents } = await supabase.from('event_attendees').select('event_id').eq('user_id', userId)
      const myEventIds = myEvents?.map(e => e.event_id) || []
      
      if (myEventIds.length > 0) {
        const { count } = await supabase
          .from('event_attendees')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', person.id)
          .in('event_id', myEventIds)
        setSharedEventCount(count || 0)
      }
    }
    setLoadingSharedEvents(false)
  }

  const handleAudienceAdded = (person) => {
    setAttendees(prev => {
      if (prev.some(attendee => attendee.id === person.id)) return prev

      return [...prev, {
        id: person.id,
        name: person.name,
        username: person.username || '',
        avatarKey: person.avatar_key || person.avatarKey || '',
        avatarUrl: person.avatar_url || person.avatarUrl || '',
      }].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
    })
  }

  const handleRateModalClose = async () => {
    setShowRateModal(false)
    if (userId && winningMovie) {
        const { data } = await supabase
            .from('reviews')
            .select('*')
            .eq('event_id', code)
            .eq('user_id', userId)
            .maybeSingle()
        setUserReview(data)
    }
  }

  const handleReviewSaved = (review) => {
    setUserReview(review)
  }

  const handleUnselectMovie = async () => {
    const { error } = await supabase
        .from('events')
        .update({ selected_nomination_id: null, selected_movie_id: null })
        .eq('id', code)
    
    if (error) {
        alert("Error unselecting: " + error.message)
    } else {
        window.location.reload()
    }
  }

  const nominateStatus = myNominationsCount > 0
    ? `You nominated ${myNominationsCount} movie${myNominationsCount === 1 ? '' : 's'}!`
    : 'Add suggestions'

  const voteStatus = totalNominations === 0
    ? 'No nominations yet'
    : myVotesCount >= totalNominations
      ? 'Ballot submitted'
      : `${totalNominations - myVotesCount} movie${(totalNominations - myVotesCount) === 1 ? '' : 's'} to vote for!`

  const hasSelectedMovie = event?.selected_movie_id || event?.selected_nomination_id
  const revealStatus = hasSelectedMovie 
    ? "See Voting Results" 
    : (totalNominations > 0 ? 'Check current standings' : 'Start ceremony')

  if (loading) return <LoadingSpinner label="Loading event..." />
  if (error) return <div className="min-h-screen w-full flex items-center justify-center text-red-400">{error}</div>
  if (!event) return <div className="min-h-screen w-full flex items-center justify-center text-slate-400">Event not found.</div>

  return (
    <div className="fixed inset-0 w-full h-full bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white flex flex-col">
      <div className="flex-1 w-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="px-4 pt-6 pb-0">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="p-2 rounded-full bg-white/10 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="bg-white/10 text-white p-2 rounded-full"
              title="More options"
            >
              <MoreHorizontal size={18} />
            </button>
            <AnimatePresence>
                {showMoreMenu && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col"
                >
                    <button
                    onClick={() => { setIsEditing(true); setShowMoreMenu(false) }}
                    className="text-left px-4 py-3 flex items-center gap-2 text-sm font-semibold"
                    >
                    <Edit size={16} /> Edit Event
                    </button>
                    {event?.created_by === userId ? (
                      <button
                      onClick={() => { setShowDeleteConfirm(true); setShowMoreMenu(false) }}
                      className="text-left px-4 py-3 text-rose-500 flex items-center gap-2 text-sm font-semibold"
                      >
                      <Trash2 size={16} /> Delete Event
                      </button>
                    ) : (
                      <button
                      onClick={() => { setShowLeaveConfirm(true); setShowMoreMenu(false) }}
                      className="text-left px-4 py-3 flex items-center gap-2 text-sm font-semibold"
                      >
                      <LogOut size={16} /> Leave Event
                      </button>
                    )}
                </motion.div>
                </>
                )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-6">
            {isEditing ? (
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="Event Title"
                  className="w-full bg-black/30 border border-white/10 text-white p-3 rounded-lg text-3xl font-extrabold tracking-tight"
                />
                <button
                  type="button"
                  onClick={openDateTimePicker}
                  className="w-full flex items-center gap-2 bg-black/30 border border-white/10 text-white p-3 rounded-lg text-left"
                >
                  <Calendar size={18} className="text-slate-400" />
                  {editedEventDate ? formatDateTimeLabel(editedEventDate) : 'Set Date & Time'}
                </button>
                <input
                  type="text"
                  value={editedLocationAddress}
                  onChange={(e) => setEditedLocationAddress(e.target.value)}
                  placeholder="Location Address"
                  className="w-full bg-black/30 border border-white/10 text-white p-3 rounded-lg"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="flex-1 bg-rose-500 text-white px-4 py-2 rounded-lg font-bold"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex-1 bg-white/10 text-white px-4 py-2 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  {event.title || 'Untitled event'}
                </h1>
                <div className="mt-3 flex flex-col gap-2 text-slate-300">
                  {event.event_date && (
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-rose-500" />
                      <span>{formatDateTime(event.event_date)}</span>
                    </div>
                  )}
                  {event.location_address && (
                    <div 
                      onClick={() => setShowMapOptions(true)}
                      className="flex items-center gap-2 cursor-pointer w-fit"
                      role="button"
                    >
                      <MapPin size={16} className="text-rose-500" />
                      <span className="text-blue-400 underline decoration-blue-400/30 underline-offset-4 transition-colors">{event.location_address}</span>
                    </div>
                  )}
                </div>
              </>
            )}
        </div>
      </div>

      {/* WINNER CARD */}
      {winningMovie && (
        <div className="px-4 mt-6">
            <div 
                onClick={() => setShowFeatureModal(true)}
                className="relative w-full rounded-3xl overflow-hidden border border-amber-500/30 bg-slate-900 shadow-2xl cursor-pointer transition-transform active:scale-95"
            >
                {/* Background Image with Blur */}
                <div className="absolute inset-0">
                    <MoviePoster
                      title={winningMovie.title}
                      posterPath={winningMovie.poster_path}
                      className="w-full h-full"
                      imageClassName="w-full h-full object-cover opacity-20 blur-xl scale-110"
                      iconSize={32}
                      showTitle={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-900/60" />
                </div>
                
                <div className="relative p-5 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest mb-1">
                                <Trophy size={14} /> Tonight's Feature
                            </div>
                            <h2 className="text-2xl font-black leading-tight text-white break-words whitespace-normal">{winningMovie.title}</h2>
                            <div className="text-slate-400 text-sm mt-1">{winningMovie.year}</div>
                        </div>
                        <MoviePoster
                          title={winningMovie.title}
                          posterPath={winningMovie.poster_path}
                          className="w-16 aspect-[2/3] rounded-lg shadow-lg border border-white/10 shrink-0"
                          iconSize={16}
                        />
                    </div>

                    <div 
                        className="bg-white/5 rounded-xl p-3 border border-white/5 flex items-center justify-between gap-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="min-w-0">
                            {userReview ? (
                                <>
                                    <div className="text-xs text-slate-400 font-bold uppercase mb-0.5">Your Rating</div>
                                    <div className="flex items-center gap-1.5 text-amber-400 font-black text-lg"><Star size={18} fill="currentColor" /> {userReview.rating}/10</div>
                                </>
                            ) : (
                                <div className="text-sm font-bold text-slate-300">Have you watched it?</div>
                            )}
                        </div>
                        <button 
                            onClick={() => setShowRateModal(true)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${userReview ? 'bg-white/10 text-white' : 'bg-amber-400 text-black'}`}
                        >
                            {userReview ? 'Edit' : 'Rate Movie'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className="px-4 mt-4">
        <div className="grid gap-4 grid-cols-1">
          <button
            type="button"
            onClick={() => navigate(`/room/${code}/nominate`)}
            className="text-left rounded-3xl border border-rose-500 bg-gradient-to-br from-rose-600/40 via-rose-600/20 to-transparent p-5"
          >
            <div className="flex items-center gap-3 w-full">
              <Film size={22} className="text-rose-300" />
              <div>
                <div className="text-lg font-bold">Nominate</div>
                <div className="text-sm text-rose-200">{nominateStatus}</div>
              </div>
              <ChevronRight className="ml-auto text-rose-300/50" size={24} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/room/${code}/vote`)}
            className="text-left rounded-3xl border border-indigo-500 bg-gradient-to-br from-indigo-600/40 via-indigo-600/20 to-transparent p-5"
          >
            <div className="flex items-center gap-3 w-full">
              <ThumbsUp size={22} className="text-indigo-300" />
              <div>
                <div className="text-lg font-bold">Vote</div>
                <div className="text-sm text-indigo-200">{voteStatus}</div>
              </div>
              <ChevronRight className="ml-auto text-indigo-300/50" size={24} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/room/${code}/reveal`)}
            className="text-left rounded-3xl border border-amber-400 bg-gradient-to-br from-amber-500/40 via-amber-500/20 to-transparent p-5"
          >
            <div className="flex items-center gap-3 w-full">
              <PlayCircle size={22} className="text-amber-300" />
              <div>
                <div className="text-lg font-bold">Reveal</div>
                <div className="text-sm text-amber-200">{revealStatus}</div>
              </div>
              <ChevronRight className="ml-auto text-amber-300/50" size={24} />
            </div>
          </button>
        </div>
      </div>

      <div className="px-4 mt-4"> {/* Adjusted mt-6 to mt-8 */}
        <div className="">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm uppercase tracking-wide text-slate-400">The Audience</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <Users size={14} />
                {attendeesLoading ? 'Loading...' : `${attendees.length} ${attendees.length === 1 ? 'person' : 'people'}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddAudience(true)}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-500/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-300 ring-1 ring-indigo-500/30"
            >
              <Plus size={14} />
              Add People
            </button>
          </div>
          <div className="relative">
          <div className="flex gap-3 overflow-x-auto pb-2 pr-12 scrollbar-hide">
            {attendeesLoading ? (
              <div className="text-sm text-slate-400">Loading attendees...</div>
            ) : attendees.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                No attendees yet. Use search, your crew, or recent people to build the room faster.
              </div>
            ) : (
              attendees.map((person) => (
                <button 
                  key={person.id} 
                  onClick={() => handleAttendeeClick(person)}
                  className="flex w-16 shrink-0 flex-col items-center gap-2 text-center"
                >
                  <PersonAvatar
                    name={person.name}
                    avatarKey={person.avatarKey}
                    avatarUrl={person.avatarUrl}
                    size={48}
                    className="shadow-lg"
                    initialsClassName="text-xs"
                  />
                  <span className="w-full truncate text-[11px] font-bold text-slate-300">{person.name}</span>
                </button>
              ))
            )}
          </div>
          {attendees.length > 4 && (
            <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-16 bg-gradient-to-l from-slate-950 to-transparent" />
          )}
          </div>
        </div>
      </div>



      <div className="px-4 py-6">
        <div
          onClick={handleCopyInvite}
          className="relative w-full flex rounded-3xl overflow-hidden cursor-pointer shadow-2xl group bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 active:scale-95 transition-transform"
        >
          {/* Main Ticket Body (Left) */}
          <div className="flex-1 p-4 flex flex-col justify-center border-r-2 border-dashed border-white/10 relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-2xl font-black tracking-[0.15em] text-white/90 leading-none">ADMIT ONE</div>
              <div className="flex items-center gap-3 mt-2">
                {event?.event_date && <div className="text-[10px] text-slate-400 font-mono">{formatDateTime(event.event_date)}</div>}
              </div>
            </div>
            <div className="absolute -bottom-3 -right-2 text-6xl font-black text-white/5 -rotate-12 pointer-events-none select-none">
              MOVIE
            </div>
          </div>
          {/* Perforated Tear-off Section (Right) */}
          <div className="relative w-20 flex flex-col items-center justify-center gap-1 bg-black/20">
            {copied ? <Check size={20} className="text-green-400" /> : <LinkIcon size={20} className="text-slate-400" />}
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
              {copied ? 'Copied' : 'Invite'}
            </div>
          </div>
        </div>
      </div>
      </div>

      {showAddAudience && (
        <AddAudienceSheet
          event={event}
          attendees={attendees}
          onAdded={handleAudienceAdded}
          onClose={() => setShowAddAudience(false)}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 text-rose-500 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold m-0">Delete Event?</h3>
            </div>
            <p className="text-slate-300 mb-6 leading-relaxed">
              This will permanently delete the event for everyone. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-white/10 py-3 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEvent}
                disabled={isDeleting}
                className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 text-rose-500 mb-4">
              <LogOut size={24} />
              <h3 className="text-lg font-bold m-0">{event?.created_by === userId ? 'Delete Event?' : 'Leave Event?'}</h3>
            </div>
            <p className="text-slate-300 mb-6 leading-relaxed">
              {event?.created_by === userId 
                ? "As the creator, leaving will delete the event for everyone. This cannot be undone."
                : "You will need a new invite to rejoin this event."
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 bg-white/10 py-3 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveEvent}
                disabled={isLeaving}
                className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                {isLeaving || isDeleting ? (event?.created_by === userId ? 'Deleting...' : 'Leaving...') : (event?.created_by === userId ? 'Delete' : 'Leave')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMapOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowMapOptions(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 w-full max-w-xs flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-bold text-center mb-1 text-white">Open Maps</div>
            <button onClick={() => openMaps('apple')} className="bg-white/10 text-white p-3 rounded-xl font-semibold">Apple Maps</button>
            <button onClick={() => openMaps('google')} className="bg-white/10 text-white p-3 rounded-xl font-semibold">Google Maps</button>
            <button onClick={() => setShowMapOptions(false)} className="p-2 text-slate-400 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {selectedAttendee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedAttendee(null)}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-xs flex flex-col items-center gap-4 relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedAttendee(null)}
              className="absolute top-3 right-3 text-slate-400"
            >
              <X size={20} />
            </button>
            
            <PersonAvatar
              name={selectedAttendee.name}
              avatarKey={selectedAttendee.avatarKey}
              avatarUrl={selectedAttendee.avatarUrl}
              size={80}
              className="shadow-lg"
              initialsClassName="text-2xl"
            />
            
            <div className="text-center">
              <h3 className="text-xl font-bold">{selectedAttendee.name}</h3>
              <p className="text-slate-400 text-sm mt-1">
                {loadingSharedEvents ? 'Checking history...' : `Shared Events: ${sharedEventCount}`}
              </p>
            </div>
          </div>
        </div>
      )}

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

      {showRateModal && winningMovie && (
        <RateMovie 
            eventId={code}
            movie={winningMovie}
            existingReview={userReview}
            onClose={handleRateModalClose}
            onSaved={handleReviewSaved}
        />
      )}

      {showFeatureModal && winningMovie && (
        <FeatureDetailModal 
            movie={winningMovie} 
            onClose={() => setShowFeatureModal(false)}
            onUnselect={handleUnselectMovie}
            canUnselect={event?.created_by === userId}
        />
      )}
    </div>
  )
}

function AddAudienceSheet({ event, attendees, onAdded, onClose }) {
  const [crewPeople, setCrewPeople] = useState([])
  const [recentPeople, setRecentPeople] = useState([])
  const [currentUserId, setCurrentUserId] = useState('')

  useEffect(() => {
    let active = true

    async function loadSuggestions() {
      const { data: { user } } = await supabase.auth.getUser()
      if (active) {
        setCurrentUserId(user?.id || '')
      }
      const excludeIds = [...attendees.map(person => person.id), user?.id].filter(Boolean)

      const [crewList, recentList] = await Promise.all([
        event?.group_id ? loadGroupPeople(event.group_id, { excludeIds, limit: 20 }) : Promise.resolve([]),
        loadRecentPeople(user?.id, { excludeIds, limit: 12 }),
      ])

      if (!active) return

      setCrewPeople(crewList)
      setRecentPeople(recentList)
    }

    loadSuggestions()
    return () => {
      active = false
    }
  }, [event?.group_id, attendees])

  const handleAddAudience = async (person) => {
    const { error } = await supabase
      .from('event_attendees')
      .upsert([{ event_id: event.id, user_id: person.id }], { onConflict: 'event_id, user_id' })

    if (error) {
      throw new Error(error.message || 'Could not add that person to this event.')
    }

    onAdded(person)
  }

  const sections = [
    {
      id: 'crew',
      title: 'From This Crew',
      description: 'Quick add people who are already part of this crew.',
      items: crewPeople,
    },
    {
      id: 'recent',
      title: 'Recent People',
      description: 'People you have already shared movie nights with.',
      items: recentPeople,
    },
  ]

  return (
    <PeoplePickerSheet
      title="Add People To This Event"
      subtitle="Search the app, pull from this crew, or invite recent movie people in a couple taps."
      placeholder="Search users by name or handle"
      searchEmptyText="No users matched that search."
      browseEmptyText="Search by name or username, or use the suggestions above."
      excludeIds={[...attendees.map(person => person.id), currentUserId].filter(Boolean)}
      sections={sections}
      onAdd={handleAddAudience}
      onClose={onClose}
    />
  )
}

function FeatureDetailModal({ movie, onClose, onUnselect, canUnselect }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div className="w-full max-w-lg max-h-[85vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex gap-4 mb-6">
                        <MoviePoster
                            title={movie.title}
                            posterPath={movie.poster_path}
                            className="w-28 shrink-0 aspect-[2/3] rounded-xl shadow-lg"
                            iconSize={24}
                            showTitle
                        />
                        <div>
                            <div className="text-amber-400 font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-1"><Trophy size={12}/> Selected Movie</div>
                            <h2 className="text-2xl font-black leading-tight mb-1 text-white">{movie.title}</h2>
                            <div className="text-sm text-slate-400">{movie.year}</div>
                        </div>
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed mb-6">
                        {movie.description || "No description available."}
                    </p>
                </div>
                <div className="p-4 border-t border-white/10 flex flex-col gap-3">
                    {canUnselect && (
                        <button onClick={onUnselect} className="w-full py-3 bg-red-500/10 text-red-500 font-bold rounded-xl transition-colors">
                            Unselect Movie
                        </button>
                    )}
                    <button onClick={onClose} className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

// Robust copy utility (handles HTTPS and HTTP/Mobile fallbacks)
async function copyToClipboard(text) {
  // 1. Try modern Clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
  }

  // 2. Fallback for older browsers or non-secure contexts
  return new Promise((resolve, reject) => {
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.position = "fixed"
    textArea.style.left = "-9999px"
    textArea.style.top = "0"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      if (success) resolve()
      else reject(new Error('Copy command failed'))
    } catch (err) {
      document.body.removeChild(textArea)
      reject(err)
    }
  })
}

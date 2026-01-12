import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { AnimatePresence, motion } from 'framer-motion'
import { ThumbsUp, ThumbsDown, Heart, Plus, Film, MapPin, Calendar, Clock, Ticket, ChevronLeft, Link as LinkIcon, Check, Users, Star, RotateCcw, ChevronDown, ChevronUp, X, Minus, PlayCircle, Search } from 'lucide-react'
import SearchMovies from './SearchMovies'
import ResultsView from './ResultsView'
import MovieCard from './MovieCard'
import RateMovie from './RateMovie'
import LoadingSpinner from './LoadingSpinner'

export default function EventView() {
  const { code } = useParams() // Event ID
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state || {}
  
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState(null)
  const [myGroups, setMyGroups] = useState([])
  const [showAddCrew, setShowAddCrew] = useState(false)
  const [selectedCrewId, setSelectedCrewId] = useState('')
  const [showEditEvent, setShowEditEvent] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editDate, setEditDate] = useState('')
  const [savingEvent, setSavingEvent] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRemoveNominationConfirm, setShowRemoveNominationConfirm] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState(null)
  
  // Split Ballot States
  const [myNominations, setMyNominations] = useState([])
  const [crewNominations, setCrewNominations] = useState([])
  
  const [myVotes, setMyVotes] = useState({}) 
  const [showMyNominations, setShowMyNominations] = useState(true)
  const [showCrewNominations, setShowCrewNominations] = useState(true)
  const [ballotFilter, setBallotFilter] = useState('all')
  const [showSearch, setShowSearch] = useState(false)
  const [showResultsView, setShowResultsView] = useState(false)
  const [showNoNominationsNotice, setShowNoNominationsNotice] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteAddToGroup, setInviteAddToGroup] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [groupShareCode, setGroupShareCode] = useState('')
  const [showAttendees, setShowAttendees] = useState(false)
  const [eventAttendees, setEventAttendees] = useState([])
  const [attendeesLoading, setAttendeesLoading] = useState(false)
  const [showMapChoice, setShowMapChoice] = useState(false)
  const [mapQuery, setMapQuery] = useState('')
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [showRateMovie, setShowRateMovie] = useState(false)
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)
  const [showEventGuide, setShowEventGuide] = useState(true)
  const [pickedDate, setPickedDate] = useState(null)
  const [pickedTime, setPickedTime] = useState('')
  const [pickedPeriod, setPickedPeriod] = useState('PM')
  const [displayMonth, setDisplayMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showCreatorLeaveConfirm, setShowCreatorLeaveConfirm] = useState(false)
  const [leavingEvent, setLeavingEvent] = useState(false)
  const isCreator = userId && event?.created_by === userId
  const canEditEvent = Boolean(userId)

  useEffect(() => {
    if (code) loadData()
  }, [code])

  useEffect(() => {
    const dismissed = localStorage.getItem('eventGuideDismissed')
    setShowEventGuide(dismissed !== 'true')
  }, [])

  useEffect(() => {
    if (!showAttendees) return
    fetchAttendees()
  }, [showAttendees])

  useEffect(() => {
    if (!code) return
    const channel = supabase
      .channel(`events-${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${code}` }, (payload) => {
        const updated = payload.new
        setEvent(prev => (prev ? { ...prev, ...updated } : updated))
        if (updated?.selected_movie_id) {
          fetchSelectedMovie(updated.selected_movie_id)
        } else {
          setSelectedMovie(null)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [code])

  async function loadData() {
    try {
      setLoading(true)
      // 1. Get Event
      const { data: eventData, error: eventError } = await supabase.from('events').select('*').eq('id', code).single()
      if (eventError) throw eventError
      setEvent(eventData)
      if (eventData?.selected_movie_id) {
        fetchSelectedMovie(eventData.selected_movie_id)
      }
      if (eventData.group_id) {
        const { data: groupData } = await supabase.from('groups').select('share_code').eq('id', eventData.group_id).single()
        setGroupShareCode(groupData?.share_code || '')
      } else {
        setGroupShareCode('')
      }

      // 2. Get Nominations
      await refreshNominations()

      // 3. Get Votes
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
          setUserId(user.id)
          const { data: votes } = await supabase.from('votes').select('movie_id, vote_type').eq('event_id', code).eq('user_id', user.id)
          const voteMap = {}
          votes?.forEach(v => voteMap[v.movie_id] = v.vote_type)
          setMyVotes(voteMap)
          fetchMyGroups(user.id)
          await supabase
            .from('event_attendees')
            .upsert([{ event_id: code, user_id: user.id }], { onConflict: 'event_id, user_id' })
      }
      await fetchAttendees()
    } catch (err) {
      console.error(err)
      setError("Could not load event. It might have been deleted.")
    } finally {
      setLoading(false)
    }
  }

  async function refreshNominations() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('nominations').select('id, nominated_by, nomination_type, movie:movies (*)').eq('event_id', code)
    
    if (data) {
        setMyNominations(data.filter(n => n.nominated_by === user.id))
        setCrewNominations(data.filter(n => n.nominated_by !== user.id))
    }
  }

  async function fetchSelectedMovie(movieId) {
    const { data } = await supabase.from('movies').select('*').eq('id', movieId).single()
    if (data) setSelectedMovie(data)
  }

  async function fetchMyGroups(currentUserId) {
    const { data } = await supabase
      .from('group_members')
      .select('group:groups (id, name)')
      .eq('user_id', currentUserId)
    if (data) setMyGroups(data.map(item => item.group))
  }

  async function fetchAttendees() {
    setAttendeesLoading(true)
    const { data } = await supabase
      .from('event_attendees')
      .select('user_id, profiles(display_name, username)')
      .eq('event_id', code)
    setEventAttendees(data || [])
    setAttendeesLoading(false)
  }

  function formatDateTimeLabel(value) {
    if (!value) return 'Pick date & time'
    const d = new Date(value)
    return d.toLocaleString([], { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  function openDateTimePicker() {
    const existing = editDate ? new Date(editDate) : null
    const base = existing || new Date()
    if (!existing) {
      base.setHours(19, 0, 0, 0)
    }
    const roundedMinutes = Math.round(base.getMinutes() / 30) * 30
    base.setMinutes(roundedMinutes)
    base.setSeconds(0)
    base.setMilliseconds(0)
    setPickedDate(new Date(base.getFullYear(), base.getMonth(), base.getDate()))
    setPickedTime(`${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`)
    setPickedPeriod(base.getHours() >= 12 ? 'PM' : 'AM')
    setDisplayMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    setShowDateTimePicker(true)
  }

  function confirmDateTime() {
    if (!pickedDate || !pickedTime) return
    const [hh, mm] = pickedTime.split(':').map(Number)
    const composed = new Date(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate(), hh, mm, 0, 0)
    setEditDate(composed.toISOString())
    setShowDateTimePicker(false)
  }

  function startEditEvent() {
    if (!event) return
    setEditTitle(event.title || '')
    setEditLocation(event.location_address || '')
    setEditDate(event.event_date || '')
    setShowEditEvent(true)
  }

  async function handleUpdateEvent() {
    const nextTitle = editTitle.trim()
    if (!nextTitle) return
    setSavingEvent(true)
    const updates = {
      title: nextTitle,
      event_date: editDate || null,
      location_address: editLocation.trim() || null
    }
    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', code)
    setSavingEvent(false)
    if (error) {
      alert(`Error: ${error.message}`)
      return
    }
    setEvent(prev => (prev ? { ...prev, ...updates } : prev))
    setShowEditEvent(false)
  }

  async function handleDeleteEvent() {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', code)
    if (error) {
      alert(`Error: ${error.message}`)
      return
    }
    setShowDeleteConfirm(false)
    navigate(backTarget)
  }

  async function handleLeaveEvent() {
    setLeavingEvent(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLeavingEvent(false)
      return
    }

    const { data: nominations } = await supabase
      .from('nominations')
      .select('movie_id')
      .eq('event_id', code)
      .eq('nominated_by', user.id)
    const movieIds = (nominations || []).map(n => n.movie_id)

    await supabase
      .from('nominations')
      .delete()
      .eq('event_id', code)
      .eq('nominated_by', user.id)

    if (movieIds.length > 0) {
      await supabase
        .from('votes')
        .delete()
        .eq('event_id', code)
        .in('movie_id', movieIds)
    }

    await supabase
      .from('votes')
      .delete()
      .eq('event_id', code)
      .eq('user_id', user.id)

    await supabase
      .from('event_attendees')
      .delete()
      .eq('event_id', code)
      .eq('user_id', user.id)

    setLeavingEvent(false)
    setShowLeaveConfirm(false)
    navigate(backTarget)
  }

  async function handleAddCrew() {
    if (!selectedCrewId) return
    const { error } = await supabase
      .from('events')
      .update({ group_id: selectedCrewId })
      .eq('id', code)
    if (!error) {
      setEvent(prev => ({ ...prev, group_id: selectedCrewId }))
      setShowAddCrew(false)
      setSelectedCrewId('')
      const { data: groupData } = await supabase.from('groups').select('share_code').eq('id', selectedCrewId).single()
      setGroupShareCode(groupData?.share_code || '')
    }
  }

  const handleVote = async (movieId, voteValue) => {
    const isRemoving = myVotes[movieId] === voteValue
    setMyVotes((prev) => {
      const next = { ...prev }
      if (isRemoving) {
        delete next[movieId]
      } else {
        next[movieId] = voteValue
      }
      return next
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      if (isRemoving) {
        await supabase
          .from('votes')
          .delete()
          .eq('event_id', code)
          .eq('movie_id', movieId)
          .eq('user_id', user.id)
      } else {
        await supabase.from('votes').upsert([
          { event_id: code, movie_id: movieId, user_id: user.id, vote_type: voteValue }
        ], { onConflict: 'event_id, movie_id, user_id' })
      }
    }
  }

  const handleAddNomination = async (movie, isTheater) => {
    const { data: { user } } = await supabase.auth.getUser()
    
    // Check both lists to prevent duplicates
    const allNoms = [...myNominations, ...crewNominations]
    const alreadyExists = allNoms.find(n => n.movie.id === movie.id)
    if (alreadyExists) return alert("Already nominated!")

    const { error } = await supabase.from('nominations').insert([
        { event_id: code, movie_id: movie.id, nominated_by: user.id, nomination_type: isTheater ? 'theater' : 'streaming' } 
    ])
    if (!error) refreshNominations()
  }

  const handleRemoveNomination = async (nomination) => {
    if (!nomination) return
    const { error: nominationError } = await supabase
      .from('nominations')
      .delete()
      .eq('id', nomination.id)
    if (nominationError) {
      alert(`Error: ${nominationError.message}`)
      return
    }
    await supabase
      .from('votes')
      .delete()
      .eq('event_id', code)
      .eq('movie_id', nomination.movie.id)
    refreshNominations()
  }

  const requestRemoveNomination = (nomination) => {
    setPendingRemoval(nomination)
    setShowRemoveNominationConfirm(true)
  }

  const confirmRemoveNomination = async () => {
    if (!pendingRemoval) return
    await handleRemoveNomination(pendingRemoval)
    setPendingRemoval(null)
    setShowRemoveNominationConfirm(false)
  }

  const openMaps = () => {
    if (!event.location_address) return
    setMapQuery(event.location_address)
    setShowMapChoice(true)
  }

  const handleCopyInvite = ({ closeAfter = false } = {}) => {
    const inviteLink = groupShareCode
      ? `${window.location.origin}/join/${groupShareCode}?eventId=${event.id}&addToGroup=${inviteAddToGroup ? '1' : '0'}`
      : `${window.location.origin}/room/${event.id}`
    navigator.clipboard.writeText(inviteLink)
    setInviteCopied(true)
    if (closeAfter) {
      setTimeout(() => setShowInvite(false), 350)
    }
    setTimeout(() => setInviteCopied(false), 2000)
  }

  const handleChangeMovie = async () => {
    const { error } = await supabase
      .from('events')
      .update({ selected_movie_id: null })
      .eq('id', code)
    if (!error) {
      setEvent(prev => (prev ? { ...prev, selected_movie_id: null } : prev))
      setSelectedMovie(null)
      setShowResultsView(true)
    }
  }

  const handleSelectedMovie = async (movieId) => {
    setEvent(prev => (prev ? { ...prev, selected_movie_id: movieId } : prev))
    await fetchSelectedMovie(movieId)
  }

  const isWatching = Boolean(event?.selected_movie_id)
  const isMissingVote = (movieId) => myVotes[movieId] === undefined
  const missingMyNominations = myNominations.filter(item => isMissingVote(item.movie.id))
  const missingCrewNominations = crewNominations.filter(item => isMissingVote(item.movie.id))
  const totalMissingVotes = missingMyNominations.length + missingCrewNominations.length
  const dislikedMyNominations = myNominations.filter(item => myVotes[item.movie.id] === -2)
  const dislikedCrewNominations = crewNominations.filter(item => myVotes[item.movie.id] === -2)
  const totalDisliked = dislikedMyNominations.length + dislikedCrewNominations.length
  const favoriteMyNominations = myNominations.filter(item => myVotes[item.movie.id] === 2)
  const favoriteCrewNominations = crewNominations.filter(item => myVotes[item.movie.id] === 2)
  const totalFavorites = favoriteMyNominations.length + favoriteCrewNominations.length
  const hasNominations = myNominations.length + crewNominations.length > 0
  const filteredMyNominations = ballotFilter === 'missing'
    ? missingMyNominations
    : ballotFilter === 'disliked'
      ? dislikedMyNominations
      : ballotFilter === 'favorite'
        ? favoriteMyNominations
        : myNominations
  const filteredCrewNominations = ballotFilter === 'missing'
    ? missingCrewNominations
    : ballotFilter === 'disliked'
      ? dislikedCrewNominations
      : ballotFilter === 'favorite'
        ? favoriteCrewNominations
        : crewNominations
  const backTarget = navState.from === 'hub'
    ? '/'
    : navState.from === 'group'
      ? (navState.groupId ? `/group/${navState.groupId}` : (event?.group_id ? `/group/${event.group_id}` : '/'))
      : (event?.group_id ? `/group/${event.group_id}` : '/')
  const backLabel = navState.from === 'hub'
    ? 'My Hub'
    : (navState.from === 'group' || event?.group_id ? 'Crew' : 'Hub')

  if (loading) return <LoadingSpinner label="Loading event..." />
  if (error) return <div style={{padding:'40px', textAlign:'center', color: '#ff4d4d'}}>{error}</div>
  if (!event) return null

  return (
    <div style={{ paddingBottom: '40px', paddingRight: '28px', paddingTop: '12px', height: '100%', overflowY: 'auto', scrollbarGutter: 'stable' }}>
      
      {/* BACK NAVIGATION */}
      <button onClick={() => navigate(backTarget)} style={{ background: 'none', color: '#888', padding: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <ChevronLeft size={20} /> Back to {backLabel}
      </button>

      {/* HEADER */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.1 }}>{event.title}</h1>
          <div className="flex-gap" style={{ marginTop: '10px', color: '#ccc', fontSize: '0.9rem', flexWrap: 'wrap' }}>
              {event.event_date && (
                  <span className="flex-gap" style={{background:'rgba(255,255,255,0.1)', padding:'5px 10px', borderRadius:'8px'}}>
                      <Calendar size={16}/> {new Date(event.event_date).toLocaleString([], {weekday:'short', month:'numeric', day:'numeric', hour:'numeric', minute:'2-digit'})}
                  </span>
              )}
              <button
                onClick={() => setShowAttendees(prev => !prev)}
                style={{ background: showAttendees ? 'rgba(0,229,255,0.2)' : 'rgba(255,255,255,0.08)', color: showAttendees ? '#00E5FF' : 'white', padding: '6px 10px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, minWidth: '118px', justifyContent: 'center' }}
                aria-pressed={showAttendees}
              >
                <Users size={16} /> {showAttendees ? 'Hide Guests' : 'Guests'}
              </button>
              {event.location_address && (
                  <span className="flex-gap maps-link" onClick={openMaps} style={{background:'rgba(0, 229, 255, 0.1)', color: '#00E5FF', padding:'5px 10px', borderRadius:'8px', cursor: 'pointer', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px'}}>
                      <MapPin size={16}/> {event.location_address}
                  </span>
              )}
          </div>
        </div>
        <div className="flex-gap" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {canEditEvent && (
            <button
              onClick={() => (showEditEvent ? setShowEditEvent(false) : startEditEvent())}
              style={{ background: showEditEvent ? 'rgba(0,229,255,0.2)' : 'rgba(255,255,255,0.08)', color: showEditEvent ? '#00E5FF' : 'white', padding: '8px 12px', borderRadius: '999px', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {showEditEvent ? 'Done' : 'Edit'}
            </button>
          )}
          {userId && (
            <button
              onClick={() => (isCreator ? setShowCreatorLeaveConfirm(true) : setShowLeaveConfirm(true))}
              style={{ background: 'rgba(255,77,109,0.15)', color: '#ff4d6d', padding: '8px 12px', borderRadius: '999px', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Leave
            </button>
          )}
        </div>
      </div>
      {showEventGuide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px', background: 'rgba(8,11,24,0.75)', backdropFilter: 'blur(6px)' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '540px',
              padding: '18px',
              borderRadius: '18px',
              border: '1px solid rgba(0,229,255,0.22)',
              background: 'linear-gradient(180deg, rgba(0,229,255,0.08) 0%, rgba(9,16,35,0.72) 60%, rgba(9,16,35,0.88) 100%)',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
              overflow: 'hidden'
            }}
          >
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('eventGuideDismissed', 'true')
                setShowEventGuide(false)
              }}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(255,255,255,0.08)',
                color: '#cbd5e1',
                borderRadius: '999px',
                padding: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Close event guide"
              title="Dismiss"
            >
              <X size={16} />
            </button>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: '6px', color: '#e2e8f0' }}>
              Welcome to Popcorn & Picks!
            </div>
            <div className="text-sm" style={{ color: '#cbd5e1', maxWidth: '420px', margin: '0 auto' }}>
              Let’s pick the best movie for everyone. Here’s how it works:
            </div>

            <div style={{ marginTop: '18px', display: 'grid', gap: '14px', textAlign: 'left' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: '12px', alignItems: 'start' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,229,255,0.14)', border: '1px solid rgba(0,229,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} color="#00E5FF" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#e2e8f0' }}>1. Invite Friends</div>
                  <div className="text-sm" style={{ color: '#94a3b8' }}>
                    Share the link so friends can join the event.
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: '12px', alignItems: 'start' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,229,255,0.14)', border: '1px solid rgba(0,229,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Search size={20} color="#00E5FF" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#e2e8f0' }}>2. Nominate Movies</div>
                  <div className="text-sm" style={{ color: '#94a3b8' }}>
                    Search and add options to the voting ballot.
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: '12px', alignItems: 'start' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,229,255,0.14)', border: '1px solid rgba(0,229,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ThumbsUp size={20} color="#00E5FF" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#e2e8f0' }}>3. Vote</div>
                  <div className="text-sm" style={{ color: '#94a3b8' }}>
                    Use <span style={{ color: '#FF4D9A', fontWeight: 700 }}>Superlike</span> for movies you really want to watch.
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: '12px', alignItems: 'start' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,215,0,0.14)', border: '1px solid rgba(255,215,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlayCircle size={20} color="#ffd700" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#e2e8f0' }}>4. Select & Watch</div>
                  <div className="text-sm" style={{ color: '#94a3b8' }}>
                    Your votes help determine what movie gets selected!
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                localStorage.setItem('eventGuideDismissed', 'true')
                setShowEventGuide(false)
              }}
              style={{
                marginTop: '18px',
                width: '100%',
                background: '#00E5FF',
                color: 'black',
                padding: '12px 16px',
                borderRadius: '999px',
                fontWeight: 700
              }}
            >
              Let’s Start
            </button>
          </div>
        </div>
      )}

      {showEditEvent && (
        <div className="glass-panel" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input placeholder="Event Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          <button
            onClick={openDateTimePicker}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', color: 'white', padding: '12px', borderRadius: '12px', justifyContent: 'center' }}
          >
            <Calendar size={16} />
            <Clock size={16} />
            {formatDateTimeLabel(editDate)}
          </button>
          <input placeholder="Location(Optional)" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
          <button
            onClick={handleUpdateEvent}
            disabled={savingEvent}
            style={{ background: '#00E5FF', color: 'black', padding: '12px', borderRadius: '999px', fontWeight: 700 }}
          >
            {savingEvent ? 'Saving...' : 'Save Changes'}
          </button>
          {isCreator && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ background: 'rgba(255,77,109,0.15)', color: '#ff4d6d', padding: '10px', borderRadius: '999px', fontWeight: 700 }}
            >
              Delete Event
            </button>
          )}
        </div>
      )}

      {showAttendees && (
        <div className="glass-panel" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontWeight: 700 }}>Event Guests</div>
          {eventAttendees.length === 0 ? (
            <p className="text-sm">No attendees yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {eventAttendees.map(attendee => {
                const name = attendee.profiles?.display_name || attendee.profiles?.username || 'Unknown'
                const isCreator = attendee.user_id === event.created_by
                return (
                  <div key={attendee.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.06)', padding: '10px 12px', borderRadius: '12px' }}>
                    <span style={{ fontWeight: 600 }}>{name}</span>
                    {isCreator && (
                      <span style={{ background: 'rgba(0,229,255,0.15)', color: '#00E5FF', padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
                        Creator
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '16px 0' }} />

      {!isWatching && (
        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <div className="flex-gap" style={{ flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
              {event.group_id === null && userId && event.created_by === userId && (
                <button onClick={() => setShowAddCrew(!showAddCrew)} style={{ background: showAddCrew ? '#00E5FF' : 'rgba(255,255,255,0.1)', color: showAddCrew ? 'black' : 'white', padding: '10px', borderRadius: '50%' }}>
                  <Users size={18} />
                </button>
              )}
              <button
                onClick={() => (groupShareCode ? setShowInvite(true) : handleCopyInvite())}
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '10px 14px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                {inviteCopied ? <Check size={18} /> : <LinkIcon size={18} />}
                {inviteCopied ? 'Copied' : 'Invite'}
              </button>
              <button onClick={() => setShowSearch(true)} style={{ background: 'var(--primary)', color: 'white', padding: '10px 16px', borderRadius: '20px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Plus size={18} /> Nominate
              </button>
              <button
                onClick={() => (hasNominations ? setShowResultsView(true) : setShowNoNominationsNotice(true))}
                aria-disabled={!hasNominations}
                style={{
                  background: hasNominations ? '#ffd700' : 'rgba(255,255,255,0.08)',
                  color: hasNominations ? 'black' : '#94a3b8',
                  padding: '10px 14px',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  cursor: hasNominations ? 'pointer' : 'not-allowed'
                }}
                title={hasNominations ? 'Select a movie' : 'Add nominations first'}
              >
                <Film size={18} /> Select
              </button>
            </div>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

          <div className="flex-between" style={{ alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span className="text-sm" style={{ fontWeight: 'bold', letterSpacing: '1px' }}>BALLOT ({myNominations.length + crewNominations.length})</span>
            {!isWatching && (myNominations.length > 0 || crewNominations.length > 0) && (
              <div className="flex-gap" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setBallotFilter('all')}
                  style={{ background: ballotFilter === 'all' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', color: 'white', padding: '8px 12px', borderRadius: '999px', fontWeight: 600 }}
                >
                  All
                </button>
                <button
                  onClick={() => setBallotFilter('missing')}
                  style={{ background: ballotFilter === 'missing' ? 'rgba(0,229,255,0.25)' : 'rgba(255,255,255,0.08)', color: ballotFilter === 'missing' ? '#00E5FF' : 'white', padding: '8px 12px', borderRadius: '999px', fontWeight: 600 }}
                >
                  Missing My Vote{totalMissingVotes > 0 ? ` (${totalMissingVotes})` : ''}
                </button>
                <button
                  onClick={() => setBallotFilter('favorite')}
                  style={{ background: ballotFilter === 'favorite' ? 'rgba(255,77,154,0.22)' : 'rgba(255,255,255,0.08)', color: ballotFilter === 'favorite' ? '#FF4D9A' : 'white', padding: '8px 12px', borderRadius: '999px', fontWeight: 600 }}
                >
                  Superlike{totalFavorites > 0 ? ` (${totalFavorites})` : ''}
                </button>
                <button
                  onClick={() => setBallotFilter('disliked')}
                  style={{ background: ballotFilter === 'disliked' ? 'rgba(255,77,109,0.22)' : 'rgba(255,255,255,0.08)', color: ballotFilter === 'disliked' ? '#FF4D6D' : 'white', padding: '8px 12px', borderRadius: '999px', fontWeight: 600 }}
                >
                  Dislikes{totalDisliked > 0 ? ` (${totalDisliked})` : ''}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isWatching && selectedMovie && (
        <div style={{ marginBottom: '20px' }}>
          <div className="flex-between" style={{ marginBottom: '10px' }}>
            <span className="text-sm" style={{ fontWeight: 'bold', letterSpacing: '1px' }}>NOW SHOWING</span>
            <button onClick={() => setShowResultsView(true)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '999px', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Film size={16} /> Select
            </button>
          </div>
          <MovieCard
            movie={selectedMovie}
            meta={<span style={{ color: '#00E5FF', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Star size={14} /> Winner</span>}
          >
            <button onClick={() => setShowRateMovie(true)} style={{ background: '#00E5FF', color: 'black', padding: '12px', borderRadius: '12px', fontWeight: 700, width: '100%' }}>
              Rate Movie
            </button>
          </MovieCard>
          <button onClick={handleChangeMovie} style={{ marginTop: '6px', background: 'none', border: 'none', color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <RotateCcw size={14} /> Change Movie
          </button>
        </div>
      )}

      {showAddCrew && (
        <div className="glass-panel" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontWeight: 700 }}>Add a Crew to this Event</div>
          {myGroups.length === 0 ? (
            <p className="text-sm">Join or create a crew first.</p>
          ) : (
            <>
              <select value={selectedCrewId} onChange={(e) => setSelectedCrewId(e.target.value)}>
                <option value="">Select a Crew</option>
                {myGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button
                onClick={handleAddCrew}
                style={{
                  background: '#00E5FF',
                  color: 'black',
                  width: '100%',
                  padding: '12px',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700
                }}
              >
                + Add Crew
              </button>
            </>
          )}
        </div>
      )}

      {/* EMPTY STATE */}
      {!isWatching && myNominations.length === 0 && crewNominations.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: '60px', color: '#666' }}>
          <Film size={48} style={{opacity:0.2, marginBottom:'10px'}}/>
          <p>No nominations yet.</p>
          <p className="text-sm">Be the first to suggest a movie!</p>
        </div>
      )}

      {!isWatching && ballotFilter === 'missing' && totalMissingVotes === 0 && (myNominations.length > 0 || crewNominations.length > 0) && (
        <div style={{ textAlign: 'center', marginTop: '30px', color: '#8a8a8a' }}>
          <p style={{ marginBottom: '4px' }}>You are all caught up.</p>
          <p className="text-sm">No missing votes right now.</p>
        </div>
      )}

      {!isWatching && (ballotFilter === 'disliked' || ballotFilter === 'favorite') && filteredMyNominations.length + filteredCrewNominations.length === 0 && (myNominations.length > 0 || crewNominations.length > 0) && (
        <div style={{ textAlign: 'center', marginTop: '30px', color: '#8a8a8a' }}>
          <p style={{ marginBottom: '4px' }}>Nothing here yet.</p>
          <p className="text-sm">Try voting on the ballot first.</p>
        </div>
      )}
      {/* MY NOMINATIONS */}
      {!isWatching && filteredMyNominations.length > 0 && (
          <div style={{marginBottom: '30px'}}>
              <button
                onClick={() => setShowMyNominations(!showMyNominations)}
                style={{ width: '100%', background: 'none', border: 'none', color: '#00E5FF', marginBottom: '10px', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {showMyNominations ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                <span className="text-sm" style={{ letterSpacing: '1px' }}>MY NOMINATIONS ({filteredMyNominations.length})</span>
              </button>
              {showMyNominations && filteredMyNominations.map(item => (
                <NominationCard
                  key={item.id}
                  item={item}
                  myVotes={myVotes}
                  handleVote={handleVote}
                  canRemove
                  onRemove={requestRemoveNomination}
                />
              ))}
          </div>
      )}

      {/* CREW NOMINATIONS */}
      {!isWatching && filteredCrewNominations.length > 0 && (
          <div>
              <button
                onClick={() => setShowCrewNominations(!showCrewNominations)}
                style={{ width: '100%', background: 'none', border: 'none', color: 'var(--primary)', marginBottom: '10px', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {showCrewNominations ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                <span className="text-sm" style={{ letterSpacing: '1px' }}>CREW PICKS ({filteredCrewNominations.length})</span>
              </button>
              {showCrewNominations && filteredCrewNominations.map(item => (
                <NominationCard
                  key={item.id}
                  item={item}
                  myVotes={myVotes}
                  handleVote={handleVote}
                />
              ))}
          </div>
      )}

      {/* MODALS */}
      {showResultsView && (
        <ResultsView
          eventId={code}
          onClose={() => setShowResultsView(false)}
          onSelected={handleSelectedMovie}
        />
      )}
      {showRateMovie && selectedMovie && (
        <RateMovie
          eventId={code}
          movie={selectedMovie}
          onClose={() => setShowRateMovie(false)}
        />
      )}
      <AnimatePresence>
        {showSearch && <SearchMovies eventId={code} groupId={event.group_id} onClose={() => setShowSearch(false)} onNominate={handleAddNomination} />}
      </AnimatePresence>

      <AnimatePresence>
        {showNoNominationsNotice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 2150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)' }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              style={{ width: '90%', maxWidth: '420px', background: '#1a1a2e', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center' }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>No nominations yet</div>
              <p className="text-sm" style={{ color: '#bbb', margin: 0 }}>
                You can’t select a movie until one has been nominated.
              </p>
              <button
                onClick={() => setShowNoNominationsNotice(false)}
                style={{ background: 'var(--primary)', color: 'white', padding: '10px', borderRadius: '12px', fontWeight: 700 }}
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{ width: '100%', maxWidth: '500px', height: '45vh', background: '#1a1a2e', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column' }}
            >
              <div className="flex-between" style={{ marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Invite to Event</h2>
                <button
                  onClick={() => setShowInvite(false)}
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

              {groupShareCode && (
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem' }}>Add to crew too</span>
                      <span className="text-sm" style={{ lineHeight: '1.4' }}>
                        {inviteAddToGroup ? "They'll join the crew and land on this event." : "They'll land on this event without joining the crew."}
                      </span>
                    </div>
                    <input className="toggle" type="checkbox" checked={inviteAddToGroup} onChange={(e) => setInviteAddToGroup(e.target.checked)} />
                  </div>
                </div>
              )}

              <button onClick={() => handleCopyInvite({ closeAfter: true })} style={{ background: '#00E5FF', color: 'black', padding: '12px', borderRadius: '12px', fontWeight: 700 }}>
                {inviteCopied ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}><Check size={16}/> Copied</span> : 'Copy Invite Link'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)' }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              style={{ width: '90%', maxWidth: '420px', background: '#1a1a2e', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Delete this event?</div>
              <p className="text-sm" style={{ color: '#bbb', margin: 0 }}>This will remove the event and its nominations.</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: 'white', padding: '10px', borderRadius: '12px', fontWeight: 700 }}>
                  Cancel
                </button>
                <button onClick={handleDeleteEvent} style={{ flex: 1, background: '#ff4d6d', color: 'white', padding: '10px', borderRadius: '12px', fontWeight: 700 }}>
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRemoveNominationConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)' }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              style={{ width: '90%', maxWidth: '420px', background: '#1a1a2e', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Remove this nomination?</div>
              <p className="text-sm" style={{ color: '#bbb', margin: 0 }}>
                This removes the nomination for everyone and clears all votes on it.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  onClick={() => {
                    setShowRemoveNominationConfirm(false)
                    setPendingRemoval(null)
                  }}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: 'white', padding: '10px', borderRadius: '12px', fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button onClick={confirmRemoveNomination} style={{ flex: 1, background: '#ff4d6d', color: 'white', padding: '10px', borderRadius: '12px', fontWeight: 700 }}>
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)' }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              style={{ width: '90%', maxWidth: '420px', background: '#1a1a2e', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Leave this event?</div>
              <p className="text-sm" style={{ color: '#bbb', margin: 0 }}>
                This removes you from the guest list and clears your nominations for this event.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button onClick={() => setShowLeaveConfirm(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: 'white', padding: '10px', borderRadius: '12px', fontWeight: 700 }}>
                  Cancel
                </button>
                <button onClick={handleLeaveEvent} style={{ flex: 1, background: '#ff4d6d', color: 'white', padding: '10px', borderRadius: '12px', fontWeight: 700 }} disabled={leavingEvent}>
                  {leavingEvent ? 'Leaving...' : 'Leave Event'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreatorLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)' }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              style={{ width: '90%', maxWidth: '420px', background: '#1a1a2e', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>You created this event</div>
              <p className="text-sm" style={{ color: '#bbb', margin: 0 }}>
                Leaving will delete the event for everyone and remove all nominations.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button onClick={() => setShowCreatorLeaveConfirm(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: 'white', padding: '10px', borderRadius: '12px', fontWeight: 700 }}>
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowCreatorLeaveConfirm(false)
                    handleDeleteEvent()
                  }}
                  style={{ flex: 1, background: '#ff4d6d', color: 'white', padding: '10px', borderRadius: '12px', fontWeight: 700 }}
                >
                  Delete Event
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMapChoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 2150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)' }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              style={{ width: '90%', maxWidth: '420px', background: '#1a1a2e', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Open location in</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    const query = encodeURIComponent(mapQuery)
                    window.open(`https://maps.apple.com/?q=${query}`, '_blank')
                    setShowMapChoice(false)
                  }}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: 'white', padding: '10px', borderRadius: '12px', fontWeight: 700 }}
                >
                  Apple Maps
                </button>
                <button
                  onClick={() => {
                    const query = encodeURIComponent(mapQuery)
                    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
                    setShowMapChoice(false)
                  }}
                  style={{ flex: 1, background: '#00E5FF', color: 'black', padding: '10px', borderRadius: '12px', fontWeight: 700 }}
                >
                  Google Maps
                </button>
              </div>
              <button onClick={() => setShowMapChoice(false)} style={{ background: 'transparent', color: '#9ca3af', padding: '6px', fontWeight: 600 }}>
                Cancel
              </button>
            </motion.div>
          </motion.div>
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
    </div>
  )
}

function DateTimePickerSheet({
  show,
  onClose,
  displayMonth,
  setDisplayMonth,
  pickedDate,
  setPickedDate,
  pickedTime,
  setPickedTime,
  pickedPeriod,
  setPickedPeriod,
  onConfirm
}) {
  if (!show) return null
  const days = buildCalendarDays(displayMonth)
  const monthLabel = displayMonth.toLocaleString([], { month: 'long', year: 'numeric' })
  const timeSlots = getTimeSlots(30)
  const today = new Date()
  const isSameDay = (d1, d2) => d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }}>
      <div style={{ width: '100%', maxWidth: '500px', height: '80vh', background: '#1a1a2e', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <div className="flex-between" style={{ marginBottom: '12px' }}>
          <h2 style={{ margin: 0 }}>Pick Date & Time</h2>
          <button onClick={onClose} style={{ background: '#333', padding: '8px', borderRadius: '50%', color: 'white' }}>X</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <button
            onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '6px 10px', borderRadius: '10px' }}
          >
            Prev
          </button>
          <div style={{ fontWeight: 700 }}>{monthLabel}</div>
          <button
            onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '6px 10px', borderRadius: '10px' }}
          >
            Next
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '10px' }}>
          {['S','M','T','W','T','F','S'].map(d => (
            <div key={d} className="text-sm" style={{ textAlign: 'center' }}>{d}</div>
          ))}
          {days.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} />
            const dateObj = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day)
            const selected = isSameDay(dateObj, pickedDate)
            const isToday = isSameDay(dateObj, today)
            return (
              <button
                key={`${displayMonth.getMonth()}-${day}`}
                onClick={() => setPickedDate(dateObj)}
                style={{
                  padding: '8px 0',
                  borderRadius: '10px',
                  background: selected ? '#00E5FF' : 'rgba(255,255,255,0.08)',
                  color: selected ? 'black' : 'white',
                  border: isToday && !selected ? '1px solid #00E5FF' : 'none'
                }}
              >
                {day}
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: '8px', marginBottom: '10px', fontWeight: 600 }}>Time</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <button
            onClick={() => setPickedPeriod('AM')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '12px',
              background: pickedPeriod === 'AM' ? '#00E5FF' : 'rgba(255,255,255,0.08)',
              color: pickedPeriod === 'AM' ? 'black' : 'white',
              fontWeight: 600
            }}
          >
            AM
          </button>
          <button
            onClick={() => setPickedPeriod('PM')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '12px',
              background: pickedPeriod === 'PM' ? '#00E5FF' : 'rgba(255,255,255,0.08)',
              color: pickedPeriod === 'PM' ? 'black' : 'white',
              fontWeight: 600
            }}
          >
            PM
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {timeSlots.map(t => {
            const candidate = to24Time(t.hour, t.minute, pickedPeriod)
            const isSelected = pickedTime === candidate
            return (
              <button
                key={t.label}
                onClick={() => setPickedTime(candidate)}
                style={{
                  padding: '10px 0',
                  borderRadius: '10px',
                  background: isSelected ? '#00E5FF' : 'rgba(255,255,255,0.08)',
                  color: isSelected ? 'black' : 'white',
                  fontWeight: 600
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <button onClick={onConfirm} style={{ marginTop: '14px', background: '#00E5FF', color: 'black', padding: '12px', borderRadius: '999px', fontWeight: 700 }}>
          Confirm Date & Time
        </button>
      </div>
    </div>
  )
}

function getTimeSlots(stepMinutes = 30) {
  const slots = []
  for (let h = 1; h <= 12; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      const label = `${h}:${String(m).padStart(2, '0')}`
      slots.push({ hour: h, minute: m, label })
    }
  }
  return slots
}

function to24Hour(hour12, period) {
  if (period === 'AM') return hour12 === 12 ? 0 : hour12
  return hour12 === 12 ? 12 : hour12 + 12
}

function to24Time(hour12, minute, period) {
  const hour24 = to24Hour(hour12, period)
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const days = []
  for (let i = 0; i < startWeekday; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  return days
}

// ------------------------------------------------------------------
// HELPER COMPONENTS (Paste these at the bottom of the file)
// ------------------------------------------------------------------

function NominationCard({ item, myVotes, handleVote, canRemove = false, onRemove }) {
  const currentVote = myVotes[item.movie.id]
  const isTheater = item.nomination_type === 'theater'
  
  return (
    <div className={isTheater ? 'theater-card' : ''} style={{ borderRadius: '16px', marginBottom: '16px' }}>
        <MovieCard
          movie={item.movie}
          meta={isTheater ? <span style={{color: 'gold', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px'}}><Ticket size={14}/> THEATER TRIP</span> : null}
          topRight={canRemove ? (
            <button
              onClick={() => onRemove?.(item)}
              title="Remove nomination"
              aria-label="Remove nomination"
              style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1b0f14', border: '2px solid #ff4d6d', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 6px 14px rgba(0,0,0,0.35)' }}
            >
              <X size={16} color="#ff4d6d" />
            </button>
          ) : null}
        >
            <div style={{ display: 'flex', gap: '8px' }}>
                <VoteBtn active={currentVote === 2} type="love" onClick={() => handleVote(item.movie.id, 2)} />
                <VoteBtn active={currentVote === 1} type="up" onClick={() => handleVote(item.movie.id, 1)} />
                <VoteBtn active={currentVote === -2} type="down" onClick={() => handleVote(item.movie.id, -2)} />
            </div>
        </MovieCard>
    </div>
  )
}

function VoteBtn({ active, type, onClick }) {
    const colors = { down: '#FF4D6D', up: '#00E5FF', love: '#FF4D9A' }
    const backgrounds = {
      down: 'rgba(255,77,109,0.18)',
      up: 'rgba(0,229,255,0.18)',
      love: 'rgba(255,77,154,0.18)'
    }
    const icons = { down: ThumbsDown, up: ThumbsUp, love: Heart }
    const Icon = icons[type]
    return (
        <button
          onClick={onClick}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '12px',
            background: active ? backgrounds[type] : 'rgba(255,255,255,0.05)',
            border: active ? `1px solid ${colors[type]}` : '1px solid rgba(255,255,255,0.08)',
            color: active ? colors[type] : 'white',
            opacity: active ? 1 : 0.4,
            display: 'flex',
            justifyContent: 'center'
          }}
        >
            <Icon size={20} color={active ? colors[type] : 'white'} fill={active && type === 'love' ? colors[type] : 'none'} />
        </button>
    )
}

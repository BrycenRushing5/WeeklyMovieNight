import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Plus, Users, Book, Search, Filter, Calendar, Clock, Link as LinkIcon } from 'lucide-react'
import { supabase } from './supabaseClient'
import SearchMovies from './SearchMovies'
import MovieCard from './MovieCard'

const GENRES = ['Action', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Thriller', 'Family']

export default function Dashboard({ session }) {
  const [groups, setGroups] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [activeTab, setActiveTab] = useState('events') 
  const [showSearch, setShowSearch] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false) // New Modal
  const [newGroupName, setNewGroupName] = useState('')
  const [showJoinGroup, setShowJoinGroup] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [events, setEvents] = useState([])
  const [groupMemberPreview, setGroupMemberPreview] = useState({})
  const [showNominate, setShowNominate] = useState(false)
  const [nominateMovie, setNominateMovie] = useState(null)
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDate, setNewEventDate] = useState('')
  const [newEventLocation, setNewEventLocation] = useState('')
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)
  const [pickedDate, setPickedDate] = useState(null)
  const [pickedTime, setPickedTime] = useState('')
  const [displayMonth, setDisplayMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [lastInviteLink, setLastInviteLink] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)
  
  // Watchlist Local Search
  const [watchFilter, setWatchFilter] = useState('')
  const [showWatchFilters, setShowWatchFilters] = useState(false)
  const [watchGenre, setWatchGenre] = useState('')
  const [watchMinScore, setWatchMinScore] = useState(70)
  const [useWatchScore, setUseWatchScore] = useState(false)

  const username = session.user.user_metadata.username

  useEffect(() => {
    getMyGroups()
    getMyWatchlist()
  }, [])

  async function getMyGroups() {
    const { data } = await supabase
      .from('group_members')
      .select('group:groups (id, name, share_code), profiles(username)')
      .eq('user_id', session.user.id)
    if (data) {
      const groupList = data.map(item => item.group)
      setGroups(groupList)
      if (groupList.length > 0) {
        getMyEvents(groupList.map(g => g.id))
        getGroupMemberPreview(groupList.map(g => g.id))
      } else {
        setEvents([])
      }
    }
  }

  async function getGroupMemberPreview(groupIds) {
    const { data } = await supabase
      .from('group_members')
      .select('group_id, profiles(username)')
      .in('group_id', groupIds)
    if (!data) return
    const grouped = {}
    data.forEach(item => {
      const name = item.profiles?.username
      if (!grouped[item.group_id]) grouped[item.group_id] = []
      if (name && grouped[item.group_id].length < 3) grouped[item.group_id].push(name)
    })
    setGroupMemberPreview(grouped)
  }

  async function getMyEvents(groupIds) {
    const groupIdList = (groupIds || []).filter(Boolean)
    const orFilters = [
      groupIdList.length ? `group_id.in.(${groupIdList.join(',')})` : null,
      `created_by.eq.${session.user.id}`
    ].filter(Boolean).join(',')
    const { data } = await supabase
      .from('events')
      .select('id, title, event_date, group_id')
      .or(orFilters)
      .order('event_date', { ascending: true })
    setEvents(data || [])
  }

  async function getMyWatchlist() {
    const { data } = await supabase.from('user_wishlist').select('movie:movies (*)').eq('user_id', session.user.id)
    if (data) setWatchlist(data.map(item => item.movie))
  }

  async function addToWatchlist(movie) {
    // Check duplication
    const exists = watchlist.find(m => m.id === movie.id)
    if (exists) return alert("Already in your watchlist!")

    const { error } = await supabase.from('user_wishlist').insert([{ user_id: session.user.id, movie_id: movie.id }])
    if (!error) {
      setWatchlist(prev => {
        if (prev.find(m => m.id === movie.id)) return prev
        return [movie, ...prev]
      })
      getMyWatchlist()
    }
  }

  async function removeFromWatchlist(movie) {
    const { error } = await supabase
      .from('user_wishlist')
      .delete()
      .eq('user_id', session.user.id)
      .eq('movie_id', movie.id)
    if (!error) {
      setWatchlist(prev => prev.filter(m => m.id !== movie.id))
    }
  }

  async function nominateFromWatchlist(event) {
    if (!nominateMovie) return
    const { data: existing } = await supabase
      .from('nominations')
      .select('id')
      .eq('event_id', event.id)
      .eq('movie_id', nominateMovie.id)
      .limit(1)
    
    if (existing && existing.length > 0) {
      return alert('Already nominated for this event!')
    }

    const { error } = await supabase.from('nominations').insert([{
      event_id: event.id,
      movie_id: nominateMovie.id,
      nominated_by: session.user.id,
      nomination_type: 'streaming'
    }])
    
    if (!error) {
      setShowNominate(false)
      setNominateMovie(null)
    }
  }

  async function createGroup() {
    if (!newGroupName) return
    const shareCode = Math.random().toString(36).substring(2, 9)
    const { data: group } = await supabase.from('groups').insert([{ name: newGroupName, share_code: shareCode }]).select().single()
    
    await supabase.from('group_members').insert([{ group_id: group.id, user_id: session.user.id }])
    
    setNewGroupName('')
    setShowCreateGroup(false)
    getMyGroups()
  }

  async function createEventFromDashboard() {
    if (!newEventTitle) return
    const { data: createdEvent, error } = await supabase
      .from('events')
      .insert([{ 
        group_id: null, 
        title: newEventTitle, 
        event_date: newEventDate || null,
        location_address: newEventLocation || null,
        status: 'voting',
        voting_method: 'hearts',
        created_by: session.user.id
      }])
      .select()
      .single()
    if (!error) {
      setNewEventTitle('')
      setNewEventDate('')
      setNewEventLocation('')
      setShowCreateEvent(false)
      if (createdEvent?.id) {
        setLastInviteLink(`${window.location.origin}/room/${createdEvent.id}`)
      }
      if (createdEvent?.id) {
        setEvents(prev => (prev.find(e => e.id === createdEvent.id) ? prev : [createdEvent, ...prev]))
      }
      getMyGroups()
    }
  }

  function formatDateTimeLabel(value) {
    if (!value) return 'Pick date & time'
    const d = new Date(value)
    return d.toLocaleString([], { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  function openDateTimePicker() {
    const existing = newEventDate ? new Date(newEventDate) : null
    const base = existing || new Date()
    const roundedMinutes = Math.round(base.getMinutes() / 15) * 15
    base.setMinutes(roundedMinutes)
    base.setSeconds(0)
    base.setMilliseconds(0)
    setPickedDate(new Date(base.getFullYear(), base.getMonth(), base.getDate()))
    setPickedTime(`${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`)
    setDisplayMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    setShowDateTimePicker(true)
  }

  function confirmDateTime() {
    if (!pickedDate || !pickedTime) return
    const [hh, mm] = pickedTime.split(':').map(Number)
    const composed = new Date(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate(), hh, mm, 0, 0)
    setNewEventDate(composed.toISOString())
    setShowDateTimePicker(false)
  }

  function handleCopyInvite() {
    if (!lastInviteLink) return
    navigator.clipboard.writeText(lastInviteLink)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  async function joinGroupByCode() {
    const code = joinCode.trim()
    if (!code) return
    const { data: group, error } = await supabase
      .from('groups')
      .select('id, name')
      .eq('share_code', code)
      .single()
    if (error || !group) return alert('Invalid crew code.')
    const { error: joinError } = await supabase
      .from('group_members')
      .insert([{ group_id: group.id, user_id: session.user.id }])
    if (joinError) {
      if (joinError.code === '23505') {
        alert(`You're already in ${group.name}.`)
      } else {
        alert('Error joining crew.')
      }
      return
    }
    setJoinCode('')
    setShowJoinGroup(false)
    getMyGroups()
  }

  // Filter watchlist logic
  const filteredWatchlist = watchlist.filter(m => {
    const titlePass = m.title.toLowerCase().includes(watchFilter.toLowerCase())
    const genrePass = !watchGenre || (m.genre && m.genre.includes(watchGenre))
    const score = m.rt_score === null ? 100 : m.rt_score
    const scorePass = !useWatchScore || score >= watchMinScore
    return titlePass && genrePass && scorePass
  })
  const groupNameById = Object.fromEntries(groups.map(g => [g.id, g.name]))

  return (
    <div style={{ paddingBottom: '40px', height: '100%', overflowY: 'auto' }}>
      {/* HEADER */}
      <div className="flex-between" style={{ marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>
            <span className="gradient-text">My Hub</span>
          </h1>
          <p className="text-sm">@{username}</p>
        </div>
        {/* FIX: Logout button is now auto width */}
        <button onClick={() => supabase.auth.signOut()} style={{ width: 'auto', background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '50%', color: 'white' }}>
            <LogOut size={20} />
        </button>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '16px', marginBottom: '24px' }}>
        <button onClick={() => setActiveTab('events')} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: activeTab === 'events' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'events' ? 'white' : '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Calendar size={18} /> Events
        </button>
        <button onClick={() => setActiveTab('groups')} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: activeTab === 'groups' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'groups' ? 'white' : '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Users size={18} /> Crews
        </button>
        <button onClick={() => setActiveTab('watchlist')} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: activeTab === 'watchlist' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'watchlist' ? 'white' : '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Book size={18} /> Watchlist
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'groups' ? (
          <motion.div key="groups" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
             
             {/* NEW CREW BUTTON */}
             <button onClick={() => setShowCreateGroup(!showCreateGroup)} style={{ width: '100%', marginBottom: '15px', background: 'var(--primary)', color: 'white', padding: '12px', borderRadius: '12px' }}>
                {showCreateGroup ? 'Cancel' : '+ Start New Crew'}
             </button>

             {showCreateGroup && (
                <div className="glass-panel" style={{ marginBottom: '20px' }}>
                    <input autoFocus placeholder="Crew Name (e.g. Action Buffs)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                    <button onClick={createGroup} style={{ marginTop: '10px', background: '#00E5FF', color: 'black' }}>Create</button>
                </div>
             )}

             {/* JOIN CREW BUTTON */}
             <button onClick={() => setShowJoinGroup(!showJoinGroup)} style={{ width: '100%', marginBottom: '15px', background: 'rgba(255,255,255,0.08)', color: 'white', padding: '12px', borderRadius: '12px' }}>
                {showJoinGroup ? 'Cancel' : '+ Join a Crew'}
             </button>

             {showJoinGroup && (
                <div className="glass-panel" style={{ marginBottom: '20px' }}>
                    <input placeholder="Enter invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                    <button onClick={joinGroupByCode} style={{ marginTop: '10px', background: '#00E5FF', color: 'black' }}>Join</button>
                </div>
             )}

             {groups.map(g => (
               <Link key={g.id} to={`/group/${g.id}`} style={{ textDecoration: 'none' }}>
                 <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '1.1rem', color: 'white' }}>{g.name}</div>
                      <div className="text-sm">
                        {groupMemberPreview[g.id]?.length
                          ? `${groupMemberPreview[g.id].join(', ')}${groupMemberPreview[g.id].length === 3 ? '...' : ''}`
                          : 'No members yet'}
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                 </div>
               </Link>
             ))}
          </motion.div>
        ) : activeTab === 'events' ? (
          <motion.div key="events" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <button onClick={() => setShowCreateEvent(!showCreateEvent)} style={{ width: '100%', marginBottom: '15px', background: 'var(--primary)', color: 'white', padding: '12px', borderRadius: '12px' }}>
              {showCreateEvent ? 'Cancel' : '+ New Event'}
            </button>

            {showCreateEvent && (
              <div className="glass-panel" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Event Title (e.g. Friday Horror)" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} autoFocus />
                <button
                  onClick={openDateTimePicker}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', color: 'white', padding: '12px', borderRadius: '12px', justifyContent: 'center' }}
                >
                  <Calendar size={16} />
                  <Clock size={16} />
                  {formatDateTimeLabel(newEventDate)}
                </button>
                <input placeholder="Location" value={newEventLocation} onChange={(e) => setNewEventLocation(e.target.value)} />
                <button onClick={createEventFromDashboard} style={{ marginTop: '10px', background: '#00E5FF', color: 'black' }}>Create Event</button>
              </div>
            )}

            {lastInviteLink && (
              <div className="glass-panel" style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>Invite Link Ready</div>
                  <div className="text-sm">Share it to bring people into this event.</div>
                </div>
                <button onClick={handleCopyInvite} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '10px 12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <LinkIcon size={16} />
                  {inviteCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}

            {events.length === 0 ? (
              <p className="text-sm" style={{ textAlign: 'center' }}>No upcoming events yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {events.map(event => (
                  <Link key={event.id} to={`/room/${event.id}`} style={{ textDecoration: 'none' }}>
                    <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'white' }}>{event.title}</div>
                        <div className="text-sm" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {groupNameById[event.group_id] || 'No Crew'} • {event.event_date ? new Date(event.event_date).toLocaleDateString() : 'TBD'}
                          {event.created_by === session.user.id && (
                            <span style={{ background: 'rgba(0,229,255,0.15)', color: '#00E5FF', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem' }}>
                              Creator
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ color: 'var(--text-muted)' }}>→</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="watchlist" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              
              {/* WATCHLIST ACTION BAR */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: '#888' }} />
                      <input placeholder="Filter your list..." value={watchFilter} onChange={(e) => setWatchFilter(e.target.value)} style={{ paddingLeft: '35px' }} />
                  </div>
                  <button onClick={() => setShowWatchFilters(!showWatchFilters)} style={{ width: 'auto', background: 'rgba(255,255,255,0.08)', color: 'white', padding: '0 14px', borderRadius: '12px' }}>
                    <Filter size={18} color={showWatchFilters ? '#00E5FF' : 'white'} />
                  </button>
                  <button onClick={() => setShowSearch(true)} style={{ width: 'auto', background: '#00E5FF', color: 'black', padding: '0 20px', borderRadius: '12px' }}>
                    <Plus size={20} />
                  </button>
              </div>

              {showWatchFilters && (
                <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                  <div className="flex-gap" style={{ marginBottom: '10px' }}>
                    <select value={watchGenre} onChange={(e) => setWatchGenre(e.target.value)} style={{ padding: '8px', fontSize: '0.85rem', flex: 1 }}>
                      <option value="">All Genres</option>
                      {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="flex-between">
                    <span className="text-sm">Min Score {watchMinScore}%</span>
                    <input type="checkbox" checked={useWatchScore} onChange={(e) => setUseWatchScore(e.target.checked)} />
                  </div>
                  {useWatchScore && (
                    <input type="range" value={watchMinScore} onChange={(e) => setWatchMinScore(Number(e.target.value))} />
                  )}
                </div>
              )}

              {filteredWatchlist.length === 0 && <p className="text-sm" style={{textAlign:'center'}}>No movies found.</p>}
              
              {filteredWatchlist.map(movie => (
                  <MovieCard key={movie.id} movie={movie}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => { setNominateMovie(movie); setShowNominate(true) }}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: 'white', padding: '10px', borderRadius: '12px' }}
                      >
                        Nominate
                      </button>
                      <button
                        onClick={() => removeFromWatchlist(movie)}
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#ff7a7a', padding: '10px 12px', borderRadius: '12px' }}
                      >
                        Remove
                      </button>
                    </div>
                  </MovieCard>
              ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSearch && <SearchMovies eventId={null} onClose={() => setShowSearch(false)} customAction={addToWatchlist} />}
      </AnimatePresence>

      <AnimatePresence>
        {showNominate && (
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
              style={{ width: '100%', maxWidth: '500px', height: '70vh', background: '#1a1a2e', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column' }}
            >
              <div className="flex-between" style={{ marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Nominate to Event</h2>
                <button onClick={() => { setShowNominate(false); setNominateMovie(null) }} style={{ background: '#333', padding: '8px', borderRadius: '50%', color: 'white' }}>X</button>
              </div>

              {events.length === 0 && (
                <p className="text-sm" style={{ textAlign: 'center' }}>
                  You're not in any events yet. Create one in a crew to nominate from your watchlist.
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                {events.map(event => (
                  <button
                    key={event.id}
                    onClick={() => nominateFromWatchlist(event)}
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'white', padding: '14px', borderRadius: '12px', textAlign: 'left' }}
                  >
                    <div style={{ fontWeight: '600' }}>{event.title}</div>
                    <div className="text-sm">
                      {groupNameById[event.group_id] || 'Crew'} • {event.event_date ? new Date(event.event_date).toLocaleDateString() : 'TBD'}
                    </div>
                  </button>
                ))}
              </div>
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
  onConfirm
}) {
  if (!show) return null
  const days = buildCalendarDays(displayMonth)
  const monthLabel = displayMonth.toLocaleString([], { month: 'long', year: 'numeric' })
  const timeSlots = getTimeSlots()
  const today = new Date()
  const isSameDay = (d1, d2) => d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }}>
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
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {timeSlots.map(t => (
            <button
              key={t}
              onClick={() => setPickedTime(t)}
              style={{
                padding: '10px 0',
                borderRadius: '10px',
                background: pickedTime === t ? '#00E5FF' : 'rgba(255,255,255,0.08)',
                color: pickedTime === t ? 'black' : 'white',
                fontWeight: 600
              }}
            >
              {toDisplayTime(t)}
            </button>
          ))}
        </div>

        <button onClick={onConfirm} style={{ marginTop: '14px', background: 'var(--primary)', color: 'white', padding: '12px', borderRadius: '12px' }}>
          Confirm Date & Time
        </button>
      </div>
    </div>
  )
}

function getTimeSlots() {
  const slots = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      slots.push(`${hh}:${mm}`)
    }
  }
  return slots
}

function toDisplayTime(time) {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)
  return cells
}

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { Calendar, MapPin, Plus, ArrowRight, Users, Check, Clock, Link as LinkIcon, Search, X, UserPlus } from 'lucide-react'
import { ChevronLeft } from 'lucide-react' // Add Icon
import { useNavigate } from 'react-router-dom' // Add Hook
import LoadingSpinner from './LoadingSpinner'
import DateTimePickerSheet from './DateTimePickerSheet'

export default function GroupView({ session }) {
    const navigate = useNavigate()
  const { groupId } = useParams()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [events, setEvents] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedGroupName, setEditedGroupName] = useState('')
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [leavingCrew, setLeavingCrew] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  
  // Create Event State
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDate, setNewEventDate] = useState('')
  const [newEventLocation, setNewEventLocation] = useState('')
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)
  const [pickedDate, setPickedDate] = useState(null)
  const [pickedTime, setPickedTime] = useState('')
  const [pickedPeriod, setPickedPeriod] = useState('PM')
  const [displayMonth, setDisplayMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getGroupDetails()
    getEvents()
    getMembers()
  }, [groupId])

  async function getGroupDetails() {
    const { data } = await supabase.from('groups').select('*').eq('id', groupId).single()
    setGroup(data)
    setEditedGroupName(data?.name || '')
  }

  async function getMembers() {
    // Join group_members with profiles to get usernames
    const { data } = await supabase
      .from('group_members')
      .select('profiles(display_name, username)')
      .eq('group_id', groupId)
    
    // Flatten data structure
    setMembers(data.map(d => d.profiles?.display_name || d.profiles?.username || 'Movie Fan'))
  }

  async function getEvents() {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('group_id', groupId)
      .order('event_date', { ascending: true }) // Soonest events first
    setEvents(data || [])
  }

  async function createEvent() {
    if (!newEventTitle) return
    if (!newEventDate) return alert("Please set a date for the event.")
    const { data: createdEvent, error } = await supabase
      .from('events')
      .insert([{ 
        group_id: groupId, 
        title: newEventTitle, 
        event_date: newEventDate || null,
        location_address: newEventLocation || null,
        status: 'voting',
        voting_method: 'hearts',
        created_by: session.user.id
      }])
      .select()
      .single()
    
    if (!error && createdEvent) {
      // Add all group members as attendees
      const { data: groupMembers } = await supabase.from('group_members').select('user_id').eq('group_id', groupId)
      
      const attendees = (groupMembers || []).map(m => ({
          event_id: createdEvent.id,
          user_id: m.user_id
      }))

      // Ensure creator is added (just in case)
      if (!attendees.some(a => a.user_id === session.user.id)) {
          attendees.push({ event_id: createdEvent.id, user_id: session.user.id })
      }
      if (attendees.length > 0) await supabase.from('event_attendees').insert(attendees)

      setNewEventTitle('')
      setNewEventDate('')
      setNewEventLocation('')
      setShowCreate(false)
      if (createdEvent?.id) {
        navigate(`/room/${createdEvent.id}`, { state: { from: 'group', groupId } })
      } else {
        getEvents()
      }
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
    setNewEventDate(composed.toISOString())
    setShowDateTimePicker(false)
  }


  async function updateGroupName() {
    const name = editedGroupName.trim()
    if (!name || name === group?.name) {
      setIsEditingName(false)
      setEditedGroupName(group?.name || '')
      return
    }
    const { data, error } = await supabase
      .from('groups')
      .update({ name })
      .eq('id', groupId)
      .select()
      .single()
    if (!error) {
      setGroup(data)
      setIsEditingName(false)
    }
  }

  const handleCopy = () => {
    const inviteLink = `${window.location.origin}/join/${group.share_code}`
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleLeaveCrew() {
    if (!session?.user) return
    setLeavingCrew(true)
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', session.user.id)
    setLeavingCrew(false)
    if (error) {
      alert(`Error: ${error.message}`)
      return
    }
    setShowLeaveConfirm(false)
    navigate('/')
  }

  if (!group) return <LoadingSpinner label="Loading crew..." />

  const maxNameLines = group?.name && group.name.length > 28 ? 3 : 2

  return (
    <>
    <div className="fixed inset-0 w-full h-full bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white flex flex-col overflow-y-auto p-4 pb-20">
      {/* BACK BUTTON */}
      <button onClick={() => navigate('/')} className="bg-transparent text-slate-400 p-0 mb-5 flex items-center gap-1.5 hover:text-white transition-colors w-fit">
        <ChevronLeft size={20} /> Back to Dashboard
      </button>
      {/* HEADER */}
      <div className="mb-8">
        {!isEditingName ? (
          <div className="flex justify-between items-start gap-4 mb-4">
            <h1
              className="text-3xl sm:text-4xl font-black tracking-tight leading-none line-clamp-2"
              title={group.name}
            >
              {group.name}
            </h1>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setIsEditingName(true)} className="bg-white/10 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-white/20">
                Edit
              </button>
              {session?.user && (
                <button onClick={() => setShowLeaveConfirm(true)} className="bg-red-500/10 text-red-500 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-500/20">
                  Leave
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-2 items-center mb-4">
            <input
              value={editedGroupName}
              onChange={(e) => setEditedGroupName(e.target.value)}
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-xl font-bold outline-none focus:border-indigo-500"
              autoFocus
            />
            <button onClick={updateGroupName} className="bg-indigo-500 text-white px-4 py-3 rounded-xl font-bold">
              Save
            </button>
            <button onClick={() => { setIsEditingName(false); setEditedGroupName(group.name) }} className="bg-white/10 text-white px-4 py-3 rounded-xl font-bold">
              Cancel
            </button>
          </div>
        )}
        
        {/* MEMBERS & CODE ROW */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm bg-white/5 px-3 py-1.5 rounded-full font-semibold text-slate-300">
              <Users size={16} /> 
              {members.length} Members
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-white/20 transition-colors"
            >
              {copied ? <Check size={18} /> : <LinkIcon size={18} />}
              {copied ? 'Copied' : 'Invite'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button 
                onClick={() => setShowAddMember(true)}
                className="flex items-center gap-1.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-full text-sm font-bold hover:bg-indigo-500/30 transition-colors"
            >
                <Plus size={14} /> Add Member
            </button>
            {members.length === 0 ? (
              <span className="text-sm text-slate-500 py-1">No members yet.</span>
            ) : (
              members.map((name, idx) => (
                <span key={`${name}-${idx}`} className="bg-white/5 px-3 py-1.5 rounded-full text-sm font-medium text-slate-200 border border-white/5">
                  {name}
                </span>
              ))
            )}
          </div>

          {group?.share_code && (
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="uppercase tracking-wider font-bold">Join code</span>
              <span className="font-mono bg-white/5 px-2 py-0.5 rounded text-slate-300">{group.share_code}</span>
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-white/10 my-6" />

      {/* EVENTS LIST */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Events</h3>
        <button onClick={() => setShowCreate(!showCreate)} className="text-indigo-400 font-bold text-sm hover:text-indigo-300">
            {showCreate ? 'Cancel' : '+ New Event'}
        </button>
      </div>

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <div className="text-lg font-bold">Leave this crew?</div>
            <p className="text-sm text-slate-400">
              You will need a new invite from a crew member to rejoin.
            </p>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 bg-white/10 text-white py-3 rounded-xl font-bold hover:bg-white/20">
                Cancel
              </button>
              <button onClick={handleLeaveCrew} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600" disabled={leavingCrew}>
                {leavingCrew ? 'Leaving...' : 'Leave Crew'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE CREATE EVENT SECTION FOR CALENDAR */}
      {showCreate && (
        <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 mb-6 flex flex-col gap-3">
            <input 
                placeholder="Event Title (e.g. Friday Horror)" 
                value={newEventTitle} 
                onChange={(e) => setNewEventTitle(e.target.value)} 
                className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-indigo-500"
                autoFocus 
            />
            <div className="flex gap-2">
                <button
                  onClick={openDateTimePicker}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/5 text-white py-3 rounded-xl hover:bg-white/10"
                >
                  <Calendar size={16} />
                  {formatDateTimeLabel(newEventDate)}
                </button>
            </div>
            <input 
                placeholder="Location (Optional)" 
                value={newEventLocation} 
                onChange={(e) => setNewEventLocation(e.target.value)} 
                className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-indigo-500"
            />
            <button
              onClick={createEvent}
              className="w-full bg-indigo-500 text-white py-3 rounded-xl font-bold hover:bg-indigo-600 mt-2"
            >
              Create Event
            </button>
        </div>
      )}

      {events.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">No events planned yet.</p> : (
        <div className="flex flex-col gap-3">
            {events.map(event => (
                <Link key={event.id} to={`/room/${event.id}`} state={{ from: 'group', groupId }}>
                    <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 flex justify-between items-center hover:bg-slate-800 transition-colors">
                        <div>
                            <h3 className="text-lg font-bold mb-1">{event.title}</h3>
                            <div className="text-sm text-slate-400">
                                <span className="flex items-center gap-1">
                                    <Calendar size={14} /> {event.event_date ? new Date(event.event_date).toLocaleDateString() : 'TBD'}
                                </span>
                            </div>
                        </div>
                        <ArrowRight size={20} className="text-slate-600" />
                    </div>
                </Link>
            ))}
        </div>
      )}
    </div>

    {showAddMember && (
        <AddMemberSheet 
            groupId={groupId} 
            onClose={() => { setShowAddMember(false); getMembers(); }} 
            currentMembers={members}
        />
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
    </>
  )
}

function AddMemberSheet({ groupId, onClose, currentMembers }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [recentCrew, setRecentCrew] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchRecentCrew()
    }, [])

    useEffect(() => {
        if (query.length > 2) {
            searchProfiles()
        } else {
            setResults([])
        }
    }, [query])

    async function fetchRecentCrew() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get events I attended
        const { data: myEvents } = await supabase.from('event_attendees').select('event_id').eq('user_id', user.id)
        const eventIds = myEvents?.map(e => e.event_id) || []
        
        if (eventIds.length === 0) return

        // Get co-attendees
        const { data: coAttendees } = await supabase
            .from('event_attendees')
            .select('user_id, profiles(display_name, username)')
            .in('event_id', eventIds)
            .neq('user_id', user.id) // Exclude me
        
        const unique = new Map()
        coAttendees?.forEach(a => {
            const name = a.profiles?.display_name || a.profiles?.username
            if (name && !currentMembers.includes(name)) {
                unique.set(a.user_id, { id: a.user_id, name })
            }
        })
        setRecentCrew(Array.from(unique.values()))
    }

    async function searchProfiles() {
        setLoading(true)
        const { data } = await supabase
            .from('profiles')
            .select('id, display_name, username')
            .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
            .limit(10)
        
        const filtered = data?.filter(p => {
            const name = p.display_name || p.username
            return name && !currentMembers.includes(name)
        }) || []
        
        setResults(filtered)
        setLoading(false)
    }

    async function addMember(userId) {
        const { error } = await supabase.from('group_members').insert([{ group_id: groupId, user_id: userId }])
        if (error) {
            if (error.code === '23505') alert("User already in group")
            else alert("Error adding member")
        } else {
            onClose()
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Add Member</h2>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X size={20}/></button>
                </div>
                
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                        placeholder="Search by name or username" 
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-indigo-500"
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                    {query ? (
                        loading ? <div className="text-center text-slate-500">Searching...</div> :
                        results.length === 0 ? <div className="text-center text-slate-500">No users found.</div> :
                        results.map(u => (
                            <button key={u.id} onClick={() => addMember(u.id)} className="w-full p-3 bg-white/5 rounded-xl flex justify-between items-center hover:bg-white/10">
                                <span className="font-bold">{u.display_name || u.username}</span>
                                <UserPlus size={18} className="text-indigo-400" />
                            </button>
                        ))
                    ) : (
                        <>
                            {recentCrew.length > 0 && <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 mt-2">Recent Friends</div>}
                            {recentCrew.map(u => (
                                <button key={u.id} onClick={() => addMember(u.id)} className="w-full p-3 bg-white/5 rounded-xl flex justify-between items-center hover:bg-white/10">
                                    <span className="font-bold">{u.name}</span>
                                    <UserPlus size={18} className="text-indigo-400" />
                                </button>
                            ))}
                            {recentCrew.length === 0 && <div className="text-center text-slate-500 mt-10">Search to add new friends!</div>}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

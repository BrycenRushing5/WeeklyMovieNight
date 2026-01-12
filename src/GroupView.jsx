import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { Calendar, MapPin, Plus, ArrowRight, Users, Copy, Check, Clock } from 'lucide-react'
import { ChevronLeft } from 'lucide-react' // Add Icon
import { useNavigate } from 'react-router-dom' // Add Hook

export default function GroupView({ session }) {
    const navigate = useNavigate()
  const { groupId } = useParams()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [events, setEvents] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedGroupName, setEditedGroupName] = useState('')
  
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
    
    if (!error) {
      setNewEventTitle('')
      setNewEventDate('')
      setNewEventLocation('')
      setShowCreate(false)
      if (createdEvent?.id) {
        navigate(`/room/${createdEvent.id}`)
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

  if (!group) return <div style={{padding: '20px'}}>Loading Group...</div>

  return (
    <>
    <div style={{ padding: '20px', paddingBottom: '80px', height: '100%', overflowY: 'auto' }}>
      {/* BACK BUTTON */}
      <button onClick={() => navigate('/')} style={{ background: 'none', color: '#888', padding: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <ChevronLeft size={20} /> Back to Dashboard
      </button>
    <div style={{ padding: '20px', paddingBottom: '80px' }}>
      {/* HEADER */}
      <div style={{ marginBottom: '30px' }}>
        {!isEditingName ? (
          <div className="flex-between" style={{ gap: '10px', alignItems: 'center' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{group.name}</h1>
            <button onClick={() => setIsEditingName(true)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '10px' }}>
              Edit
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
            <input
              value={editedGroupName}
              onChange={(e) => setEditedGroupName(e.target.value)}
              style={{ flex: 1 }}
            />
            <button onClick={updateGroupName} style={{ background: '#00E5FF', color: 'black', padding: '8px 12px', borderRadius: '10px' }}>
              Save
            </button>
            <button onClick={() => { setIsEditingName(false); setEditedGroupName(group.name) }} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '10px' }}>
              Cancel
            </button>
          </div>
        )}
        
        {/* MEMBERS & CODE ROW */}
        <div className="flex-between">
           <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="flex-gap text-sm" style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px' }}>
                <Users size={16} /> 
                {members.length} Members: {members.slice(0, 3).join(', ')}{members.length > 3 && '...'}
              </div>
              {group?.share_code && (
                <div className="text-sm" style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Join code</span>
                  <span style={{ fontWeight: 600, letterSpacing: '0.12em' }}>{group.share_code}</span>
                </div>
              )}
           </div>
           
           <button onClick={handleCopy} className="flex-gap" style={{ background: 'none', color: '#00E5FF' }}>
              {copied ? <Check size={18} /> : <Copy size={18} />} 
              {copied ? 'Copied' : 'Invite Link'}
           </button>
        </div>
      </div>

      {/* EVENTS LIST */}
      <div className="flex-between" style={{ marginBottom: '15px' }}>
        <h3>Events</h3>
        <button onClick={() => setShowCreate(!showCreate)} style={{ background: 'none', color: '#00E5FF' }}>
            {showCreate ? 'Cancel' : '+ New Event'}
        </button>
      </div>

      {/* UPDATE CREATE EVENT SECTION FOR CALENDAR */}
      {showCreate && (
        <div className="glass-panel" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input placeholder="Event Title (e.g. Friday Horror)" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} autoFocus />
            <div className="flex-gap">
                <button
                  onClick={openDateTimePicker}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', color: 'white', padding: '12px', borderRadius: '12px', justifyContent: 'center' }}
                >
                  <Calendar size={16} />
                  <Clock size={16} />
                  {formatDateTimeLabel(newEventDate)}
                </button>
            </div>
            <input placeholder="Location(Optional)" value={newEventLocation} onChange={(e) => setNewEventLocation(e.target.value)} />
            <button
              onClick={createEvent}
              style={{
                marginTop: '10px',
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
              Create Event
            </button>
        </div>
      )}

      {events.length === 0 ? <p className="text-sm">No events planned yet.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {events.map(event => (
                <Link key={event.id} to={`/room/${event.id}`} style={{ textDecoration: 'none' }}>
                    <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem' }}>{event.title}</h3>
                            <div className="flex-gap text-sm">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Calendar size={14} /> {event.event_date ? new Date(event.event_date).toLocaleDateString() : 'TBD'}
                                </span>
                            </div>
                        </div>
                        <ArrowRight size={20} color="#666" />
                    </div>
                </Link>
            ))}
        </div>
      )}
    </div>
    </div>
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

        <button
          onClick={onConfirm}
          style={{
            marginTop: '14px',
            background: '#00E5FF',
            color: 'black',
            padding: '12px',
            borderRadius: '999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            fontWeight: 700
          }}
        >
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
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)
  return cells
}

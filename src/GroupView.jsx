import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Calendar, Check, ChevronLeft, Edit, Link as LinkIcon, LogOut, MapPin, MoreHorizontal, Plus, Trash2, Users, X } from 'lucide-react'
import { supabase } from './supabaseClient'
import LoadingSpinner from './LoadingSpinner'
import DateTimePickerSheet from './DateTimePickerSheet'
import PeoplePickerSheet from './PeoplePickerSheet'
import PersonAvatar from './PersonAvatar'
import { loadRecentPeople } from './peopleSearch'

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [leavingCrew, setLeavingCrew] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState(null)
  const [removingMember, setRemovingMember] = useState(false)

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
    const { data } = await supabase
      .from('group_members')
      .select('user_id, profiles(*)')
      .eq('group_id', groupId)

    setMembers((data || []).map((item) => ({
      id: item.user_id,
      name: item.profiles?.display_name || item.profiles?.username || 'Movie Fan',
      username: item.profiles?.username || '',
      avatarKey: item.profiles?.avatar_key || '',
      avatarUrl: item.profiles?.avatar_url || '',
    })))
  }

  async function getEvents() {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('group_id', groupId)
      .order('event_date', { ascending: true })

    setEvents(data || [])
  }

  async function createEvent() {
    const title = newEventTitle.trim()
    if (!title) return
    if (!newEventDate) {
      alert('Please set a date for the event.')
      return
    }

    const { data: createdEvent, error } = await supabase
      .from('events')
      .insert([{
        group_id: groupId,
        title,
        event_date: newEventDate || null,
        location_address: newEventLocation || null,
        status: 'voting',
        voting_method: 'hearts',
        created_by: session.user.id,
      }])
      .select()
      .single()

    if (!error && createdEvent) {
      const { data: groupMembers } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)

      const attendees = (groupMembers || []).map((member) => ({
        event_id: createdEvent.id,
        user_id: member.user_id,
      }))

      if (!attendees.some((attendee) => attendee.user_id === session.user.id)) {
        attendees.push({ event_id: createdEvent.id, user_id: session.user.id })
      }

      if (attendees.length > 0) {
        await supabase.from('event_attendees').insert(attendees)
      }

      setNewEventTitle('')
      setNewEventDate('')
      setNewEventLocation('')
      setShowCreate(false)
      navigate(`/room/${createdEvent.id}`, { state: { from: 'group', groupId } })
    }
  }

  function formatDateTimeLabel(value) {
    if (!value) return 'Pick date & time'
    const date = new Date(value)
    return date.toLocaleString([], {
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
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

  async function handleCopy() {
    if (!group?.share_code) return

    try {
      await copyToClipboard(`${window.location.origin}/join/${group.share_code}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Copy failed:', error)
      alert('Could not copy invite link.')
    }
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

  async function handleDeleteCrew() {
    if (!groupId) return

    setIsDeleting(true)

    try {
      const { error: eventUpdateError } = await supabase
        .from('events')
        .update({ group_id: null })
        .eq('group_id', groupId)

      if (eventUpdateError) throw eventUpdateError

      const { error: memberDeleteError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)

      if (memberDeleteError) throw memberDeleteError

      const { error: groupDeleteError } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId)

      if (groupDeleteError) throw groupDeleteError

      navigate('/')
    } catch (error) {
      console.error('Error deleting crew:', error)
      alert(error?.message || 'Could not delete crew.')
      setIsDeleting(false)
    }
  }

  async function handleRemoveMember() {
    if (!memberToRemove) return

    setRemovingMember(true)

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', memberToRemove.id)

      if (error) throw error

      setMembers(prev => prev.filter(member => member.id !== memberToRemove.id))
      setMemberToRemove(null)
    } catch (error) {
      console.error('Error removing crew member:', error)
      alert(error?.message || 'Could not remove member.')
    } finally {
      setRemovingMember(false)
    }
  }

  if (!group) return <LoadingSpinner label="Loading crew..." />

  const isCreator = group.created_by === session?.user?.id
  const nowMs = Date.now()
  const upcomingEvents = events
    .filter((event) => !event.event_date || new Date(event.event_date).getTime() >= nowMs)
    .sort((left, right) => {
      if (!left.event_date) return 1
      if (!right.event_date) return -1
      return new Date(left.event_date) - new Date(right.event_date)
    })
  const pastEvents = events
    .filter((event) => event.event_date && new Date(event.event_date).getTime() < nowMs)
    .sort((left, right) => new Date(right.event_date) - new Date(left.event_date))

  return (
    <>
      <div className="fixed inset-0 flex h-full w-full flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white">
        <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="rounded-full bg-white/10 p-2 text-white"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="rounded-full bg-white/10 p-2 text-white"
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
                      className="absolute right-0 top-full z-50 mt-2 flex w-48 flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-xl"
                    >
                      <button
                        onClick={() => { setIsEditingName(true); setShowMoreMenu(false) }}
                        className="flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold"
                      >
                        <Edit size={16} /> Edit Crew
                      </button>
                      {!isCreator && (
                        <button
                          onClick={() => { setShowLeaveConfirm(true); setShowMoreMenu(false) }}
                          className="flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold"
                        >
                          <LogOut size={16} /> Leave Crew
                        </button>
                      )}
                      {isCreator && (
                        <button
                          onClick={() => { setShowDeleteConfirm(true); setShowMoreMenu(false) }}
                          className="flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-rose-400"
                        >
                          <Trash2 size={16} /> Delete Crew
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {!isEditingName ? (
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/18 via-slate-900 to-rose-500/12 p-5 shadow-2xl">
                <div className="relative">
                  <div className="absolute right-0 top-0">
                    <button
                      onClick={handleCopy}
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white"
                    >
                      {copied ? <Check size={16} /> : <LinkIcon size={16} />}
                      {copied ? 'Copied' : 'Invite'}
                    </button>
                  </div>
                  <div className="min-w-0 pr-24">
                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-300">Crew</div>
                    <h1 className="mt-1 break-words text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
                      {group.name}
                    </h1>
                    <div className="mt-3 flex gap-2">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-slate-200">
                        <Users size={15} />
                        {members.length} {members.length === 1 ? 'Member' : 'Members'}
                      </span>
                      <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-slate-200">
                        <Calendar size={15} />
                        {events.length} {events.length === 1 ? 'Event' : 'Events'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Members</div>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <button
                      onClick={() => setShowAddMember(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1.5 text-[13px] font-black text-indigo-300"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-200">
                        <Plus size={14} />
                      </span>
                      <span>Add Member</span>
                    </button>
                    {members.map((member) => (
                      <div key={member.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
                        <PersonAvatar
                          name={member.name}
                          avatarKey={member.avatarKey}
                          avatarUrl={member.avatarUrl}
                          size={28}
                          className="border-white/10"
                          initialsClassName="text-[10px]"
                        />
                        <span className="max-w-[9rem] truncate text-[13px] font-bold text-slate-200">{member.name}</span>
                        {isCreator && member.id !== session?.user?.id && (
                          <button
                            type="button"
                            onClick={() => setMemberToRemove(member)}
                            className="rounded-full bg-white/5 p-1 text-slate-400"
                            aria-label={`Remove ${member.name}`}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Edit Crew</div>
                <div className="mt-3 space-y-3">
                  <input
                    value={editedGroupName}
                    onChange={(event) => setEditedGroupName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xl font-black text-white outline-none focus:border-indigo-500"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={updateGroupName} className="flex-1 rounded-2xl bg-indigo-500 px-4 py-3 font-black text-white">
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingName(false)
                        setEditedGroupName(group.name)
                      }}
                      className="flex-1 rounded-2xl bg-white/10 px-4 py-3 font-black text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Events</div>
                  <h2 className="mt-1 text-xl font-black text-white">Crew Events</h2>
                </div>
                <button
                  onClick={() => setShowCreate(!showCreate)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-indigo-500/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-300 ring-1 ring-indigo-500/30"
                >
                  <Plus size={14} />
                  {showCreate ? 'Close' : 'New Event'}
                </button>
              </div>

              {showCreate && (
                <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="space-y-3">
                    <input
                      placeholder="Event Title (e.g. Friday Horror)"
                      value={newEventTitle}
                      onChange={(event) => setNewEventTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.currentTarget.blur()
                        }
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-indigo-500"
                      autoFocus
                    />
                    <button
                      onClick={openDateTimePicker}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 font-bold text-white"
                    >
                      <Calendar size={16} />
                      {formatDateTimeLabel(newEventDate)}
                    </button>
                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-3">
                      <MapPin size={16} className="shrink-0 text-rose-400" />
                      <input
                        placeholder="Location (Optional)"
                        value={newEventLocation}
                        onChange={(event) => setNewEventLocation(event.target.value)}
                        className="w-full bg-transparent text-white outline-none"
                      />
                    </div>
                    <button
                      onClick={createEvent}
                      className="w-full rounded-2xl bg-indigo-500 py-3.5 font-black text-white"
                    >
                      Create Event
                    </button>
                  </div>
                </div>
              )}

              <div className="my-5 h-px bg-white/10" />

              <div className="space-y-5">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Upcoming Events</div>
                  <div className="mt-3 space-y-4">
                    {upcomingEvents.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                        No upcoming events yet.
                      </div>
                    ) : (
                      upcomingEvents.map((event) => (
                        <Link key={event.id} to={`/room/${event.id}`} state={{ from: 'group', groupId }} className="block">
                          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4 shadow-lg">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400">Crew Event</div>
                                <h3 className="mt-1 break-words text-lg font-black text-white">{event.title}</h3>
                                <div className="mt-3 space-y-2 text-sm text-slate-400">
                                  <div className="flex items-center gap-2">
                                    <Calendar size={14} className="text-rose-400" />
                                    <span>{event.event_date ? formatDateTimeLabel(event.event_date) : 'Date TBD'}</span>
                                  </div>
                                  {event.location_address && (
                                    <div className="flex items-center gap-2">
                                      <MapPin size={14} className="text-rose-400" />
                                      <span className="line-clamp-1">{event.location_address}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <ArrowRight size={18} className="shrink-0 text-slate-500" />
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>

                {pastEvents.length > 0 && (
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Past Events</div>
                    <div className="mt-3 space-y-3">
                      {pastEvents.map((event) => (
                        <Link key={event.id} to={`/room/${event.id}`} state={{ from: 'group', groupId }} className="block">
                          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">Past Event</div>
                                <h3 className="mt-1 break-words text-base font-black text-white">{event.title}</h3>
                                <div className="mt-2 text-sm text-slate-500">
                                  {event.event_date ? formatDateTimeLabel(event.event_date) : 'Date TBD'}
                                </div>
                              </div>
                              <ArrowRight size={18} className="shrink-0 text-slate-600" />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {showLeaveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900 p-6">
              <div className="text-lg font-bold">Leave this crew?</div>
              <p className="text-sm text-slate-400">
                You will need a new invite from a crew member to rejoin.
              </p>
              <div className="mt-2 flex gap-3">
                <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 rounded-xl bg-white/10 py-3 font-bold text-white">
                  Cancel
                </button>
                <button onClick={handleLeaveCrew} className="flex-1 rounded-xl bg-red-500 py-3 font-bold text-white" disabled={leavingCrew}>
                  {leavingCrew ? 'Leaving...' : 'Leave Crew'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900 p-6">
              <div className="text-lg font-bold text-rose-500">Delete this crew?</div>
              <p className="text-sm text-slate-400">
                This removes the crew and its member list. Existing events will stay in the app, but they will no longer belong to this crew.
              </p>
              <div className="mt-2 flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-xl bg-white/10 py-3 font-bold text-white">
                  Cancel
                </button>
                <button onClick={handleDeleteCrew} className="flex-1 rounded-xl bg-rose-500 py-3 font-bold text-white" disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete Crew'}
                </button>
              </div>
            </div>
          </div>
        )}

        {memberToRemove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900 p-6">
              <div className="text-lg font-bold">Remove member?</div>
              <p className="text-sm text-slate-400">
                Remove {memberToRemove.name} from this crew?
              </p>
              <div className="mt-2 flex gap-3">
                <button onClick={() => setMemberToRemove(null)} className="flex-1 rounded-xl bg-white/10 py-3 font-bold text-white">
                  Cancel
                </button>
                <button onClick={handleRemoveMember} className="flex-1 rounded-xl bg-rose-500 py-3 font-bold text-white" disabled={removingMember}>
                  {removingMember ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAddMember && (
        <AddMemberSheet
          groupId={groupId}
          onClose={() => {
            setShowAddMember(false)
            getMembers()
          }}
          currentMembers={members}
          onAdded={(person) => {
            setMembers(prev => {
              if (prev.some(member => member.id === person.id)) return prev
              return [...prev, {
                id: person.id,
                name: person.name,
                username: person.username || '',
                avatarKey: person.avatar_key || person.avatarKey || '',
                avatarUrl: person.avatar_url || person.avatarUrl || '',
              }].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
            })
          }}
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

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
  }

  return new Promise((resolve, reject) => {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-9999px'
    textArea.style.top = '0'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    try {
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      if (success) resolve()
      else reject(new Error('Copy command failed'))
    } catch (error) {
      document.body.removeChild(textArea)
      reject(error)
    }
  })
}

function AddMemberSheet({ groupId, onClose, currentMembers, onAdded }) {
  const [recentCrew, setRecentCrew] = useState([])

  useEffect(() => {
    let active = true

    async function fetchRecentCrew() {
      const { data: { user } } = await supabase.auth.getUser()
      const people = await loadRecentPeople(user?.id, {
        excludeIds: currentMembers.map((member) => member.id),
        limit: 12,
      })

      if (active) {
        setRecentCrew(people)
      }
    }

    fetchRecentCrew()
    return () => {
      active = false
    }
  }, [currentMembers])

  async function addMember(person) {
    const { error } = await supabase.from('group_members').insert([{ group_id: groupId, user_id: person.id }])
    if (error) {
      if (error.code === '23505') return
      throw new Error(error.message || 'Error adding member')
    }
    onAdded?.(person)
  }

  return (
    <PeoplePickerSheet
      title="Add Crew Members"
      subtitle="Search the app or pull in people you've already watched with."
      placeholder="Search by name or username"
      searchEmptyText="No users matched that search."
      browseEmptyText="Search the app to add someone new to this crew."
      excludeIds={currentMembers.map((member) => member.id)}
      sections={[
        {
          id: 'recent',
          title: 'Recent Movie People',
          description: 'People you have already shared events with.',
          items: recentCrew,
        },
      ]}
      onAdd={addMember}
      onClose={onClose}
    />
  )
}

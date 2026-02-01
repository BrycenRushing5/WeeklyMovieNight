import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "./supabaseClient"
import MovieCard from "./MovieCard"
import SearchMovies from "./SearchMovies"
import { AnimatePresence } from "framer-motion"
import { LogOut, Plus, User } from "lucide-react"
import DateTimePickerSheet from "./DateTimePickerSheet"

const Dashboard = ({ session }) => {
  const [activeTab, setActiveTab] = useState("events")
  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState("")
  const [crews, setCrews] = useState([])
  const [crewsLoading, setCrewsLoading] = useState(true)
  const [crewsError, setCrewsError] = useState("")
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [newEventTitle, setNewEventTitle] = useState("")
  const [newEventDate, setNewEventDate] = useState("")
  const [newEventLocation, setNewEventLocation] = useState("")
  const [selectedCrewId, setSelectedCrewId] = useState("")
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [showCreateCrew, setShowCreateCrew] = useState(false)
  const [newCrewName, setNewCrewName] = useState("")
  const [creatingCrew, setCreatingCrew] = useState(false)
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)
  const [pickedDate, setPickedDate] = useState(null)
  const [pickedTime, setPickedTime] = useState("")
  const [pickedPeriod, setPickedPeriod] = useState("PM")
  const [displayMonth, setDisplayMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [watchlist, setWatchlist] = useState([])
  const [watchlistLoading, setWatchlistLoading] = useState(true)
  const [watchlistError, setWatchlistError] = useState("")
  const [watchFilter, setWatchFilter] = useState("")
  const [showWatchlistSearch, setShowWatchlistSearch] = useState(false)

  const loadEvents = async (isActive = () => true) => {
    const userId = session?.user?.id
    if (!userId) {
      if (isActive()) setEventsLoading(false)
      return
    }
    setEventsLoading(true)
    setEventsError("")

    const [groupsResult, attendeesResult] = await Promise.all([
      supabase.from("group_members").select("group_id").eq("user_id", userId),
      supabase.from("event_attendees").select("event_id").eq("user_id", userId),
    ])

    if (groupsResult.error || attendeesResult.error) {
      if (isActive()) {
        setEventsError("Unable to load events right now.")
        setEventsLoading(false)
      }
      return
    }

    const groupIds = (groupsResult.data || [])
      .map((row) => row.group_id)
      .filter(Boolean)
    const eventIds = (attendeesResult.data || [])
      .map((row) => row.event_id)
      .filter(Boolean)

    const [createdResult, groupEventsResult, attendeeEventsResult] = await Promise.all([
      supabase.from("events").select("*").eq("created_by", userId),
      groupIds.length
        ? supabase.from("events").select("*").in("group_id", groupIds)
        : Promise.resolve({ data: [] }),
      eventIds.length
        ? supabase.from("events").select("*").in("id", eventIds)
        : Promise.resolve({ data: [] }),
    ])

    if (createdResult.error || groupEventsResult.error || attendeeEventsResult.error) {
      if (isActive()) {
        setEventsError("Unable to load events right now.")
        setEventsLoading(false)
      }
      return
    }

    const merged = new Map()
    ;[createdResult.data, groupEventsResult.data, attendeeEventsResult.data].forEach(
      (list) => {
        (list || []).forEach((event) => {
          if (event?.id && !merged.has(event.id)) {
            merged.set(event.id, event)
          }
        })
      }
    )

    const sorted = Array.from(merged.values()).sort((a, b) => {
      if (!a.event_date && !b.event_date) return 0
      if (!a.event_date) return 1
      if (!b.event_date) return -1
      return new Date(a.event_date) - new Date(b.event_date)
    })

    if (isActive()) {
      setEvents(sorted)
      setEventsLoading(false)
    }
  }

  const loadCrews = async (isActive = () => true) => {
    const userId = session?.user?.id
    if (!userId) {
      if (isActive()) setCrewsLoading(false)
      return
    }
    setCrewsLoading(true)
    setCrewsError("")

    const [membershipResult, createdResult] = await Promise.all([
      supabase.from("group_members").select("group_id").eq("user_id", userId),
      supabase.from("groups").select("*").eq("created_by", userId),
    ])

    let createdGroups = []
    let createdError = null

    if (createdResult.error) {
      if (createdResult.error.message?.includes('column "created_by" does not exist')) {
        createdGroups = []
      } else {
        createdError = createdResult.error
      }
    } else {
      createdGroups = createdResult.data || []
    }

    if (membershipResult.error && createdError) {
      if (isActive()) {
        setCrewsError("Unable to load crews right now.")
        setCrewsLoading(false)
      }
      return
    }

    const groupIds = (membershipResult.data || []).map((row) => row.group_id).filter(Boolean)
    let memberGroups = []

    if (groupIds.length > 0) {
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .in("id", groupIds)

      if (groupError && !createdGroups.length) {
        if (isActive()) {
          setCrewsError("Unable to load crews right now.")
          setCrewsLoading(false)
        }
        return
      }
      memberGroups = groupData || []
    }

    const merged = new Map()
    ;[memberGroups, createdGroups].forEach((list) => {
      (list || []).forEach((group) => {
        if (group?.id && !merged.has(group.id)) merged.set(group.id, group)
      })
    })

    const sorted = Array.from(merged.values()).sort((a, b) => {
      const left = a?.name || ""
      const right = b?.name || ""
      return left.localeCompare(right)
    })

    if (isActive()) {
      setCrews(sorted)
      setCrewsLoading(false)
    }
  }

  const loadWatchlist = async (isActive = () => true) => {
    const userId = session?.user?.id
    if (!userId) {
      if (isActive()) setWatchlistLoading(false)
      return
    }
    setWatchlistLoading(true)
    setWatchlistError("")

    const { data, error } = await supabase
      .from("user_wishlist")
      .select("movie:movies (*)")
      .eq("user_id", userId)

    if (error) {
      if (isActive()) {
        setWatchlistError("Unable to load watchlist right now.")
        setWatchlistLoading(false)
      }
      return
    }

    const movies = (data || []).map((row) => row.movie).filter(Boolean)
    if (isActive()) {
      setWatchlist(movies)
      setWatchlistLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    loadEvents(() => active)
    loadCrews(() => active)
    loadWatchlist(() => active)
    return () => {
      active = false
    }
  }, [session?.user?.id])

  const formatEventDate = (value) => {
    if (!value) return "TBD"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "TBD"
    return date.toLocaleDateString()
  }

  const formatDateTimeLabel = (value) => {
    if (!value) return "Pick date & time"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "Pick date & time"
    return date.toLocaleString([], { weekday: "short", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })
  }

  const openDateTimePicker = () => {
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
    setPickedTime(`${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}`)
    setPickedPeriod(base.getHours() >= 12 ? "PM" : "AM")
    setDisplayMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    setShowDateTimePicker(true)
  }

  const confirmDateTime = () => {
    if (!pickedDate || !pickedTime) return
    const [hh, mm] = pickedTime.split(":").map(Number)
    const composed = new Date(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate(), hh, mm, 0, 0)
    setNewEventDate(composed.toISOString())
    setShowDateTimePicker(false)
  }

  const createEvent = async () => {
    const userId = session?.user?.id
    const title = newEventTitle.trim()
    if (!userId || !title || creatingEvent) return
    setCreatingEvent(true)

    const payload = {
      title,
      event_date: newEventDate || null,
      location_address: newEventLocation.trim() || null,
      group_id: selectedCrewId || null,
      status: "voting",
      voting_method: "hearts",
      created_by: userId,
    }

    const { error } = await supabase.from("events").insert([payload])
    setCreatingEvent(false)

    if (error) {
      alert(`Error creating event: ${error.message}`)
      return
    }

    setNewEventTitle("")
    setNewEventDate("")
    setNewEventLocation("")
    setSelectedCrewId("")
    setShowCreateEvent(false)
    loadEvents()
  }

  const createCrew = async () => {
    const userId = session?.user?.id
    const name = newCrewName.trim()
    if (!userId || !name || creatingCrew) return
    setCreatingCrew(true)

    let createdGroup = null
    let insertError = null

    const primaryInsert = await supabase.from("groups").insert([{ name, created_by: userId }]).select().single()
    if (primaryInsert.error && primaryInsert.error.message?.includes('column "created_by" does not exist')) {
      const fallbackInsert = await supabase.from("groups").insert([{ name }]).select().single()
      createdGroup = fallbackInsert.data
      insertError = fallbackInsert.error
    } else {
      createdGroup = primaryInsert.data
      insertError = primaryInsert.error
    }

    if (insertError || !createdGroup?.id) {
      setCreatingCrew(false)
      alert(`Error creating crew: ${insertError?.message || "Unknown error"}`)
      return
    }

    const { error: memberError } = await supabase
      .from("group_members")
      .insert([{ group_id: createdGroup.id, user_id: userId }])

    setCreatingCrew(false)

    if (memberError) {
      alert(`Error joining crew: ${memberError.message}`)
      return
    }

    setNewCrewName("")
    setShowCreateCrew(false)
    loadCrews()
  }

  const removeFromWatchlist = async (movie) => {
    const userId = session?.user?.id
    if (!userId || !movie?.id) return
    const { error } = await supabase
      .from("user_wishlist")
      .delete()
      .eq("user_id", userId)
      .eq("movie_id", movie.id)

    if (error) {
      alert(`Error removing movie: ${error.message}`)
      return
    }

    setWatchlist((prev) => prev.filter((item) => item.id !== movie.id))
  }

  const addToWatchlist = async (movie) => {
    const userId = session?.user?.id
    if (!userId || !movie?.id) return
    const { error } = await supabase
      .from("user_wishlist")
      .insert([{ user_id: userId, movie_id: movie.id }])

    if (error) {
      if (error.code === "23505") {
        return
      }
      alert(`Error adding movie: ${error.message}`)
      return
    }

    loadWatchlist()
  }

  const filteredWatchlist = watchFilter
    ? watchlist.filter((movie) =>
        (movie.title || "").toLowerCase().includes(watchFilter.trim().toLowerCase())
      )
    : watchlist

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold m-0">My Hub</h1>
          <p className="text-sm text-slate-400">@username</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/profile" className="no-underline">
            <button
              type="button"
              className="w-auto bg-white/10 p-2.5 rounded-full text-white"
              title="Profile"
            >
              <User size={20} />
            </button>
          </Link>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="w-auto bg-white/10 p-2.5 rounded-full text-white"
            title="Log out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="flex bg-black/30 p-1 rounded-2xl mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("events")}
          className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 ${
            activeTab === "events" ? "bg-white/10 text-white" : "text-slate-400"
          }`}
        >
          Events
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("crews")}
          className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 ${
            activeTab === "crews" ? "bg-white/10 text-white" : "text-slate-400"
          }`}
        >
          Crews
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("watchlist")}
          className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 ${
            activeTab === "watchlist" ? "bg-white/10 text-white" : "text-slate-400"
          }`}
        >
          Watchlist
        </button>
      </div>

      {activeTab === "events" && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => setShowCreateEvent((prev) => !prev)}
            className="w-full mb-4 bg-primary text-white p-3 rounded-lg font-semibold"
          >
            {showCreateEvent ? "Cancel" : "+ New Event"}
          </button>

          {showCreateEvent && (
            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-5 flex flex-col gap-2.5">
              <input
                placeholder="Event Title (e.g. Friday Horror)"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                className="w-full bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base"
              />
              <button
                type="button"
                onClick={openDateTimePicker}
                className="flex items-center justify-center gap-2 bg-white/10 text-white p-3 rounded-lg"
              >
                {formatDateTimeLabel(newEventDate)}
              </button>
              <input
                placeholder="Location (Optional)"
                value={newEventLocation}
                onChange={(e) => setNewEventLocation(e.target.value)}
                className="w-full bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base"
              />
              <select
                value={selectedCrewId}
                onChange={(e) => setSelectedCrewId(e.target.value)}
                className="w-full bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base"
              >
                <option value="">No crew</option>
                {crews.map((crew) => (
                  <option key={crew.id} value={crew.id}>
                    {crew.name || "Untitled crew"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={createEvent}
                disabled={creatingEvent}
                className="mt-1 bg-accent text-black w-full p-3 rounded-full flex items-center justify-center font-bold disabled:opacity-60"
              >
                {creatingEvent ? "Creating..." : "Create Event"}
              </button>
            </div>
          )}

          {eventsLoading ? (
            <p className="text-sm text-center text-slate-400">Loading events...</p>
          ) : eventsError ? (
            <p className="text-sm text-center text-slate-400">{eventsError}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-center text-slate-400">You have no upcoming events yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {events.map((event) => (
                <Link key={event.id} to={`/room/${event.id}`} className="no-underline">
                  <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex justify-between items-center hover:bg-slate-800/50 transition-colors">
                    <div>
                      <div className="font-bold text-white">
                        {event.title || "Untitled event"}
                      </div>
                      <div className="text-sm text-slate-400">
                        {event.group_id ? "Crew event" : "Direct event"} •{" "}
                        {formatEventDate(event.event_date)}
                      </div>
                    </div>
                    <span className="text-slate-400">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === "crews" && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => setShowCreateCrew((prev) => !prev)}
            className="w-full mb-4 bg-primary text-white p-3 rounded-lg font-semibold"
          >
            {showCreateCrew ? "Cancel" : "+ Start New Crew"}
          </button>

          {showCreateCrew && (
            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-5">
              <input
                placeholder="Crew Name (e.g. Action Buffs)"
                value={newCrewName}
                onChange={(e) => setNewCrewName(e.target.value)}
                className="w-full bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base"
              />
              <button
                type="button"
                onClick={createCrew}
                disabled={creatingCrew}
                className="mt-2.5 bg-accent text-black w-full p-3 rounded-full flex items-center justify-center font-bold disabled:opacity-60"
              >
                {creatingCrew ? "Creating..." : "Create Crew"}
              </button>
            </div>
          )}

          {crewsLoading ? (
            <p className="text-sm text-center text-slate-400">Loading crews...</p>
          ) : crewsError ? (
            <p className="text-sm text-center text-slate-400">{crewsError}</p>
          ) : crews.length === 0 ? (
            <p className="text-sm text-center text-slate-400">Not currently in any crews.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {crews.map((crew) => (
                <Link key={crew.id} to={`/group/${crew.id}`} className="no-underline">
                  <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex justify-between items-center hover:bg-slate-800/50 transition-colors">
                    <div className="font-semibold text-white">{crew.name || "Untitled crew"}</div>
                    <span className="text-slate-400">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === "watchlist" && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="flex gap-2.5 mb-5">
            <input
              placeholder="Search your watchlist..."
              value={watchFilter}
              onChange={(e) => setWatchFilter(e.target.value)}
              className="w-full bg-black/30 border border-white/10 text-white p-3 rounded-lg text-base"
            />
            <button
              type="button"
              onClick={() => setShowWatchlistSearch(true)}
              className="w-auto bg-accent text-black px-3 rounded-lg"
              title="Add to watchlist"
            >
              <Plus size={18} />
            </button>
          </div>

          {watchlistLoading ? (
            <p className="text-sm text-center text-slate-400">Loading watchlist...</p>
          ) : watchlistError ? (
            <p className="text-sm text-center text-slate-400">{watchlistError}</p>
          ) : filteredWatchlist.length === 0 ? (
            <p className="text-sm text-center text-slate-400">No movies found.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredWatchlist.map((movie) => (
                <MovieCard key={movie.id} movie={movie}>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => removeFromWatchlist(movie)}
                      className="w-full bg-white/10 text-white p-2.5 rounded-lg"
                    >
                      Remove
                    </button>
                  </div>
                </MovieCard>
              ))}
            </div>
          )}
        </div>
      )}
      <AnimatePresence>
        {showWatchlistSearch && (
          <SearchMovies
            eventId={null}
            groupId={null}
            onClose={() => setShowWatchlistSearch(false)}
            customAction={addToWatchlist}
            customRemoveAction={removeFromWatchlist}
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
    </div>
  )
}

export default Dashboard

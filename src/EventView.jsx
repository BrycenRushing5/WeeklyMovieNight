import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { AnimatePresence, motion } from 'framer-motion'
import { ThumbsUp, ThumbsDown, Heart, Plus, Film, MapPin, Calendar, Ticket, ChevronLeft, Link as LinkIcon, Check, Users, Star, RotateCcw, ChevronDown, ChevronUp, X } from 'lucide-react'
import SearchMovies from './SearchMovies'
import ResultsView from './ResultsView'
import MovieCard from './MovieCard'
import RateMovie from './RateMovie'

export default function EventView() {
  const { code } = useParams() // Event ID
  const navigate = useNavigate()
  
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState(null)
  const [myGroups, setMyGroups] = useState([])
  const [showAddCrew, setShowAddCrew] = useState(false)
  const [selectedCrewId, setSelectedCrewId] = useState('')
  
  // Split Ballot States
  const [myNominations, setMyNominations] = useState([])
  const [crewNominations, setCrewNominations] = useState([])
  
  const [myVotes, setMyVotes] = useState({}) 
  const [showMyNominations, setShowMyNominations] = useState(true)
  const [showCrewNominations, setShowCrewNominations] = useState(true)
  const [ballotFilter, setBallotFilter] = useState('all')
  const [showSearch, setShowSearch] = useState(false)
  const [showResultsView, setShowResultsView] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteAddToGroup, setInviteAddToGroup] = useState(true)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [groupShareCode, setGroupShareCode] = useState('')
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [showRateMovie, setShowRateMovie] = useState(false)

  useEffect(() => {
    if (code) loadData()
  }, [code])

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
      }
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
    setMyVotes((prev) => ({ ...prev, [movieId]: voteValue }))
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        await supabase.from('votes').upsert([
            { event_id: code, movie_id: movieId, user_id: user.id, vote_type: voteValue }
        ], { onConflict: 'event_id, movie_id, user_id' })
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
    const confirmed = window.confirm('Remove this nomination for everyone? This also clears all votes on it.')
    if (!confirmed) return
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

  const openMaps = () => {
    if (!event.location_address) return
    const query = encodeURIComponent(event.location_address)
    window.open(`https://www.google.com/maps/search/?api=1&query=$${query}`, '_blank')
  }

  const handleCopyInvite = () => {
    const inviteLink = groupShareCode
      ? `${window.location.origin}/join/${groupShareCode}?eventId=${event.id}&addToGroup=${inviteAddToGroup ? '1' : '0'}`
      : `${window.location.origin}/room/${event.id}`
    navigator.clipboard.writeText(inviteLink)
    setInviteCopied(true)
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

  if (loading) return <div style={{padding:'40px', textAlign:'center'}}>Loading Event...</div>
  if (error) return <div style={{padding:'40px', textAlign:'center', color: '#ff4d4d'}}>{error}</div>
  if (!event) return null

  return (
    <div style={{ paddingBottom: '40px', paddingRight: '16px', paddingTop: '12px', height: '100%', overflowY: 'auto' }}>
      
      {/* BACK NAVIGATION */}
      <button onClick={() => navigate(event.group_id ? `/group/${event.group_id}` : `/`)} style={{ background: 'none', color: '#888', padding: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <ChevronLeft size={20} /> Back to {event.group_id ? 'Crew' : 'Hub'}
      </button>

      {/* HEADER */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.1 }}>{event.title}</h1>
        <div className="flex-gap" style={{ marginTop: '12px', color: '#ccc', fontSize: '0.9rem', flexWrap: 'wrap' }}>
            {event.event_date && (
                <span className="flex-gap" style={{background:'rgba(255,255,255,0.1)', padding:'5px 10px', borderRadius:'8px'}}>
                    <Calendar size={16}/> {new Date(event.event_date).toLocaleString([], {weekday:'short', month:'numeric', day:'numeric', hour:'numeric', minute:'2-digit'})}
                </span>
            )}
            {event.location_address && (
                <span className="flex-gap maps-link" onClick={openMaps} style={{background:'rgba(0, 229, 255, 0.1)', color: '#00E5FF', padding:'5px 10px', borderRadius:'8px', cursor: 'pointer'}}>
                    <MapPin size={16}/> {event.location_address}
                </span>
            )}
        </div>
      </div>

      {!isWatching && (
        <div className="flex-between" style={{ marginBottom: '20px' }}>
          <span className="text-sm" style={{ fontWeight: 'bold', letterSpacing: '1px' }}>BALLOT ({myNominations.length + crewNominations.length})</span>
          <div className="flex-gap">
              {event.group_id === null && userId && event.created_by === userId && (
                <button onClick={() => setShowAddCrew(!showAddCrew)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '10px', borderRadius: '50%' }}>
                    <Users size={18} />
                </button>
              )}
              <button onClick={() => setShowInvite(true)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '10px 14px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                  <LinkIcon size={18} /> Invite
              </button>
              <button onClick={() => setShowSearch(true)} style={{ background: 'var(--primary)', color: 'white', padding: '10px 16px', borderRadius: '20px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Plus size={18} /> Nominate
              </button>
              <button onClick={() => setShowResultsView(true)} style={{ background: '#ffd700', color: 'black', padding: '10px 14px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                  <Film size={18} /> Select
              </button>
          </div>
        </div>
      )}

      {!isWatching && (myNominations.length > 0 || crewNominations.length > 0) && (
        <div className="flex-gap" style={{ marginBottom: '18px', flexWrap: 'wrap' }}>
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
            style={{ background: ballotFilter === 'favorite' ? 'rgba(255,0,85,0.22)' : 'rgba(255,255,255,0.08)', color: ballotFilter === 'favorite' ? '#ff4d6d' : 'white', padding: '8px 12px', borderRadius: '999px', fontWeight: 600 }}
          >
            Favorites{totalFavorites > 0 ? ` (${totalFavorites})` : ''}
          </button>
          <button
            onClick={() => setBallotFilter('disliked')}
            style={{ background: ballotFilter === 'disliked' ? 'rgba(255,0,85,0.22)' : 'rgba(255,255,255,0.08)', color: ballotFilter === 'disliked' ? '#ff4d6d' : 'white', padding: '8px 12px', borderRadius: '999px', fontWeight: 600 }}
          >
            Dislikes{totalDisliked > 0 ? ` (${totalDisliked})` : ''}
          </button>
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
              <button onClick={handleAddCrew} style={{ background: '#00E5FF', color: 'black' }}>Save Crew</button>
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
                  onRemove={handleRemoveNomination}
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
                <button onClick={() => setShowInvite(false)} style={{ background: '#333', padding: '8px', width: '36px', height: '36px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>X</button>
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

              <button onClick={handleCopyInvite} style={{ background: '#00E5FF', color: 'black', padding: '12px', borderRadius: '12px', fontWeight: 700 }}>
                {inviteCopied ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}><Check size={16}/> Copied</span> : 'Copy Invite Link'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
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
    const colors = { down: 'var(--primary)', up: '#00E5FF', love: '#FF0055' }
    const icons = { down: ThumbsDown, up: ThumbsUp, love: Heart }
    const Icon = icons[type]
    return (
        <button onClick={onClick} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: active ? colors[type] : 'rgba(255,255,255,0.05)', color: active && type === 'up' ? 'black' : 'white', opacity: active ? 1 : 0.4, display: 'flex', justifyContent: 'center' }}>
            <Icon size={20} fill={active && type === 'love' ? 'white' : 'none'} />
        </button>
    )
}

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { AnimatePresence } from 'framer-motion'
import { ThumbsUp, ThumbsDown, Heart, Plus, Trophy, MapPin, Calendar, Ticket, ChevronLeft } from 'lucide-react'
import SearchMovies from './SearchMovies'
import ResultsView from './ResultsView'
import MovieCard from './MovieCard'

export default function MovieRoom() {
  const { code } = useParams() // This is the EVENT ID
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [nominatedMovies, setNominatedMovies] = useState([])
  const [myVotes, setMyVotes] = useState({}) 
  const [showSearch, setShowSearch] = useState(false)
  const [showResultsView, setShowResultsView] = useState(false)

  useEffect(() => {
    if (code) {
        loadData()
    }
  }, [code])

  async function loadData() {
    setLoading(true)
    // 1. Get Event Details
    const { data: eventData, error } = await supabase.from('events').select('*').eq('id', code).single()
    if (error) console.error("Event Error:", error)
    setEvent(eventData)

    // 2. Get Nominations
    await refreshNominations()

    // 3. Get My Votes
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        const { data: votes } = await supabase
            .from('votes')
            .select('movie_id, vote_type')
            .eq('event_id', code)
            .eq('user_id', user.id)
        
        const voteMap = {}
        votes?.forEach(v => voteMap[v.movie_id] = v.vote_type)
        setMyVotes(voteMap)
    }
    setLoading(false)
  }

  async function refreshNominations() {
    const { data } = await supabase
      .from('nominations')
      .select('id, nominated_by, nomination_type, movie:movies (*)')
      .eq('event_id', code)
    setNominatedMovies(data || [])
  }

  const handleVote = async (movieId, voteValue) => {
    setMyVotes((prev) => ({ ...prev, [movieId]: voteValue })) // Instant UI update
    
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        await supabase.from('votes').upsert([
            { event_id: code, movie_id: movieId, user_id: user.id, vote_type: voteValue }
        ], { onConflict: 'event_id, movie_id, user_id' })
    }
  }

  const handleAddNomination = async (movie, isTheater) => {
    const { data: { user } } = await supabase.auth.getUser()
    
    // Check if already nominated
    const alreadyExists = nominatedMovies.find(n => n.movie.id === movie.id)
    if (alreadyExists) return alert("Already nominated!")

    const { error } = await supabase.from('nominations').insert([
        { 
          event_id: code, 
          movie_id: movie.id, 
          nominated_by: user.id,
          nomination_type: isTheater ? 'theater' : 'streaming'
        } 
    ])
    if (!error) refreshNominations()
  }

  // Location Fallback Logic
  const openMaps = () => {
    if (!event.location_address) return
    const query = encodeURIComponent(event.location_address)
    // Works for "Bryce's House" or "123 Main St"
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
  }

  if (loading) return <div style={{padding:'40px', textAlign:'center'}}>Loading Event...</div>
  if (!event) return <div style={{padding:'40px', textAlign:'center'}}>Event not found.</div>

  return (
    <div style={{ paddingBottom: '40px' }}>
      
      {/* HEADER */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.1 }}>{event.title}</h1>
        
        <div className="flex-gap" style={{ marginTop: '12px', color: '#ccc', fontSize: '0.9rem', flexWrap: 'wrap' }}>
            {event.event_date && (
                <span className="flex-gap" style={{background:'rgba(255,255,255,0.1)', padding:'5px 10px', borderRadius:'8px'}}>
                    <Calendar size={16}/> {new Date(event.event_date).toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit'})}
                </span>
            )}
            {event.location_address && (
                <span className="flex-gap maps-link" onClick={openMaps} style={{background:'rgba(0, 229, 255, 0.1)', color: '#00E5FF', padding:'5px 10px', borderRadius:'8px', cursor: 'pointer'}}>
                    <MapPin size={16}/> {event.location_address}
                </span>
            )}
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="flex-between" style={{ marginBottom: '20px' }}>
        <span className="text-sm" style={{ fontWeight: 'bold', letterSpacing: '1px' }}>NOMINATIONS ({nominatedMovies.length})</span>
        <div className="flex-gap">
            <button onClick={() => setShowResultsView(true)} style={{ background: '#ffd700', color: 'black', padding: '10px', borderRadius: '50%' }}>
                <Trophy size={20} />
            </button>
            <button onClick={() => setShowSearch(true)} style={{ background: 'var(--primary)', color: 'white', padding: '10px 16px', borderRadius: '20px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Plus size={18} /> Add
            </button>
        </div>
      </div>

      {/* LIST */}
      {nominatedMovies.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '60px', color: '#666' }}>
          <Film size={48} style={{opacity:0.2, marginBottom:'10px'}}/>
          <p>No nominations yet.</p>
          <p className="text-sm">Be the first to suggest a movie!</p>
        </div>
      ) : (
        nominatedMovies.map((item) => {
          const currentVote = myVotes[item.movie.id]
          const isTheater = item.nomination_type === 'theater'
          
          return (
            <div key={item.id} className={isTheater ? 'theater-card' : ''} style={{ borderRadius: '16px', marginBottom: '16px' }}>
                <MovieCard movie={item.movie} meta={
                    isTheater ? <span style={{color: 'gold', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px'}}><Ticket size={14}/> THEATER TRIP</span> : null
                }>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <VoteBtn active={currentVote === -2} type="down" onClick={() => handleVote(item.movie.id, -2)} />
                        <VoteBtn active={currentVote === 1} type="up" onClick={() => handleVote(item.movie.id, 1)} />
                        <VoteBtn active={currentVote === 2} type="love" onClick={() => handleVote(item.movie.id, 2)} />
                    </div>
                </MovieCard>
            </div>
          )
        })
      )}

      {/* MODALS */}
      {showResultsView && <ResultsView eventId={code} onClose={() => setShowResultsView(false)} />}
      <AnimatePresence>
        {showSearch && (
            <SearchMovies 
                eventId={code} // PASSING EVENT ID TO ENABLE "EVENT MODE"
                onClose={() => setShowSearch(false)} 
                onNominate={handleAddNomination}
            />
        )}
      </AnimatePresence>
    </div>
  )
}

// Sub-component for cleaner button code
function VoteBtn({ active, type, onClick }) {
    const colors = { down: 'var(--primary)', up: '#00E5FF', love: '#FF0055' }
    const color = colors[type]
    const icons = { down: ThumbsDown, up: ThumbsUp, love: Heart }
    const Icon = icons[type]

    return (
        <button 
            onClick={onClick} 
            style={{ 
                flex: 1, padding: '12px', borderRadius: '12px', 
                background: active ? color : 'rgba(255,255,255,0.05)', 
                color: active && type === 'up' ? 'black' : 'white',
                opacity: active ? 1 : 0.4,
                display: 'flex', justifyContent: 'center'
            }}
        >
            <Icon size={20} fill={active && type === 'love' ? 'white' : 'none'} />
        </button>
    )
}

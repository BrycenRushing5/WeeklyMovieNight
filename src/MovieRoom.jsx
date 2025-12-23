import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import SearchMovies from './SearchMovies'
import HostView from './HostView'

export default function MovieRoom() {
  const { code } = useParams()
  const [nominatedMovies, setNominatedMovies] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [myVotes, setMyVotes] = useState({}) 
  const [showSearch, setShowSearch] = useState(false)
  const [showHostView, setShowHostView] = useState(false)
  const [isHost, setIsHost] = useState(false)

  // 1. Load the Session when the page opens
  useEffect(() => {
    getSession()
  }, [code]) // Run whenever the 'code' changes

  // 2. Load Nominations only AFTER we have a valid Session ID
  useEffect(() => {
    if (sessionId) {
      getNominations()
    }
  }, [sessionId])

  async function getSession() {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_code', code)
      .single()
    
    if (error || !data) {
      console.error("Error loading session:", error)
      return
    }

    setSessionId(data.id)
    
    // Check if I am the host
    const myId = localStorage.getItem('movie_user_id')
    if (data.host_user_id === myId) {
      setIsHost(true)
    }
  }

  async function getNominations() {
    const { data, error } = await supabase
      .from('nominations')
      .select(`
        id,
        nominated_by,
        movie:movies (
          id, title, description, genre, rt_score
        )
      `)
      .eq('session_id', sessionId)

    if (error) {
      console.error("Error loading nominations:", error)
    } else {
      setNominatedMovies(data || [])
    }
  }

  const handleVote = async (movieId, voteValue) => {
    // UI Update (Optimistic)
    setMyVotes((prev) => ({ ...prev, [movieId]: voteValue }))

    const userName = localStorage.getItem('movie_user_name')
    
    // Database Update
    await supabase.from('votes').upsert([
        { session_id: sessionId, movie_id: movieId, user_name: userName, vote_type: voteValue }
      ], { onConflict: 'session_id, movie_id, user_name' })
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h1>Room: {code}</h1>
        <button 
          onClick={() => setShowSearch(true)}
          style={{ padding: '10px 15px', background: 'green', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          + Add Movie
        </button>
      </div>

      {/* HOST BUTTON */}
      {isHost && (
        <div style={{marginBottom: '20px'}}>
            <button 
            onClick={() => setShowHostView(true)}
            style={{ 
                width: '100%',
                padding: '12px', background: '#ffd700', color: 'black', 
                border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' 
            }}
            >
            👑 View Host Results
            </button>
        </div>
      )}

      {/* MODALS */}
      {showHostView && <HostView sessionId={sessionId} onClose={() => setShowHostView(false)} />}
      
      {showSearch && (
        <SearchMovies 
          sessionId={sessionId} 
          onClose={() => setShowSearch(false)} 
          onNominate={() => getNominations()} 
        />
      )}

      {/* MOVIE LIST */}
      <div className="card-container">
        {nominatedMovies.length === 0 ? (
          <div style={{textAlign: 'center', marginTop: '40px', color: '#666'}}>
            <p>No movies nominated yet!</p>
            <p>Click <strong>+ Add Movie</strong> to start the list.</p>
          </div>
        ) : (
          nominatedMovies.map((item) => {
            const movie = item.movie
            const currentVote = myVotes[movie.id]

            return (
              <div key={item.id} style={{ 
                border: '1px solid #ddd', marginBottom: '15px', padding: '15px', borderRadius: '12px',
                backgroundColor: currentVote === -2 ? '#fff5f5' : currentVote === 2 ? '#f0faff' : 'white',
                boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
              }}>
                 <div style={{display:'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <h3 style={{marginTop: 0, marginBottom: '5px'}}>{movie.title}</h3>
                    <span style={{fontSize: '0.75rem', background: '#f0f0f0', padding: '3px 8px', borderRadius: '10px', color: '#555'}}>
                      {item.nominated_by}
                    </span>
                 </div>
                 <p style={{fontSize: '0.9em', color: '#666', margin: '5px 0 10px 0'}}>{movie.description}</p>
                 <div style={{fontSize: '0.85rem', marginBottom: '15px', fontWeight: 'bold', color: '#d32f2f'}}>
                    🍅 {movie.rt_score}%
                 </div>
                 
                 <div style={{ display: 'flex', gap: '10px' }}>
                   <button onClick={() => handleVote(movie.id, -2)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: currentVote === -2 ? '#ffcccc' : 'white', cursor: 'pointer' }}>👎</button>
                   <button onClick={() => handleVote(movie.id, 1)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: currentVote === 1 ? '#cce5ff' : 'white', cursor: 'pointer' }}>👍</button>
                   <button onClick={() => handleVote(movie.id, 2)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: currentVote === 2 ? '#ffccff' : 'white', cursor: 'pointer' }}>❤️</button>
                 </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function HostView({ sessionId, onClose }) {
  const [rankedMovies, setRankedMovies] = useState([])
  const [filterGenre, setFilterGenre] = useState('')
  const [sortBy, setSortBy] = useState('score') // 'score', 'hearts', 'likes'

  useEffect(() => {
    calculateResults()
    
    // Optional: Subscribe to real-time changes so the host watches votes roll in live!
    const subscription = supabase
      .channel('public:votes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, payload => {
        calculateResults()
      })
      .subscribe()

    return () => supabase.removeChannel(subscription)
  }, [sessionId])

  async function calculateResults() {
    // 1. Get all movies nominated
    const { data: nominations } = await supabase
      .from('nominations')
      .select(`
        id,
        movie:movies (id, title, genre, rt_score)
      `)
      .eq('session_id', sessionId)

    // 2. Get ALL votes for this session
    const { data: votes } = await supabase
      .from('votes')
      .select('*')
      .eq('session_id', sessionId)

    // 3. Math Time: Merge them together
    const results = nominations.map(nom => {
      const movieVotes = votes.filter(v => v.movie_id === nom.movie.id)
      
      const hearts = movieVotes.filter(v => v.vote_type === 2).length
      const likes = movieVotes.filter(v => v.vote_type === 1).length
      const dislikes = movieVotes.filter(v => v.vote_type === -2).length
      
      // Calculate Score: Heart(2) + Like(1) - Dislike(2)
      const score = (hearts * 2) + (likes * 1) - (dislikes * 2)

      return {
        ...nom.movie,
        stats: { hearts, likes, dislikes, score }
      }
    })

    setRankedMovies(results)
  }

  // Handle Sorting and Filtering
  const getDisplayList = () => {
    let list = [...rankedMovies]

    // Filter by Genre
    if (filterGenre) {
      list = list.filter(m => m.genre && m.genre.includes(filterGenre))
    }

    // Sort Logic
    list.sort((a, b) => {
      if (sortBy === 'score') return b.stats.score - a.stats.score
      if (sortBy === 'hearts') return b.stats.hearts - a.stats.hearts
      if (sortBy === 'likes') return b.stats.likes - a.stats.likes
      if (sortBy === 'dislikes') return b.stats.dislikes - a.stats.dislikes
      return 0
    })

    return list
  }

  const displayList = getDisplayList()

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'white', zIndex: 2000, padding: '20px', overflowY: 'auto'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1>🏆 The Leaderboard</h1>
          <button onClick={onClose} style={{ fontSize: '1.2rem', padding: '10px' }}>Close</button>
        </div>

        {/* CONTROLS */}
        <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <label><strong>Sort By: </strong></label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '5px' }}>
              <option value="score">Total Score</option>
              <option value="hearts">Most Hearts ❤️</option>
              <option value="likes">Most Likes 👍</option>
              <option value="dislikes">Controversial 👎</option>
            </select>
          </div>
          <div>
            <label><strong>Genre: </strong></label>
            <select value={filterGenre} onChange={(e) => setFilterGenre(e.target.value)} style={{ padding: '5px' }}>
              <option value="">All Genres</option>
              <option value="Action">Action</option>
              <option value="Comedy">Comedy</option>
              <option value="Horror">Horror</option>
              <option value="Sci-Fi">Sci-Fi</option>
            </select>
          </div>
        </div>

        {/* RANKED LIST */}
        {displayList.map((movie, index) => (
          <div key={movie.id} style={{ 
            display: 'flex', alignItems: 'center', 
            border: '1px solid #ccc', padding: '15px', marginBottom: '10px', borderRadius: '8px',
            background: index === 0 ? '#fff8e1' : 'white', // Highlight the winner
            borderLeft: index === 0 ? '5px solid gold' : '1px solid #ccc'
          }}>
            <div style={{ fontSize: '2rem', marginRight: '20px', fontWeight: 'bold', color: '#888' }}>
              #{index + 1}
            </div>
            
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: '0 0 5px 0' }}>{movie.title}</h2>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                Score: <strong>{movie.stats.score}</strong> • 🍅 {movie.rt_score}%
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '1.2rem' }}>❤️</div>
                <div>{movie.stats.hearts}</div>
              </div>
              <div>
                <div style={{ fontSize: '1.2rem' }}>👍</div>
                <div>{movie.stats.likes}</div>
              </div>
              <div>
                <div style={{ fontSize: '1.2rem' }}>👎</div>
                <div>{movie.stats.dislikes}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from './supabaseClient'
import { X, Heart, ThumbsUp, ThumbsDown, Shuffle } from 'lucide-react'

export default function HostView({ sessionId, onClose }) {
  const [movies, setMovies] = useState([])
  
  // Selection Logic
  const [method, setMethod] = useState('score') // 'score', 'loved', 'approval', 'random'
  const [ignoreDislikes, setIgnoreDislikes] = useState(false)
  const [revealResults, setRevealResults] = useState(false)
  const [randomPick, setRandomPick] = useState(null)
  
  useEffect(() => {
    calculateResults()
    const sub = supabase.channel('votes').on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, calculateResults).subscribe()
    return () => supabase.removeChannel(sub)
  }, [sessionId])
  
  useEffect(() => {
    setRevealResults(false)
    setRandomPick(null)
  }, [method, ignoreDislikes])

  async function calculateResults() {
    const { data: nominations } = await supabase.from('nominations').select('id, movie:movies (*)').eq('event_id', sessionId)
    const { data: votes } = await supabase.from('votes').select('*').eq('event_id', sessionId)

    const processed = nominations.map(nom => {
      const movieVotes = votes.filter(v => v.movie_id === nom.movie.id)
      const hearts = movieVotes.filter(v => v.vote_type === 2).length
      const likes = movieVotes.filter(v => v.vote_type === 1).length
      const dislikes = movieVotes.filter(v => v.vote_type === -2).length
      
      return {
        ...nom.movie,
        stats: {
          hearts, likes, dislikes,
          score: (hearts * 2) + likes - dislikes,
          approval: hearts + likes, // Total positive sentiment
          net_approval: hearts + likes - dislikes
        }
      }
    })
    setMovies(processed)
  }

  // SORTER LOGIC
  const getSortedList = () => {
    let list = [...movies]

    // 1. Random Filter?
    if (ignoreDislikes) {
        list = list.filter(m => m.stats.dislikes === 0)
    }

    if (method === 'random') {
        // We don't resort random, we just pick one. 
        // But for UI, let's just shuffle them visually.
        // In a real app, you'd hit "Spin" and it would pick one index.
        return list // Display list as is, the "Winner" logic handles the random pick
    }

    // 2. Sorting
    list.sort((a, b) => {
        if (method === 'score') return b.stats.score - a.stats.score
        if (method === 'loved') return b.stats.hearts - a.stats.hearts
        if (method === 'approval') return b.stats.approval - a.stats.approval
        return 0
    })

    return list
  }

  const sortedList = getSortedList()

  // Handle Random Pick Button
  const handleRandomPick = () => {
     if (sortedList.length === 0) return alert("No movies to pick from!")
     const random = sortedList[Math.floor(Math.random() * sortedList.length)]
     setRandomPick(random)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--bg-gradient)', overflowY: 'auto' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        
        {/* HEADER */}
        <div className="flex-between" style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '2rem', margin: 0 }}><span style={{color:'gold'}}>Results</span></h1>
            <button onClick={onClose} style={{ background: '#333', padding: '8px', borderRadius: '50%', color: 'white' }}><X size={20} /></button>
        </div>

        {/* CONTROLS */}
        <div className="glass-panel" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ flex: 1, padding: '12px' }}>
                    <option value="score">Highest Score (Weighted)</option>
                    <option value="loved">Most Loved (Hearts)</option>
                    <option value="approval">Most Approved (No Dislikes)</option>
                    <option value="random">Random Roulette</option>
                </select>
            </div>
            
            <div className="flex-between" style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                <span className="text-sm">Filter out Dislikes?</span>
                <input type="checkbox" checked={ignoreDislikes} onChange={(e) => setIgnoreDislikes(e.target.checked)} style={{width:'20px', height:'20px'}}/>
            </div>

            {method === 'random' && (
                <button onClick={handleRandomPick} style={{ marginTop: '15px', background: 'gold', color: 'black', width: '100%', padding: '15px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <Shuffle size={20}/> SPIN THE WHEEL
                </button>
            )}
            {method !== 'random' && (
                <button onClick={() => setRevealResults(true)} style={{ marginTop: '15px', background: '#00E5FF', color: 'black', width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 700 }}>
                    Reveal Results
                </button>
            )}
        </div>

        {/* LEADERBOARD */}
        {method === 'random' && randomPick && (
          <div className="glass-panel" style={{ marginBottom: '16px', borderLeft: '4px solid gold' }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Tonight's Pick</div>
            <div style={{ marginTop: '6px', fontSize: '1.3rem', fontWeight: 800, color: 'gold' }}>{randomPick.title}</div>
            <div className="text-sm" style={{ marginTop: '4px' }}>Score: {randomPick.stats.score}</div>
          </div>
        )}
        {revealResults && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.15 } } }}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
              {sortedList.map((movie, index) => {
                const place = index + 1
                const medal = place === 1 ? 'gold' : place === 2 ? '#c0c0c0' : place === 3 ? '#cd7f32' : null
                return (
                  <motion.div
                    key={movie.id}
                    variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                    className="glass-panel"
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px', borderRadius: '16px',
                      background: medal ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)',
                      borderLeft: medal ? `4px solid ${medal}` : '4px solid transparent'
                    }}
                  >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: medal || '#444' }}>#{place}</span>
                          <div>
                              <div style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{movie.title}</div>
                              <div className="text-sm">Score: {movie.stats.score}</div>
                          </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                          <Stat icon={Heart} val={movie.stats.hearts} color="#FF0055" />
                          <Stat icon={ThumbsUp} val={movie.stats.likes} color="#00E5FF" />
                          <Stat icon={ThumbsDown} val={movie.stats.dislikes} color="#666" />
                      </div>
                  </motion.div>
                )
              })}
          </motion.div>
        )}
        {!revealResults && method !== 'random' && (
          <div className="text-sm" style={{ textAlign: 'center', color: '#888' }}>
            Ready to reveal. Tap the button above.
          </div>
        )}

      </div>
    </div>
  )
}

function Stat({ icon: Icon, val, color }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <Icon size={16} color={color} />
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: color }}>{val}</div>
        </div>
    )
}

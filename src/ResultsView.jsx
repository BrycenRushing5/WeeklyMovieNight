import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from './supabaseClient'
import { X, Heart, ThumbsUp, ThumbsDown, Shuffle, PlayCircle, Minus } from 'lucide-react'

export default function ResultsView({ eventId, onClose, onSelected }) {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectingId, setSelectingId] = useState(null)
  
  // Selection Logic
  const [method, setMethod] = useState('score') // 'score', 'loved', 'approval', 'movie_random', 'decider_random'
  const [ignoreDislikes, setIgnoreDislikes] = useState(false)
  const [revealResults, setRevealResults] = useState(false)
  const [randomPick, setRandomPick] = useState(null)
  const [deciderPick, setDeciderPick] = useState(null)
  const [deciderPool, setDeciderPool] = useState([])
  const [activeMovie, setActiveMovie] = useState(null)
  const [spinTick, setSpinTick] = useState(0)
  const [showSelectionGuide, setShowSelectionGuide] = useState(true)
  const hasNominations = movies.length > 0
  const isReady = !loading && hasNominations
  const isMovieRoulette = method === 'movie_random'
  const isDeciderRoulette = method === 'decider_random'
  const isRoulette = isMovieRoulette || isDeciderRoulette
  
  useEffect(() => {
    calculateResults()
    loadDeciders()
    const sub = supabase.channel('votes').on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, calculateResults).subscribe()
    return () => supabase.removeChannel(sub)
  }, [eventId])

  useEffect(() => {
    const dismissed = localStorage.getItem('selectionGuideDismissed')
    setShowSelectionGuide(dismissed !== 'true')
  }, [])
  
  useEffect(() => {
    setRevealResults(false)
    setRandomPick(null)
    setDeciderPick(null)
  }, [method, ignoreDislikes])

  async function calculateResults() {
    setLoading(true)
    const { data: nominations } = await supabase
      .from('nominations')
      .select('id, nomination_type, theater_name, theater_notes, movie:movies (*)')
      .eq('event_id', eventId)
    const { data: votes } = await supabase
      .from('votes')
      .select('nomination_id, movie_id, vote_type, profiles(display_name, username)')
      .eq('event_id', eventId)
    const nominationList = nominations || []
    const voteList = votes || []
    const nominationIdByMovieId = new Map()
    nominationList.forEach((nom) => {
      if (nom.movie?.id) nominationIdByMovieId.set(nom.movie.id, nom.id)
    })

    const processed = nominationList.map(nom => {
      const movieVotes = voteList.filter(v => {
        const matchId = v.nomination_id || nominationIdByMovieId.get(v.movie_id)
        return matchId === nom.id
      })
      const hearts = movieVotes.filter(v => v.vote_type === 2).length
      const likes = movieVotes.filter(v => v.vote_type === 1).length
      const dislikes = movieVotes.filter(v => v.vote_type === -2).length
      const displayMovie = buildNominationDisplay(nom)
      
      return {
        ...displayMovie,
        nomination_id: nom.id,
        movie_id: nom.movie?.id || null,
        nomination_type: nom.nomination_type,
        theater_name: nom.theater_name,
        theater_notes: nom.theater_notes,
        stats: {
          hearts, likes, dislikes,
          score: (hearts * 2) + likes - dislikes,
          approval: hearts + likes, // Total positive sentiment
          net_approval: hearts + likes - dislikes
        },
        vote_details: movieVotes.map(v => ({
          type: v.vote_type,
          username: v.profiles?.display_name || v.profiles?.username || 'Movie Fan'
        }))
      }
    })
    setMovies(processed)
    setLoading(false)
  }

  async function loadDeciders() {
    if (!eventId) return
    const { data: eventData } = await supabase
      .from('events')
      .select('group_id')
      .eq('id', eventId)
      .single()
    let members = []
    if (eventData?.group_id) {
      const { data } = await supabase
        .from('group_members')
        .select('user_id, profiles(display_name, username)')
        .eq('group_id', eventData.group_id)
      members = data || []
    } else {
      const { data } = await supabase
        .from('event_attendees')
        .select('user_id, profiles(display_name, username)')
        .eq('event_id', eventId)
      members = data || []
    }
    const unique = new Map()
    members.forEach(m => {
      if (m?.user_id && !unique.has(m.user_id)) unique.set(m.user_id, m)
    })
    setDeciderPool(Array.from(unique.values()))
  }

  async function selectNomination(nominationId, movieId) {
    if (!nominationId || !hasNominations) return
    setSelectingId(nominationId)
    const { error } = await supabase
      .from('events')
      .update({ selected_nomination_id: nominationId, selected_movie_id: movieId || null })
      .eq('id', eventId)
    setSelectingId(null)
    if (!error) {
      if (onSelected) onSelected({ nominationId, movieId })
      onClose()
    }
  }

  // SORTER LOGIC
  const getSortedList = () => {
    let list = [...movies]

    // 1. Random Filter?
    if (ignoreDislikes) {
        list = list.filter(m => m.stats.dislikes === 0)
    }

    if (isRoulette) {
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
     if (isDeciderRoulette) {
       if (deciderPool.length === 0) return alert("No deciders available yet!")
       const pick = deciderPool[Math.floor(Math.random() * deciderPool.length)]
       setDeciderPick(pick)
     } else {
       const random = sortedList[Math.floor(Math.random() * sortedList.length)]
       setRandomPick(random)
     }
     setSpinTick(prev => prev + 1)
  }

  const topCount = 3

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--bg-gradient)', overflowY: 'auto' }}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 26, stiffness: 240 }}
        style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}
      >
        
        {/* HEADER */}
        <div className="flex-between" style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '2rem', margin: 0 }}><span style={{color:'gold'}}>Selection Time</span></h1>
            <button onClick={onClose} style={{ background: '#333', padding: '8px', borderRadius: '50%', color: 'white' }}><X size={20} /></button>
        </div>

        {showSelectionGuide && (
          <div style={{ position: 'relative', marginBottom: '14px', paddingTop: '8px', paddingRight: '12px' }}>
            <div
              style={{
                padding: '14px',
                borderRadius: '14px',
                border: '1px dashed rgba(0,229,255,0.35)',
                background: 'rgba(0,229,255,0.06)',
                textAlign: 'center'
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '6px', color: '#e2e8f0' }}>
                This is the selection page!
              </div>
              <div className="text-sm" style={{ color: '#cbd5e1' }}>
                This is where your group can select a movie. Once everyone has submitted their nominations and votes, use this page to select an option. You have multiple selection methods to choose from so have fun and enjoy your movie!
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('selectionGuideDismissed', 'true')
                setShowSelectionGuide(false)
              }}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                background: 'rgba(0,229,255,0.28)',
                color: '#00E5FF',
                borderRadius: '999px',
                padding: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 16px rgba(0,229,255,0.2)'
              }}
              aria-label="Minimize selection guide"
              title="Dismiss"
            >
              <Minus size={14} />
            </button>
          </div>
        )}

        {/* CONTROLS */}
        <div className="glass-panel" style={{ marginBottom: '20px' }}>
            <div className="text-sm" style={{ marginBottom: '8px' }}>Selection Method</div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ flex: 1, padding: '12px' }}>
                    <option value="score">Highest Score (Weighted)</option>
                    <option value="loved">Most Loved (Hearts)</option>
                    <option value="approval">Most Approved (No Dislikes)</option>
                    <option value="movie_random">Movie Roulette</option>
                    <option value="decider_random">Decider Roulette</option>
                </select>
            </div>
            
            <div className="flex-between" style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                <span className="text-sm" style={{ lineHeight: '1.4' }}>Filter out Dislikes?</span>
                <input className="toggle" type="checkbox" checked={ignoreDislikes} onChange={(e) => setIgnoreDislikes(e.target.checked)} />
            </div>

            {isRoulette && (
                <motion.button
                  onClick={() => isReady && handleRandomPick()}
                  disabled={!isReady}
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: 1.01 }}
                  style={{ marginTop: '15px', background: isReady ? 'gold' : 'rgba(255,255,255,0.08)', color: isReady ? 'black' : '#94a3b8', width: '100%', padding: '15px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: isReady ? 'pointer' : 'not-allowed' }}
                >
                    <motion.span
                      key={spinTick}
                      initial={{ rotate: 0 }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.6, ease: 'easeInOut' }}
                      style={{ display: 'flex' }}
                    >
                      <Shuffle size={20}/>
                    </motion.span>
                    {isDeciderRoulette ? 'PICK A DECIDER' : 'SPIN THE WHEEL'}
                </motion.button>
            )}
            {!isRoulette && (
                <button
                  onClick={() => isReady && setRevealResults(true)}
                  disabled={!isReady}
                  style={{ marginTop: '15px', background: isReady ? '#00E5FF' : 'rgba(255,255,255,0.08)', color: isReady ? 'black' : '#94a3b8', width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 700, cursor: isReady ? 'pointer' : 'not-allowed' }}
                >
                    Reveal Results
                </button>
            )}
        </div>

        {!loading && !hasNominations && (
          <div className="glass-panel" style={{ marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>No nominations yet</div>
            <div className="text-sm" style={{ color: '#9ca3af' }}>Add nominations to enable selection.</div>
          </div>
        )}

        {/* LEADERBOARD */}
        {isMovieRoulette && randomPick && (
          <motion.div
            key={`${randomPick.nomination_id}-${spinTick}`}
            initial={{ opacity: 0, y: 16, rotate: -1.5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 260 }}
            className="glass-panel"
            onClick={() => setActiveMovie(randomPick)}
            style={{ marginBottom: '16px', borderLeft: '4px solid gold', cursor: 'pointer' }}
          >
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Tonight's Pick</div>
            <div style={{ marginTop: '6px', fontSize: '1.3rem', fontWeight: 800, color: 'gold' }}>{randomPick.title}</div>
            <div className="text-sm" style={{ marginTop: '4px' }}>Score: {randomPick.stats.score}</div>
            <button
              onClick={(e) => { e.stopPropagation(); selectNomination(randomPick.nomination_id, randomPick.movie_id) }}
              disabled={selectingId === randomPick.nomination_id}
              style={{ marginTop: '12px', background: '#00E5FF', color: 'black', width: '100%', padding: '12px', borderRadius: '12px', fontWeight: 700 }}
            >
              {selectingId === randomPick.nomination_id ? 'Selecting...' : "Let's Watch This"}
            </button>
          </motion.div>
        )}
        {isDeciderRoulette && deciderPick && (
          <motion.div
            key={`${deciderPick.user_id || 'decider'}-${spinTick}`}
            initial={{ opacity: 0, y: 16, rotate: -1.5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 260 }}
            className="glass-panel"
            style={{ marginBottom: '16px', borderLeft: '4px solid #00E5FF' }}
          >
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Tonight's Decider</div>
            <div style={{ marginTop: '6px', fontSize: '1.3rem', fontWeight: 800, color: '#00E5FF' }}>
              {deciderPick.profiles?.display_name || deciderPick.profiles?.username || 'Movie Fan'}
            </div>
            <div className="text-sm" style={{ marginTop: '6px', color: '#cbd5e1' }}>
              Pick a movie from the list below.
            </div>
          </motion.div>
        )}
        {isDeciderRoulette && deciderPick && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            {sortedList.map((movie) => (
              <motion.div
                key={`decider-${movie.nomination_id}`}
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                className="glass-panel"
                onClick={() => setActiveMovie(movie)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  borderLeft: '4px solid transparent',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{movie.title}</div>
                    <div className="text-sm">Score: {movie.stats.score}</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); selectNomination(movie.nomination_id, movie.movie_id) }}
                      disabled={selectingId === movie.nomination_id}
                      style={{ alignSelf: 'flex-start', background: 'rgba(0,229,255,0.2)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.5)', padding: '6px 10px', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <PlayCircle size={14} />
                      {selectingId === movie.nomination_id ? 'Selecting...' : "Let's Watch This"}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Stat icon={Heart} val={movie.stats.hearts} color="#FF4D9A" />
                  <Stat icon={ThumbsUp} val={movie.stats.likes} color="#00E5FF" />
                  <Stat icon={ThumbsDown} val={movie.stats.dislikes} color="#FF4D6D" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
        {revealResults && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.15 } } }}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
              <motion.div
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                className="text-sm"
                style={{ marginBottom: '2px', letterSpacing: '0.08em', fontWeight: 700, color: '#cbd5e1' }}
              >
                RESULTS
              </motion.div>
              {sortedList.map((movie, index) => {
                const place = index + 1
                const medal = place === 1 ? 'gold' : place === 2 ? '#c0c0c0' : place === 3 ? '#cd7f32' : null
                return (
                  <motion.div
                    key={movie.nomination_id}
                    variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                    className="glass-panel"
                    onClick={() => setActiveMovie(movie)}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px', borderRadius: '16px',
                      background: medal ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)',
                      borderLeft: medal ? `4px solid ${medal}` : '4px solid transparent',
                      cursor: 'pointer'
                    }}
                  >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: medal || '#444' }}>#{place}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{movie.title}</div>
                          <div className="text-sm">Score: {movie.stats.score}</div>
                          {place <= topCount && (
                            <button
                              onClick={(e) => { e.stopPropagation(); selectNomination(movie.nomination_id, movie.movie_id) }}
                              disabled={selectingId === movie.nomination_id}
                              style={{ alignSelf: 'flex-start', background: 'rgba(0,229,255,0.2)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.5)', padding: '6px 10px', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <PlayCircle size={14} />
                              {selectingId === movie.nomination_id ? 'Selecting...' : "Let's Watch This"}
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <Stat icon={Heart} val={movie.stats.hearts} color="#FF4D9A" />
                        <Stat icon={ThumbsUp} val={movie.stats.likes} color="#00E5FF" />
                        <Stat icon={ThumbsDown} val={movie.stats.dislikes} color="#FF4D6D" />
                      </div>
                  </motion.div>
                )
              })}
          </motion.div>
        )}
        {!revealResults && !isRoulette && (
          <div className="text-sm" style={{ textAlign: 'center', color: '#888' }}>
            Ready to reveal? Tap the button above.
          </div>
        )}

        <AnimatePresence>
          {activeMovie && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, zIndex: 3100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 260 }}
                style={{ width: '100%', maxWidth: '520px', height: '70vh', background: '#1a1a2e', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column' }}
              >
                <div className="flex-between" style={{ marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{activeMovie.title}</h2>
                    <div className="text-sm" style={{ marginTop: '4px' }}>{activeMovie.genre?.join(', ') || 'Genre N/A'}</div>
                  </div>
                  <button onClick={() => setActiveMovie(null)} style={{ background: '#333', padding: '8px', borderRadius: '50%', color: 'white', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>X</button>
                </div>

                <div style={{ marginBottom: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {(() => {
                    const score = activeMovie.rt_score || '-'
                    const scoreColor = activeMovie.rt_score >= 80 ? '#4ade80' : activeMovie.rt_score >= 60 ? '#facc15' : '#94a3b8'
                    return (
                      <span style={{ 
                        background: 'rgba(0,0,0,0.3)',
                        padding: '6px 10px',
                        borderRadius: '10px',
                        border: `1px solid ${scoreColor}`,
                        color: scoreColor,
                        fontSize: '0.85rem',
                        fontWeight: 700
                      }}>
                        {score === '-' ? '-' : `🍅 ${score}%`}
                      </span>
                    )
                  })()}
                </div>

                <div style={{ marginBottom: '16px', overflowY: 'auto' }}>
                  {renderTheaterDetails(activeMovie)}
                  {activeMovie.description?.trim() && (
                    <p style={{ marginTop: 0, lineHeight: 1.5, color: '#cbd5e1' }}>
                      {activeMovie.description.trim()}
                    </p>
                  )}

                  <div className="glass-panel" style={{ padding: '14px', background: 'rgba(255,255,255,0.04)' }}>
                    <div style={{ fontWeight: 700, marginBottom: '10px' }}>Votes by reaction</div>
                    <VoteBreakdown movie={activeMovie} />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
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

function buildNominationDisplay(nomination) {
  if (!nomination) return null
  if (nomination.movie) return nomination.movie
  if (nomination.title) return nomination
  return {
    title: null,
    genre: null,
    description: null,
    rt_score: null
  }
}

function renderTheaterDetails(entry) {
  if (!entry || entry.nomination_type !== 'theater') return null
  const details = []
  if (entry.theater_name) details.push(entry.theater_name)
  if (entry.theater_notes) details.push(entry.theater_notes)
  if (details.length === 0) return null
  return (
    <div className="text-sm" style={{ color: '#fef3c7', marginBottom: '10px' }}>
      {details.join(' | ')}
    </div>
  )
}

function VoteBreakdown({ movie }) {
  const groups = {
    love: [],
    up: [],
    down: []
  }

  movie.vote_details?.forEach(v => {
    if (v.type === 2) groups.love.push(v.username)
    if (v.type === 1) groups.up.push(v.username)
    if (v.type === -2) groups.down.push(v.username)
  })

  const renderGroup = (label, items, color) => (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontWeight: 600, marginBottom: '6px', color }}>{label}</div>
      {items.length === 0 ? (
        <div className="text-sm">No votes yet.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {items.map((name, idx) => (
            <span key={`${label}-${idx}`} style={{ background: 'rgba(255,255,255,0.06)', padding: '4px 8px', borderRadius: '999px', fontSize: '0.8rem' }}>
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div>
      {renderGroup('Loved', groups.love, '#FF4D9A')}
      {renderGroup('Liked', groups.up, '#00E5FF')}
      {renderGroup('Disliked', groups.down, '#FF4D6D')}
    </div>
  )
}

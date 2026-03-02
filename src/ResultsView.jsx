import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from './supabaseClient'
import { X, Heart, ThumbsUp, ThumbsDown, Shuffle, PlayCircle, Minus } from 'lucide-react'
import MoviePoster from './MoviePoster'

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
      className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto"
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 26, stiffness: 240 }}
        className="max-w-2xl mx-auto p-5"
      >
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl m-0"><span className="text-amber-400 font-bold">Selection Time</span></h1>
            <button onClick={onClose} className="bg-slate-700 p-2 rounded-full text-white"><X size={20} /></button>
        </div>

        {showSelectionGuide && (
          <div className="relative mb-3.5 pt-2 pr-3">
            <div
              className="p-3.5 rounded-2xl border-dashed border border-accent/40 bg-accent/10 text-center"
            >
              <div className="font-bold mb-1.5 text-slate-200">
                This is the selection page!
              </div>
              <div className="text-sm text-slate-300">
                This is where your group can select a movie. Once everyone has submitted their nominations and votes, use this page to select an option. You have multiple selection methods to choose from so have fun and enjoy your movie!
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('selectionGuideDismissed', 'true')
                setShowSelectionGuide(false)
              }}
              className="absolute top-0 right-0 bg-accent/30 text-accent rounded-full p-1.5 inline-flex items-center justify-center shadow-lg shadow-accent/20"
              aria-label="Minimize selection guide"
              title="Dismiss"
            >
              <Minus size={14} />
            </button>
          </div>
        )}

        {/* CONTROLS */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-5">
            <div className="text-sm mb-2">Selection Method</div>
            <div className="flex gap-2.5 mb-4">
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="flex-1 p-3 bg-black/30 border border-white/10 text-white rounded-lg text-base">
                    <option value="score">Highest Score (Weighted)</option>
                    <option value="loved">Most Loved (Hearts)</option>
                    <option value="approval">Most Approved (No Dislikes)</option>
                    <option value="movie_random">Movie Roulette</option>
                    <option value="decider_random">Decider Roulette</option>
                </select>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-sm leading-snug">Filter out Dislikes?</span>
                <input className="toggle" type="checkbox" checked={ignoreDislikes} onChange={(e) => setIgnoreDislikes(e.target.checked)} />
            </div>

            {isRoulette && (
                <motion.button
                  onClick={() => isReady && handleRandomPick()}
                  disabled={!isReady}
                  whileTap={{ scale: 0.98 }}
                  className={`mt-4 w-full p-4 rounded-lg flex items-center justify-center gap-2.5 font-bold ${isReady ? 'bg-amber-400 text-black cursor-pointer' : 'bg-white/10 text-slate-400 cursor-not-allowed'}`}
                >
                    <motion.span
                      key={spinTick}
                      initial={{ rotate: 0 }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.6, ease: 'easeInOut' }}
                      className="flex"
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
                  className={`mt-4 w-full p-3.5 rounded-lg font-bold ${isReady ? 'bg-accent text-black cursor-pointer' : 'bg-white/10 text-slate-400 cursor-not-allowed'}`}
                >
                    Reveal Results
                </button>
            )}
        </div>

        {!loading && !hasNominations && (
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-5 text-center">
            <div className="font-bold mb-1.5">No nominations yet</div>
            <div className="text-sm text-slate-400">Add nominations to enable selection.</div>
          </div>
        )}

        {/* LEADERBOARD */}
        {isMovieRoulette && randomPick && (
          <motion.div
            key={`${randomPick.nomination_id}-${spinTick}`}
            initial={{ opacity: 0, y: 16, rotate: -1.5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 260 }}
            className="bg-slate-900/50 backdrop-blur-md border-l-4 border-amber-400 rounded-2xl p-4 mb-4 cursor-pointer"
            onClick={() => setActiveMovie(randomPick)}
          >
            <div className="font-bold text-lg">Tonight's Pick</div>
            <div className="mt-1.5 text-xl font-extrabold text-amber-400">{randomPick.title}</div>
            <div className="text-sm mt-1">Score: {randomPick.stats.score}</div>
            <button
              onClick={(e) => { e.stopPropagation(); selectNomination(randomPick.nomination_id, randomPick.movie_id) }}
              disabled={selectingId === randomPick.nomination_id}
              className="mt-3 bg-accent text-black w-full p-3 rounded-lg font-bold"
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
            className="bg-slate-900/50 backdrop-blur-md border-l-4 border-accent rounded-2xl p-4 mb-4"
          >
            <div className="font-bold text-lg">Tonight's Decider</div>
            <div className="mt-1.5 text-xl font-extrabold text-accent">
              {deciderPick.profiles?.display_name || deciderPick.profiles?.username || 'Movie Fan'}
            </div>
            <div className="text-sm text-slate-300 mt-1.5">
              Pick a movie from the list below.
            </div>
          </motion.div>
        )}
        {isDeciderRoulette && deciderPick && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            className="flex flex-col gap-3"
          >
            {sortedList.map((movie) => (
              <motion.div
                key={`decider-${movie.nomination_id}`}
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                className="bg-slate-900/50 backdrop-blur-md border-l-4 border-transparent rounded-2xl p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setActiveMovie(movie)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex flex-col gap-2">
                    <div className="font-bold text-base">{movie.title}</div>
                    <div className="text-sm">Score: {movie.stats.score}</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); selectNomination(movie.nomination_id, movie.movie_id) }}
                      disabled={selectingId === movie.nomination_id}
                      className="self-start bg-accent/20 text-accent border border-accent/50 px-2.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5"
                    >
                      <PlayCircle size={14} />
                      {selectingId === movie.nomination_id ? 'Selecting...' : "Let's Watch This"}
                    </button>
                  </div>
                </div>
                <div className="flex gap-3">
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
            className="flex flex-col gap-3"
          >
              <motion.div
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                className="text-sm mb-0.5 tracking-widest font-bold text-slate-300"
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
                    className={`bg-slate-900/50 backdrop-blur-md border rounded-2xl p-4 flex items-center justify-between cursor-pointer ${medal ? 'bg-white/5' : 'border-white/10'}`}
                    onClick={() => setActiveMovie(movie)}
                    style={{ borderColor: medal || 'rgba(255,255,255,0.1)' }}
                  >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-xl font-bold" style={{ color: medal || '#444' }}>#{place}</span>
                        <MoviePoster
                          title={movie.title}
                          posterPath={movie.poster_path}
                          className="w-10 h-14 shrink-0 rounded-md"
                          iconSize={16}
                        />
                        <div className="flex flex-col gap-2">
                          <div className="font-bold text-base">{movie.title}</div>
                          <div className="text-sm">Score: {movie.stats.score}</div>
                          {place <= topCount && (
                            <button
                              onClick={(e) => { e.stopPropagation(); selectNomination(movie.nomination_id, movie.movie_id) }}
                              disabled={selectingId === movie.nomination_id}
                              className="self-start bg-accent/20 text-accent border border-accent/50 px-2.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5"
                            >
                              <PlayCircle size={14} />
                              {selectingId === movie.nomination_id ? 'Selecting...' : "Let's Watch This"}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3">
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
          <div className="text-sm text-center text-slate-500">
            Ready to reveal? Tap the button above.
          </div>
        )}

        <AnimatePresence>
          {activeMovie && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md"
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 260 }}
                className="w-full max-w-lg h-[70vh] bg-slate-900 border-t border-white/10 rounded-t-3xl p-5 flex flex-col"
              >
                {(() => {
                  return (
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="flex gap-4 items-start">
                    <MoviePoster
                      title={activeMovie.title}
                      posterPath={activeMovie.poster_path}
                      className="w-20 shrink-0 aspect-[2/3] rounded-lg"
                      iconSize={20}
                      showTitle
                    />
                    <div>
                    <h2 className="m-0 text-xl font-bold">{activeMovie.title}</h2>
                    <div className="text-sm mt-1 text-slate-400">{activeMovie.genre?.join(', ') || 'Genre N/A'}</div>
                  </div>
                  </div>
                  <button onClick={() => setActiveMovie(null)} className="bg-slate-700 p-2 rounded-full text-white w-9 h-9 flex items-center justify-center">X</button>
                </div>
                  )
                })()}

                <div className="mb-3 flex gap-2.5 flex-wrap">
                  {(() => {
                    const score = activeMovie.rt_score || '-'
                    const scoreColor = activeMovie.rt_score >= 80 ? 'text-green-400 border-green-400' : activeMovie.rt_score >= 60 ? 'text-yellow-400 border-yellow-400' : 'text-slate-400 border-slate-400'
                    return (
                      <span className={`bg-black/30 px-2.5 py-1.5 rounded-lg border text-xs font-bold ${scoreColor}`}>
                        {score === '-' ? '-' : `🍅 ${score}%`}
                      </span>
                    )
                  })()}
                </div>

                <div className="mb-4 overflow-y-auto">
                  {renderTheaterDetails(activeMovie)}
                  {activeMovie.description?.trim() && (
                    <p className="mt-0 leading-relaxed text-slate-300">
                      {activeMovie.description.trim()}
                    </p>
                  )}

                  <div className="bg-white/5 rounded-2xl p-4">
                    <div className="font-bold mb-2.5">Votes by reaction</div>
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
    const shouldFill = Icon === Heart || Icon === ThumbsUp || Icon === ThumbsDown

    return (
        <div className="text-center">
            <Icon size={16} style={{ color }} fill={shouldFill ? 'currentColor' : 'none'} />
            <div className="text-sm font-bold" style={{ color }}>{val}</div>
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
    <div className="text-sm text-amber-200 mb-2.5">
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
    <div className="mb-2.5">
      <div className="font-semibold mb-1.5" style={{ color }}>{label}</div>
      {items.length === 0 ? (
        <div className="text-sm">No votes yet.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((name, idx) => (
            <span key={`${label}-${idx}`} className="bg-white/10 px-2 py-1 rounded-full text-xs">
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

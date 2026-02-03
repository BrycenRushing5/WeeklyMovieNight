import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { 
  Trophy, Shuffle, User, Star, X, RefreshCw, ChevronRight, 
  Ban, Ticket, Crown, Heart, ChevronLeft, Check, PlayCircle, ThumbsDown, ChevronDown
} from 'lucide-react'
import { POSTER_BASE_URL } from './tmdbClient'
import LoadingSpinner from './LoadingSpinner'
import { motion, AnimatePresence } from 'framer-motion'

const COLORS = [
  'bg-red-600', 'bg-orange-600', 'bg-amber-600', 'bg-yellow-600', 
  'bg-lime-600', 'bg-green-600', 'bg-emerald-600', 'bg-teal-600', 
  'bg-cyan-600', 'bg-sky-600', 'bg-blue-600', 'bg-indigo-600', 
  'bg-violet-600', 'bg-purple-600', 'bg-fuchsia-600', 'bg-pink-600', 'bg-rose-600'
]

export default function RevealView() {
  const { code } = useParams()
  const navigate = useNavigate()
  
  // Data State
  const [loading, setLoading] = useState(true)
  const [movies, setMovies] = useState([])
  const [attendees, setAttendees] = useState([])
  
  // UI State
  const [stage, setStage] = useState('setup') // setup, playing, result, decider_choice
  const [mode, setMode] = useState('battle') // battle, roulette, decider
  const [veto, setVeto] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [highlightType, setHighlightType] = useState('neutral') // 'neutral' (gold) | 'elimination' (red)
  
  // Game State
  const [items, setItems] = useState([])
  const [statuses, setStatuses] = useState({})
  const [highlightId, setHighlightId] = useState(null)
  const [winner, setWinner] = useState(null)
  const [rankings, setRankings] = useState([])
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [saving, setSaving] = useState(false)
  
  const processRef = useRef(null)

  useEffect(() => {
    loadData()
    return () => clearTimeout(processRef.current)
  }, [code])

  async function loadData() {
    setLoading(true)
    
    // 0. Fetch Event to check for existing selection
    const { data: eventData } = await supabase
        .from('events')
        .select('selected_movie_id')
        .eq('id', code)
        .single()

    // 1. Fetch Nominations & Votes
    const { data: nominations } = await supabase
      .from('nominations')
      .select('id, nomination_type, theater_name, theater_notes, nominated_by, movie:movies (*)')
      .eq('event_id', code)
      
    const { data: votes } = await supabase
      .from('votes')
      .select('nomination_id, movie_id, vote_type, user_id')
      .eq('event_id', code)

    // 3. Fetch Attendees (for Decider mode & name mapping)
    const { data: attendeeData } = await supabase
        .from('event_attendees')
        .select('user_id, profiles(display_name, username)')
        .eq('event_id', code)
    
    const userMap = {}
    const processedAttendees = (attendeeData || []).map((a, idx) => {
        const name = a.profiles?.display_name || a.profiles?.username || 'Movie Fan'
        userMap[a.user_id] = name
        return {
            id: a.user_id,
            name: name,
            color: COLORS[idx % COLORS.length]
        }
    })
    setAttendees(processedAttendees)

    // 2. Process Movies
    const processedMovies = (nominations || []).map(nom => {
      const movieData = nom.movie || { title: 'Unknown Title', id: `nom-${nom.id}` }
      
      // Match votes (handle both nomination_id and movie_id for robustness)
      const movieVotes = votes?.filter(v => {
         return v.nomination_id === nom.id || (v.movie_id && v.movie_id === movieData.id)
      }) || []

      const hearts = movieVotes.filter(v => v.vote_type === 2).length
      const likes = movieVotes.filter(v => v.vote_type === 1).length
      const dislikes = movieVotes.filter(v => v.vote_type === -2).length
      
      const voteDetails = movieVotes.map(v => ({
          type: v.vote_type,
          name: userMap[v.user_id] || 'Unknown'
      }))

      return {
        ...movieData,
        // Ensure we have a unique ID for the game loop
        id: nom.id, // Use nomination ID as the primary key for the game
        nomination_id: nom.id,
        movie_id: movieData.id,
        nomination_type: nom.nomination_type,
        theater_name: nom.theater_name,
        theater_notes: nom.theater_notes,
        poster_path: movieData.poster_path,
        nominated_by_name: userMap[nom.nominated_by] || 'Unknown',
        voteDetails,
        votes: {
            like: likes,
            super: hearts,
            dislike: dislikes,
            score: (hearts * 2) + likes - dislikes
        }
      }
    })
    setMovies(processedMovies)

    // Check if winner exists and jump to result
    if (eventData?.selected_movie_id) {
        const winnerItem = processedMovies.find(m => m.movie_id === eventData.selected_movie_id)
        if (winnerItem) {
            const ranked = [...processedMovies].sort((a, b) => {
                const scoreA = (a.votes.super * 2) + a.votes.like - a.votes.dislike
                const scoreB = (b.votes.super * 2) + b.votes.like - b.votes.dislike
                return scoreB - scoreA
            })
            setRankings(ranked)
            setWinner(winnerItem)
            setStage('result')
        }
    }

    setLoading(false)
  }

  const handleStart = () => {
    // 1. Prepare Data
    let pool = []
    if (mode === 'decider') {
        if (attendees.length < 1) {
            alert("No attendees found to decide!")
            return
        }
        pool = attendees.map(u => ({ ...u, type: 'user' }))
    } else {
        pool = movies.map(m => ({ ...m, type: 'movie' }))
        if (veto) {
            pool = pool.filter(m => m.votes.dislike === 0)
        }
    }

    if (pool.length < 2 && mode !== 'decider') {
        // If only 1 movie, just show it
        if (pool.length === 1) {
            setRankings(pool)
            finalizeGame(pool[0])
            return
        }
        alert("Not enough items for a ceremony! Add more nominations.")
        return
    }
    
    // For decider, we can run with 1 person, but animation is short
    if (mode === 'decider' && pool.length === 1) {
        setRankings(pool)
        finalizeGame(pool[0])
        return
    }

    setItems(pool)
    setStatuses({})
    setHighlightId(null)
    setStatusMessage("Starting...")
    setHighlightType('neutral')
    setStage('playing')

    // 2. Start Animation based on Mode
    if (mode === 'battle') runBattleRoyale(pool)
    else if (mode === 'roulette') runRoulette(pool)
    else if (mode === 'decider') runRoulette(pool)
  }

  const runBattleRoyale = (pool) => {
    // Rank them (Weighted: Super=2, Like=1, Dislike=-1)
    // Add random key for tie-breaking
    const poolWithRandom = pool.map(m => ({...m, randomKey: Math.random()}))
    
    const ranked = [...poolWithRandom].sort((a, b) => {
        const scoreA = (a.votes.super * 2) + a.votes.like - a.votes.dislike
        const scoreB = (b.votes.super * 2) + b.votes.like - b.votes.dislike
        if (scoreB !== scoreA) return scoreB - scoreA
        if (b.votes.super !== a.votes.super) return b.votes.super - a.votes.super
        return b.randomKey - a.randomKey
    })
    setRankings(ranked)

    const winnerItem = ranked[0]
    const runnerUp = ranked[1]
    
    // Losers are everyone except the top 2
    const losers = ranked.slice(2).reverse()

    let elimIndex = 0
    setStatusMessage("Eliminating Low Scores...")
    setHighlightType('elimination')

    const nextElim = () => {
        if (elimIndex < losers.length) {
            const target = losers[elimIndex]
            setHighlightId(target.id)
            
            setTimeout(() => {
                setStatuses(prev => ({ ...prev, [target.id]: 'eliminated' }))
                elimIndex++
                // Speed up then slow down slightly
                const delay = Math.max(150, 400 - (elimIndex * 40))
                processRef.current = setTimeout(nextElim, delay)
            }, 100)
        } else {
            // Only Winner & Runner Up remain -> Trigger Head-to-Head
            runHeadToHead(winnerItem, runnerUp)
        }
    }
    setTimeout(nextElim, 800)
  }

  const runHeadToHead = (winner, runnerUp) => {
      setStatusMessage("THE FINAL TWO!")
      setHighlightType('neutral') // Back to gold for the finale
      let pings = 0
      const maxPings = 12 // Number of bounces
      
      const pingPong = () => {
          const target = pings % 2 === 0 ? runnerUp : winner
          setHighlightId(target.id)
          pings++

          if (pings < maxPings) {
              // Start fast, get slightly slower
              const delay = 100 + (pings * 20)
              processRef.current = setTimeout(pingPong, delay)
          } else {
              // Final Kill
              setTimeout(() => {
                  setStatuses(prev => ({ ...prev, [runnerUp.id]: 'eliminated' }))
                  finalizeGame(winner)
              }, 500)
          }
      }
      pingPong()
  }

  const runRoulette = (pool) => {
    setHighlightType('neutral')
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    setRankings(shuffled)
    
    // For roulette, the winner is random
    const winnerItem = shuffled[0]
    
    let cycles = 0
    let index = 0
    let speed = 50
    const maxSpeed = 550 // Slower finish

    setStatusMessage("Spinning...")

    const spin = () => {
        const current = pool[index]
        setHighlightId(current.id)
        
        index = (index + 1) % pool.length
        if (index === 0) cycles++

        // Stop condition: Enough cycles AND we hit the winner AND we are moving slowly
        if (cycles > 3 && current.id === winnerItem.id && speed > maxSpeed) {
            setStatusMessage("Wait for it...")
            // Dramatic pause on the winner before revealing
            setTimeout(() => {
                finalizeGame(winnerItem)
            }, 1000)
        } else {
            // Friction logic
            if (cycles > 2) speed += 25
            if (cycles > 4) speed += 75
            
            processRef.current = setTimeout(spin, speed)
        }
    }
    spin()
  }

  const finalizeGame = (winItem) => {
    setWinner(winItem)
    setHighlightId(winItem.id)
    setStatuses(prev => ({ ...prev, [winItem.id]: 'winner' }))
    setHighlightType('neutral')
    setStatusMessage("WINNER!")
    
    setTimeout(() => {
        setStage(mode === 'decider' ? 'decider_choice' : 'result')
    }, 1000)
  }

  const handleConfirmWinner = async (winningMovie) => {
      setSaving(true)
      const { error } = await supabase
        .from('events')
        .update({ 
            selected_nomination_id: winningMovie.nomination_id, 
            selected_movie_id: winningMovie.movie_id 
        })
        .eq('id', code)
      
      setSaving(false)
      if (error) alert("Error saving winner: " + error.message)
      else {
          navigate(`/room/${code}`)
      }
  }

  if (loading) return <LoadingSpinner label="Loading ceremony..." />

  return (
    <div className="fixed inset-0 w-full h-full bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white flex flex-col overflow-hidden font-sans">
      {/* HEADER */}
      <div className="px-4 py-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/room/${code}`)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <ChevronLeft size={20} />
            </button>
            <h1 className="text-2xl font-black tracking-tighter text-amber-400">
            Reveal
            </h1>
        </div>
      </div>

      {/* SETUP SCREEN */}
      {stage === 'setup' && (
        <div className="flex-1 flex flex-col p-4 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto">
            <div className="flex-1 flex flex-col justify-center items-center max-w-md mx-auto w-full">
                <Trophy className="text-amber-400 mb-2 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" size={56} />
                <h1 className="text-2xl font-black mb-1 text-center">Selection Time</h1>
                <p className="text-slate-400 text-center mb-4 text-sm">How should we decide tonight's movie?</p>

                <div className="w-full space-y-2">
                    {/* Mode Select */}
                    {[
                        { id: 'battle', label: 'Battle Royale', icon: Trophy, desc: 'Eliminate lowest scores' },
                        { id: 'roulette', label: 'Movie Roulette', icon: Shuffle, desc: 'Random spin' },
                        { id: 'decider', label: 'Decider Roulette', icon: User, desc: 'Pick a person to choose' },
                    ].map(m => (
                        <button 
                            key={m.id}
                            onClick={() => setMode(m.id)}
                            className={`w-full p-4 rounded-xl border text-left flex items-center gap-4 transition-all ${mode === m.id ? 'bg-amber-400/10 border-amber-400 ring-1 ring-amber-400' : 'bg-slate-900 border-white/10 hover:bg-slate-800'}`}
                        >
                            <div className={`p-3 rounded-lg ${mode === m.id ? 'bg-amber-400 text-black' : 'bg-slate-800 text-slate-500'}`}>
                                <m.icon size={24} />
                            </div>
                            <div>
                                <h3 className={`font-bold text-lg ${mode === m.id ? 'text-amber-400' : 'text-white'}`}>{m.label}</h3>
                                <p className="text-xs text-slate-400">{m.desc}</p>
                            </div>
                        </button>
                    ))}

                    {/* Veto Toggle */}
                    <div className="mt-4 bg-slate-900/50 p-3 rounded-xl border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Ban className={veto ? 'text-red-500' : 'text-slate-500'} size={20} />
                            <div className="text-left">
                                <h4 className="font-bold text-sm">Filter Dislikes</h4>
                                <p className="text-[10px] text-slate-400">Remove hated movies</p>
                            </div>
                        </div>
                        <button onClick={() => setVeto(!veto)} className={`w-10 h-6 rounded-full transition-colors relative ${veto ? 'bg-red-500' : 'bg-slate-700'}`}>
                            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${veto ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>
            </div>
            <div className="mt-4 max-w-md mx-auto w-full">
                <button onClick={handleStart} className="w-full bg-amber-400 text-black font-black text-lg py-3 rounded-xl shadow-lg active:scale-95 transition-transform hover:bg-amber-300">
                    Start Ceremony
                </button>
            </div>
        </div>
      )}

      {/* ACTIVE GRID (Playing) */}
      {stage === 'playing' && (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-10">
                <div className="min-h-full flex flex-col justify-center">
                <div className={`grid gap-2 w-full max-w-4xl mx-auto transition-all duration-500 ${
                    items.length <= 4 ? 'grid-cols-2' : 
                    items.length <= 9 ? 'grid-cols-3' : 
                    items.length <= 16 ? 'grid-cols-4' : 
                    items.length <= 25 ? 'grid-cols-5' : 
                    items.length <= 36 ? 'grid-cols-6' :
                    items.length <= 49 ? 'grid-cols-7' :
                    'grid-cols-8'
                }`}>
                    {items.map(item => (
                        <GridItem 
                            key={item.id} 
                            item={item} 
                            type={mode === 'decider' ? 'user' : 'movie'}
                            status={statuses[item.id]} 
                            highlight={highlightId === item.id}
                            highlightType={highlightType}
                        />
                    ))}
                </div>
                </div>
            </div>
            <div className="text-center py-4 h-16 flex flex-col justify-center shrink-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent">
                <span className="text-amber-400 font-bold uppercase tracking-[0.2em] text-sm animate-pulse block drop-shadow-md">
                    {statusMessage}
                </span>
            </div>
        </div>
      )}

      {/* RESULT SCREEN */}
      {stage === 'result' && winner && (
        <div className="flex-1 flex flex-col items-center pt-10 px-6 animate-in fade-in duration-500 overflow-y-auto">
            <div className="relative group mb-6">
                <div 
                    onClick={() => setSelectedMovie(winner)}
                    className="relative w-48 aspect-[2/3] rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.4)] ring-4 ring-amber-400 flex-none animate-in zoom-in-95 duration-700 bg-slate-800 overflow-hidden cursor-pointer transition-transform hover:scale-105"
                >
                    {winner.poster_path ? (
                        <img src={`${POSTER_BASE_URL}${winner.poster_path}`} className="w-full h-full object-cover" alt="Winner"/>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold text-2xl p-4 text-center">{winner.title}</div>
                    )}
                </div>
                <div className="absolute -top-6 -right-6 bg-amber-400 text-black p-2 rounded-full shadow-lg animate-bounce z-10">
                    <Crown size={32} fill="white" />
                </div>
            </div>
            
            <h1 className="text-3xl font-black text-center mb-2 leading-tight text-white">{winner.title}</h1>
            {/* Year removed as requested */}

            <button 
                onClick={() => handleConfirmWinner(winner)}
                disabled={saving}
                className="w-full max-w-xs bg-amber-400 text-black font-black py-3 rounded-xl mb-4 hover:bg-amber-300 transition-colors flex items-center justify-center gap-2"
            >
                {saving ? 'Saving...' : <><Check size={20} /> Lock In Winner</>}
            </button>

            <button onClick={() => setStage('setup')} className="w-full max-w-xs bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-700 border border-white/10 mb-8">
                <RefreshCw size={18} /> Restart Ceremony
            </button>

            {/* Ranked List */}
            <div className="w-full max-w-sm animate-in slide-in-from-bottom-10 fade-in duration-700 pb-24">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 text-center flex items-center justify-center gap-2">
                    {mode === 'battle' ? 'Ranked Runners Up' : 'Other Options'} <ChevronDown size={14} />
                </h3>
                <div className="space-y-2">
                    {rankings.filter(i => i.id !== winner.id).map((item, idx) => (
                        <div key={item.id} 
                             onClick={() => setSelectedMovie(item)}
                             className="flex items-center gap-3 p-3 bg-slate-900/50 border border-white/5 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors">
                            <span className="font-mono text-slate-500 w-6 text-center font-bold">#{idx + 2}</span>
                            <div className="w-10 h-14 shrink-0 bg-slate-800 rounded overflow-hidden">
                                {item.poster_path && <img src={`${POSTER_BASE_URL}${item.poster_path}`} className="w-full h-full object-cover" alt=""/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-slate-300 truncate">{item.title}</h4>
                                <div className="flex gap-3 text-[10px] text-slate-500 mt-1">
                                    <span className="flex items-center gap-1"><Heart size={10} className="text-pink-500"/> {item.votes.super}</span>
                                    <span className="flex items-center gap-1"><Check size={10} className="text-blue-500"/> {item.votes.like}</span>
                                    <span className="flex items-center gap-1"><ThumbsDown size={10} className="text-red-500"/> {item.votes.dislike}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* DECIDER CHOICE SCREEN */}
      {stage === 'decider_choice' && winner && (
        <div className="flex-1 flex flex-col items-center pt-10 px-6 animate-in fade-in duration-500 overflow-y-auto">
            <div className={`w-40 h-40 shrink-0 rounded-3xl ${winner.color} mx-auto flex items-center justify-center mb-6 text-6xl font-black border-4 border-white shadow-[0_0_50px_rgba(245,158,11,0.4)] ring-4 ring-amber-400 overflow-hidden relative`}>
                {winner.avatar_url ? (
                    <img src={winner.avatar_url} className="w-full h-full object-cover" alt={winner.name} />
                ) : (
                    winner.name.charAt(0).toUpperCase()
                )}
            </div>
            
            <h1 className="text-3xl font-black text-center mb-2 leading-tight text-white">{winner.name} decides!</h1>
            <p className="text-slate-400 text-sm mb-6 text-center">Pass the phone to {winner.name}. It's their call.</p>

            <button onClick={() => setStage('setup')} className="w-full max-w-xs bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-700 border border-white/10 mb-8">
                <RefreshCw size={18} /> Restart Ceremony
            </button>

            {/* Top Contenders List */}
            <div className="w-full max-w-sm animate-in slide-in-from-bottom-10 fade-in duration-700 pb-24">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 text-center flex items-center justify-center gap-2">
                    Top Contenders <ChevronDown size={14} />
                </h3>
                <div className="space-y-2">
                    {movies
                        .filter(m => !veto || m.votes.dislike === 0)
                        .sort((a,b) => b.votes.score - a.votes.score)
                        .slice(0, 5)
                        .map(movie => (
                        <button 
                            key={movie.id}
                            disabled={saving}
                            onClick={() => handleConfirmWinner(movie)}
                            className="w-full flex items-center gap-3 p-3 bg-slate-900/50 border border-white/5 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors text-left group"
                        >
                            <div className="w-10 h-14 shrink-0 bg-slate-800 rounded overflow-hidden">
                                {movie.poster_path && <img src={`${POSTER_BASE_URL}${movie.poster_path}`} className="w-full h-full object-cover" alt=""/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-slate-300 group-hover:text-amber-400 transition-colors truncate">{movie.title}</h4>
                                <div className="flex gap-3 text-[10px] text-slate-500 mt-1">
                                    <span className="flex items-center gap-1"><Heart size={10} className="text-pink-500"/> {movie.votes.super}</span>
                                    <span className="flex items-center gap-1"><Check size={10} className="text-blue-500"/> {movie.votes.like}</span>
                                </div>
                            </div>
                            <div className="self-center pl-2">
                                {saving ? <LoadingSpinner size={16} showLabel={false} /> : <PlayCircle size={20} className="text-slate-600 group-hover:text-amber-400" />}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {selectedMovie && (
        <MovieDetailModal 
            movie={selectedMovie} 
            onClose={() => setSelectedMovie(null)} 
            onConfirm={() => handleConfirmWinner(selectedMovie)}
            isWinner={winner && selectedMovie.id === winner.id}
        />
      )}

    </div>
  )
}

const GridItem = ({ item, type, status, highlight, highlightType }) => {
    const isEliminated = status === 'eliminated'
    const isActive = highlight
    const posterUrl = item.poster_path ? `${POSTER_BASE_URL}${item.poster_path}` : null

    // Determine border color based on highlight type
    const borderColor = highlightType === 'elimination' ? 'border-red-500 ring-red-500 shadow-red-500/50' : 'border-amber-500 ring-amber-500 shadow-amber-500/50'

    return (
        <div className={`relative ${type === 'user' ? 'aspect-square' : 'aspect-[2/3]'} rounded-xl overflow-hidden transition-all duration-300 bg-slate-800 border ${isActive ? `${borderColor} ring-4 scale-105 z-20 shadow-[0_0_30px_rgba(0,0,0,0.5)]` : 'border-white/10'} ${isEliminated ? 'opacity-30 grayscale scale-95' : ''}`}>
            {type === 'movie' ? (
                <>
                    {posterUrl ? (
                        <img src={posterUrl} className="w-full h-full object-cover" alt={item.title} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center p-2 text-center text-xs font-bold text-slate-500">
                            {item.title}
                        </div>
                    )}
                    
                    {!isEliminated && (
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6">
                            <p className="text-[10px] font-bold text-white truncate text-center">{item.title}</p>
                        </div>
                    )}
                </>
            ) : (
                <div className={`w-full h-full flex flex-col items-center justify-center ${item.color} relative`}>
                    {item.avatar_url ? (
                        <img src={item.avatar_url} className="w-full h-full object-cover" alt={item.name} />
                    ) : (
                        <span className="text-4xl font-black text-white/90">{item.name.charAt(0).toUpperCase()}</span>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1 pb-2">
                        <span className="text-[10px] font-bold text-white/90 block text-center truncate w-full">{item.name}</span>
                    </div>
                </div>
            )}
            
            {isEliminated && (
                <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center animate-in zoom-in duration-300">
                    <X className="text-red-500 opacity-80" size={48} strokeWidth={3} />
                </div>
            )}
        </div>
    )
}

const MovieDetailModal = ({ movie, onClose, onConfirm, isWinner }) => {
    if (!movie) return null;
    const posterUrl = movie.poster_path ? `${POSTER_BASE_URL}${movie.poster_path}` : null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div className="w-full max-w-lg max-h-[85vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex gap-4 mb-6">
                        <div className="w-24 shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-slate-800 shadow-lg">
                            {posterUrl ? <img src={posterUrl} className="w-full h-full object-cover" alt={movie.title} /> : <div className="w-full h-full bg-slate-800" />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold leading-tight mb-1 text-white">{movie.title}</h2>
                            <div className="text-sm text-slate-400 mb-2">{movie.year}</div>
                            {movie.rt_score && (
                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-xs font-bold text-amber-400 mb-2">
                                    <Star size={12} fill="currentColor" /> {movie.rt_score}%
                                </div>
                            )}
                            <div className="text-xs text-slate-500">
                                Nominated by <span className="text-slate-300 font-bold">{movie.nominated_by_name}</span>
                            </div>
                        </div>
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed mb-6">
                        {movie.description || "No description available."}
                    </p>

                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Votes</h3>
                        {movie.voteDetails.filter(v => v.type === 2).length > 0 && (
                            <div>
                                <div className="text-xs font-bold text-pink-500 mb-1 flex items-center gap-1"><Heart size={12} fill="currentColor"/> Super Likes</div>
                                <div className="flex flex-wrap gap-2">{movie.voteDetails.filter(v => v.type === 2).map((v, i) => <span key={i} className="text-xs bg-pink-500/10 text-pink-400 px-2 py-1 rounded-full">{v.name}</span>)}</div>
                            </div>
                        )}
                        {movie.voteDetails.filter(v => v.type === 1).length > 0 && (
                            <div>
                                <div className="text-xs font-bold text-blue-500 mb-1 flex items-center gap-1"><Check size={12} /> Likes</div>
                                <div className="flex flex-wrap gap-2">{movie.voteDetails.filter(v => v.type === 1).map((v, i) => <span key={i} className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded-full">{v.name}</span>)}</div>
                            </div>
                        )}
                        {movie.voteDetails.filter(v => v.type === -2).length > 0 && (
                            <div>
                                <div className="text-xs font-bold text-red-500 mb-1 flex items-center gap-1"><ThumbsDown size={12} /> Dislikes</div>
                                <div className="flex flex-wrap gap-2">{movie.voteDetails.filter(v => v.type === -2).map((v, i) => <span key={i} className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded-full">{v.name}</span>)}</div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-4 border-t border-white/10 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors">
                        Close
                    </button>
                    {onConfirm && (
                        <button onClick={onConfirm} className="flex-1 py-3 bg-amber-400 text-black font-bold rounded-xl hover:bg-amber-300 transition-colors">
                            {isWinner ? 'Confirm Winner' : 'Select This'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

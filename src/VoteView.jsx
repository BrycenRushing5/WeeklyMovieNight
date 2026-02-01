import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'
import { 
  Layers, LayoutGrid, ThumbsUp, Heart, Undo2, 
  X, Film, Ticket, Clapperboard, ChevronLeft, Star, Check, Info
} from 'lucide-react'
import { POSTER_BASE_URL } from './tmdbClient'
import LoadingSpinner from './LoadingSpinner'

export default function VoteView() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState('stack')
  const [nominations, setNominations] = useState([])
  const [myVotes, setMyVotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  
  // Stack State
  const [stackQueue, setStackQueue] = useState([])
  const [exitDirection, setExitDirection] = useState(0) // Used for animation direction
  
  // Grid State
  const [selectedNomination, setSelectedNomination] = useState(null)

  useEffect(() => {
    loadData()
  }, [code])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id)

    // Fetch Nominations
    const { data: noms } = await supabase
      .from('nominations')
      .select('id, nomination_type, theater_name, theater_notes, movie:movies (*)')
      .eq('event_id', code)
    
    const loadedNoms = noms || []
    setNominations(loadedNoms)

    // Fetch Votes
    if (user) {
      const { data: votes } = await supabase
        .from('votes')
        .select('nomination_id, vote_type')
        .eq('event_id', code)
        .eq('user_id', user.id)
      
      const voteMap = {}
      votes?.forEach(v => {
        voteMap[v.nomination_id] = v.vote_type
      })
      setMyVotes(voteMap)
      
      // Initialize Stack Queue (Unvoted items)
      const unvoted = loadedNoms.filter(n => !voteMap[n.id])
      setStackQueue(unvoted)
    }
    setLoading(false)
  }

  const handleVote = async (nominationId, voteType, fromStack = false) => {
    // Determine if we are removing a vote (toggling off)
    const currentVote = myVotes[nominationId]
    const isRemoving = currentVote === voteType
    const newVote = isRemoving ? null : voteType

    // Optimistic Update
    setMyVotes(prev => {
        const next = { ...prev }
        if (newVote === null) delete next[nominationId]
        else next[nominationId] = newVote
        return next
    })
    
    // If voting from stack, remove from queue
    if (fromStack) {
      setExitDirection(voteType) // Tell the animation which way to go
      setTimeout(() => {
          setStackQueue(prev => prev.filter(n => n.id !== nominationId))
          setExitDirection(0) // Reset
      }, 0) // Immediate state update for exit animation trigger
    }

    if (userId) {
      if (isRemoving) {
        await supabase.from('votes').delete()
          .eq('event_id', code)
          .eq('nomination_id', nominationId)
          .eq('user_id', userId)
      } else {
        await supabase.from('votes').upsert([
            { event_id: code, nomination_id: nominationId, user_id: userId, vote_type: newVote }
        ], { onConflict: 'event_id, nomination_id, user_id' })
      }
    }
  }

  const handleSkip = (nominationId) => {
    setExitDirection(0) // 0 implies skip/down/fade
    // Move to bottom of stack
    setStackQueue(prev => {
      const item = prev.find(n => n.id === nominationId)
      if (!item) return prev
      const remaining = prev.filter(n => n.id !== nominationId)
      return [...remaining, item]
    })
  }

  if (loading) return <LoadingSpinner label="Loading ballot..." />

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* HEADER */}
      <div className="px-4 py-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-20">
        <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/room/${code}`)} className="p-2 rounded-full bg-white/10 hover:bg-white/20">
                <ChevronLeft size={20} />
            </button>
            <h1 className="text-2xl font-black tracking-tighter text-indigo-500">
            Vote {viewMode === 'stack' && stackQueue.length > 0 && <span className="text-white/30 text-lg ml-1">({stackQueue.length})</span>}
            </h1>
        </div>
        <div className="flex bg-white/10 rounded-lg p-1">
            <button 
                onClick={() => setViewMode('stack')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'stack' ? 'bg-white/20 text-white' : 'text-slate-400'}`}
            >
                <Layers size={20} />
            </button>
            <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white/20 text-white' : 'text-slate-400'}`}
            >
                <LayoutGrid size={20} />
            </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 relative w-full max-w-md mx-auto h-full flex flex-col">
        {viewMode === 'stack' ? (
            <StackView 
                queue={stackQueue} 
                onVote={handleVote} 
                onSkip={handleSkip}
                exitDirection={exitDirection}
            />
        ) : (
            <GridView 
                nominations={nominations} 
                myVotes={myVotes} 
                onSelect={(nom) => setSelectedNomination(nom)}
            />
        )}

        {/* Expanded Card Modal */}
        <AnimatePresence>
            {selectedNomination && (
                <ExpandedCard 
                    nom={selectedNomination} 
                    vote={myVotes[selectedNomination.id]} 
                    onVote={(id, type) => handleVote(id, type, false)} 
                    onClose={() => setSelectedNomination(null)} 
                />
            )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StackView({ queue, onVote, onSkip, exitDirection }) {
    const activeItem = queue[0]
    const nextItems = queue.slice(1, 5) // Show next 4 cards

    if (!activeItem) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-full aspect-[2/3] max-h-[60vh] border-4 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-4">
                    <Check size={64} className="text-green-500" />
                    <div className="text-2xl font-bold text-slate-200">All Voted!</div>
                    <p className="text-slate-400">Waiting for more nominations...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col relative">
            <div className="flex-1 relative flex items-center justify-center p-4">
                {/* Background Cards */}
                {nextItems.reverse().map((item, index) => {
                    const depth = nextItems.length - 1 - index
                    const scale = 0.95 - (depth * 0.05)
                    const translateY = -35 - (depth * 35)
                    const overlayOpacity = 0.2 + (depth * 0.15)

                    return (
                        <div 
                            key={item.id}
                            className="absolute w-full max-w-sm aspect-[2/3] bg-slate-800 rounded-3xl border border-white/5 shadow-2xl overflow-hidden pointer-events-none transition-all duration-500 ease-in-out"
                            style={{
                                zIndex: 10 - depth,
                                transform: `scale(${scale}) translateY(${translateY}px)`,
                            }}
                        >
                             <CardVisuals movie={item.movie} showMeta isTheater={item.nomination_type === 'theater'} />
                             <div className="absolute inset-0 bg-black transition-opacity duration-500" style={{ opacity: overlayOpacity }} />
                        </div>
                    )
                })}

                {/* Active Card (Draggable) */}
                <AnimatePresence custom={exitDirection}>
                    <DraggableCard 
                        key={activeItem.id}
                        item={activeItem}
                        onVote={onVote}
                        onSkip={onSkip}
                    />
                </AnimatePresence>
            </div>

            {/* Action Bar (Static in Stack View) */}
            {activeItem && (
                <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 z-50">
                    <ActionButton icon={X} color="text-red-500" borderColor="border-red-500" onClick={() => onVote(activeItem.id, -2, true)} />
                    <ActionButton icon={Undo2} color="text-yellow-400" borderColor="border-yellow-400" onClick={() => onSkip(activeItem.id)} />
                    <ActionButton icon={Heart} color="text-pink-500" borderColor="border-pink-500" onClick={() => onVote(activeItem.id, 2, true)} />
                    <ActionButton icon={ThumbsUp} color="text-blue-500" borderColor="border-blue-500" onClick={() => onVote(activeItem.id, 1, true)} />
                </div>
            )}
        </div>
    )
}

function DraggableCard({ item, onVote, onSkip }) {
    const [isFlipped, setIsFlipped] = useState(false)
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    
    const rotate = useTransform(x, [-200, 200], [-25, 25])
    
    // Opacity transforms for stamps
    const opacityLike = useTransform(x, [50, 150], [0, 1])
    const opacityNope = useTransform(x, [-50, -150], [0, 1])
    const opacitySuper = useTransform(y, [-50, -150], [0, 1])
    
    const handleDragEnd = (event, info) => {
        const threshold = 100
        const xOffset = info.offset.x
        const yOffset = info.offset.y

        // Prioritize Super Like (Up)
        if (yOffset < -threshold && Math.abs(yOffset) > Math.abs(xOffset)) {
            onVote(item.id, 2, true) // Super Like
        } 
        // Then Horizontal
        else if (xOffset > threshold) {
            onVote(item.id, 1, true) // Like
        } else if (info.offset.x < -threshold) {
            onVote(item.id, -2, true) // Dislike
        }
    }

    // Variants for exit animation
    const cardVariants = {
        enter: { scale: 0.95, opacity: 1, y: -35 },
        center: { scale: 1, opacity: 1, y: 0, x: 0, rotate: 0, transition: { duration: 0.3 } },
        exit: (custom) => {
            let xDest = 0
            let yDest = 0
            let rot = 0
            
            if (custom === 1) { xDest = 500; rot = 20; } // Like
            else if (custom === -2) { xDest = -500; rot = -20; } // Dislike
            else if (custom === 2) { yDest = -500; } // Super Like
            else { yDest = 200; } // Skip/Other

            return {
                x: xDest,
                y: yDest,
                rotate: rot,
                opacity: 0,
                transition: { duration: 0.3, ease: "easeIn" }
            }
        }
    }

    return (
        <motion.div
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ x, y, rotate, zIndex: 50, touchAction: 'none' }}
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }} // Snap back if released early
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            className="absolute w-full max-w-sm aspect-[2/3] cursor-grab active:cursor-grabbing perspective-1000"
        >
            {/* Stamps */}
            <motion.div style={{ opacity: opacityLike }} className="absolute top-8 left-8 z-50 border-4 border-blue-500 text-blue-500 rounded-lg px-4 py-2 text-4xl font-black uppercase -rotate-12 tracking-widest bg-black/20 backdrop-blur-sm pointer-events-none">
                LIKE
            </motion.div>
            <motion.div style={{ opacity: opacityNope }} className="absolute top-8 right-8 z-50 border-4 border-red-500 text-red-500 rounded-lg px-4 py-2 text-4xl font-black uppercase rotate-12 tracking-widest bg-black/20 backdrop-blur-sm pointer-events-none">
                NOPE
            </motion.div>
            <motion.div style={{ opacity: opacitySuper }} className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 border-4 border-pink-500 text-pink-500 rounded-lg px-4 py-2 text-3xl font-black uppercase tracking-widest bg-black/20 backdrop-blur-sm pointer-events-none whitespace-nowrap">
                SUPER LIKE
            </motion.div>

            {/* Card Content (Flipper) */}
            <motion.div 
                className="w-full h-full relative [transform-style:preserve-3d] transition-transform duration-500"
                style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
                {/* Front */}
                <div 
                    className="absolute inset-0 [backface-visibility:hidden] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10"
                    onClick={() => setIsFlipped(true)}
                >
                    <CardVisuals movie={item.movie} showMeta isTheater={item.nomination_type === 'theater'} />
                    <div className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white/70 pointer-events-none">
                        <Info size={20} />
                    </div>
                </div>

                {/* Back */}
                <div 
                    className="absolute inset-0 [backface-visibility:hidden] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 p-6 flex flex-col rotate-y-180" 
                    style={{ transform: 'rotateY(180deg)', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
                >
                    <div className="flex-1 overflow-y-auto">
                        <div className="flex gap-4 mb-4">
                            <div className="w-24 shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-slate-800 shadow-lg">
                                <CardVisuals movie={item.movie} isTheater={item.nomination_type === 'theater'} />
                            </div>
                            <div>
                                {item.nomination_type === 'theater' && (
                                    <div className="text-[10px] font-bold text-amber-400 mb-1 flex items-center gap-1 uppercase tracking-wider">
                                        <Ticket size={12} />
                                        {item.theater_name || 'Theater Trip'}
                                    </div>
                                )}
                                <h2 className="text-xl font-bold leading-tight mb-1">{item.movie.title}</h2>
                                <div className="text-sm text-slate-400 mb-2">{item.movie.year || 'N/A'}</div>
                                {item.movie.rt_score && (
                                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-xs font-bold text-yellow-400">
                                        <Star size={12} fill="currentColor" /> {item.movie.rt_score}%
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-6">
                            {item.movie.genre?.map(g => (
                                <span key={g} className="text-xs bg-white/10 px-2 py-1 rounded-full">{g}</span>
                            ))}
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                            {item.theater_notes && (
                                <span className="block mb-3 text-amber-200/80 italic border-l-2 border-amber-500/50 pl-3 py-1 bg-amber-500/5 rounded-r-lg">
                                    {item.theater_notes}
                                </span>
                            )}
                            {item.movie.description || "No description available."}
                        </p>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

function ActionButton({ icon: Icon, color, borderColor, onClick }) {
    return (
        <button 
            onClick={onClick}
            className={`w-14 h-14 rounded-full bg-slate-900 border-2 ${borderColor} ${color} flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform`}
        >
            <Icon size={24} fill="currentColor" className="opacity-80" />
        </button>
    )
}

function GridView({ nominations, myVotes, onSelect }) {
    return (
        <div className="p-4 grid grid-cols-3 gap-3 pb-24 overflow-y-auto h-full content-start">
            {nominations.map(nom => {
                const vote = myVotes[nom.id]
                
                return (
                    <div 
                        key={nom.id}
                        onClick={() => onSelect(nom)}
                        className="relative aspect-[2/3] rounded-lg overflow-hidden bg-slate-800 border border-white/10 shadow-sm cursor-pointer"
                    >
                        <CardVisuals movie={nom.movie} showMeta={false} isTheater={nom.nomination_type === 'theater'} />
                        
                        {/* Small Title Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                            <p className="text-[10px] font-bold text-white leading-tight line-clamp-2">{nom.movie.title}</p>
                        </div>
                        
                        {/* Subtle Vote Indicator */}
                        {vote && (
                            <div className="absolute top-1 right-1 p-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
                                {vote === 1 && <ThumbsUp size={10} className="text-blue-500" fill="currentColor" />}
                                {vote === -2 && <X size={10} className="text-red-500" />}
                                {vote === 2 && <Heart size={10} className="text-pink-500" fill="currentColor" />}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function ExpandedCard({ nom, vote, onVote, onClose }) {
    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
            <div 
                className="w-full max-w-lg aspect-[2/3] relative bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex-1 overflow-y-auto p-6 pb-28">
                    <div className="flex gap-4 mb-4">
                        <div className="w-24 shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-slate-800 shadow-lg">
                            <CardVisuals movie={nom.movie} isTheater={nom.nomination_type === 'theater'} />
                        </div>
                        <div>
                            {nom.nomination_type === 'theater' && (
                                <div className="text-[10px] font-bold text-amber-400 mb-1 flex items-center gap-1 uppercase tracking-wider">
                                    <Ticket size={12} />
                                    {nom.theater_name || 'Theater Trip'}
                                </div>
                            )}
                            <h2 className="text-xl font-bold leading-tight mb-1">{nom.movie.title}</h2>
                            <div className="text-sm text-slate-400 mb-2">{nom.movie.year || 'N/A'}</div>
                            {nom.movie.rt_score && (
                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-xs font-bold text-yellow-400">
                                    <Star size={12} fill="currentColor" /> {nom.movie.rt_score}%
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-6">
                        {nom.movie.genre?.map(g => (
                            <span key={g} className="text-xs bg-white/10 px-2 py-1 rounded-full">{g}</span>
                        ))}
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                        {nom.theater_notes && (
                            <span className="block mb-3 text-amber-200/80 italic border-l-2 border-amber-500/50 pl-3 py-1 bg-amber-500/5 rounded-r-lg">
                                {nom.theater_notes}
                            </span>
                        )}
                        {nom.movie.description || "No description available."}
                    </p>
                </div>

                {/* Action Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-6 pt-12 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent flex justify-center gap-4 z-10">
                    <ActionButton icon={X} color={vote === -2 ? "text-white !bg-red-500" : "text-red-500"} borderColor="border-red-500" onClick={() => onVote(nom.id, -2)} />
                    <ActionButton icon={Heart} color={vote === 2 ? "text-white !bg-pink-500" : "text-pink-500"} borderColor="border-pink-500" onClick={() => onVote(nom.id, 2)} />
                    <ActionButton icon={ThumbsUp} color={vote === 1 ? "text-white !bg-blue-500" : "text-blue-500"} borderColor="border-blue-500" onClick={() => onVote(nom.id, 1)} />
                </div>
            </div>
            
            <button 
                className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/70 hover:text-white backdrop-blur-sm border border-white/10 z-20"
                onClick={onClose}
            >
                <X size={20} />
            </button>
        </motion.div>
    )
}

function CardVisuals({ movie, showMeta = false, isTheater = false }) {
    const posterUrl = movie.poster_path ? `${POSTER_BASE_URL}${movie.poster_path}` : null
    const fallbackGradient = getFallbackGradient(movie.title)
    const FallbackIcon = getFallbackIcon(movie.title)

    return (
        <div className="w-full h-full relative">
            {isTheater && (
                <div className="absolute top-2 left-2 z-20 bg-amber-400 text-black px-2 py-1 rounded-md shadow-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider border border-white/20">
                    <Ticket size={12} strokeWidth={2.5} />
                    <span>Theater</span>
                </div>
            )}
            {posterUrl ? (
                <img src={posterUrl} alt={movie.title} className="w-full h-full object-cover pointer-events-none select-none" draggable={false} />
            ) : (
                <div className={`w-full h-full bg-gradient-to-br ${fallbackGradient} flex flex-col items-center justify-center p-4 text-center`}>
                    <FallbackIcon size={64} className="text-white/20 mb-4" />
                    <div className="text-2xl font-black uppercase tracking-tighter text-white/90 line-clamp-3">
                        {movie.title}
                    </div>
                </div>
            )}
            
            {/* Gradient Overlay for Text Readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />

            {/* Meta Data */}
            {showMeta && (
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h2 className="text-2xl font-bold leading-tight mb-1 line-clamp-2">{movie.title}</h2>
                    <div className="flex items-center gap-3 text-sm font-medium text-slate-300">
                        <span>{movie.year || 'N/A'}</span>
                        {movie.rt_score && (
                            <span className="flex items-center gap-1 text-yellow-400">
                                <Star size={14} fill="currentColor" /> {movie.rt_score}%
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

function getFallbackGradient(title) {
    const len = title?.length || 0
    const gradients = [
        'from-rose-600 to-orange-600',
        'from-blue-600 to-cyan-600',
        'from-emerald-600 to-teal-600',
        'from-violet-600 to-fuchsia-600',
        'from-amber-500 to-orange-600'
    ]
    return gradients[len % gradients.length]
}

function getFallbackIcon(title) {
    const len = title?.length || 0
    const icons = [Film, Ticket, Clapperboard]
    return icons[len % icons.length]
}

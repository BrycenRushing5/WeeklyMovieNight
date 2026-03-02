import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { motion, useMotionValue, useTransform, AnimatePresence, animate } from 'framer-motion'
import { 
  Layers, LayoutGrid, ThumbsUp, ThumbsDown, Heart, Undo2, 
  X, Ticket, ChevronLeft, Star, Check, Info, Clock
} from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'
import MoviePoster from './MoviePoster'

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
  const [exitDirection, setExitDirection] = useState(null)
  const [history, setHistory] = useState([]) // Track vote history for Undo
  
  // Grid State
  const [selectedNomination, setSelectedNomination] = useState(null)
  const [stackDescriptionMovie, setStackDescriptionMovie] = useState(null)

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

  const handleVote = async (nominationId, voteType) => {
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
    
    if (!isRemoving) {
        // Voting (Adding a vote)
        setExitDirection(voteType)
        setStackQueue(prev => prev.filter(n => n.id !== nominationId))
        setHistory(prev => [...prev, nominationId])
    } else {
        // Removing a vote (Undo or Toggle off)
        setStackQueue(prev => {
            // Avoid duplicates
            if (prev.some(n => n.id === nominationId)) return prev
            const nom = nominations.find(n => n.id === nominationId)
            if (!nom) return prev
            // Add to front so it's the active card
            return [nom, ...prev]
        })
        // Remove from history
        setHistory(prev => prev.filter(id => id !== nominationId))
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
    setExitDirection('skip')
    // Move to bottom of stack
    setStackQueue(prev => {
      const item = prev.find(n => n.id === nominationId)
      if (!item) return prev
      const remaining = prev.filter(n => n.id !== nominationId)
      return [...remaining, item]
    })
  }

  const handleUndo = () => {
    const lastId = history[history.length - 1]
    if (!lastId) return
    const voteType = myVotes[lastId]
    // Calling handleVote with the same type triggers removal (toggle off)
    if (voteType) handleVote(lastId, voteType, false)
  }

  if (loading) return <LoadingSpinner label="Loading ballot..." />

  return (
    <div className="fixed inset-0 w-full h-full bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white flex flex-col overflow-hidden">
      {/* HEADER */}
      <div className="px-4 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/room/${code}`)} className="p-2 rounded-full bg-white/10">
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
                exitDirection={exitDirection}
                onSkip={handleSkip}
                onUndo={handleUndo}
                canUndo={history.length > 0}
                onDone={() => navigate(`/room/${code}`)}
                onReadMore={(movie) => setStackDescriptionMovie(movie)}
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
            {stackDescriptionMovie && (
                <DescriptionModal
                    movie={stackDescriptionMovie}
                    onClose={() => setStackDescriptionMovie(null)}
                />
            )}
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

function StackView({ queue, onVote, onSkip, onUndo, canUndo, onDone, exitDirection, onReadMore }) {
    const activeItem = queue[0]
    const nextItems = queue.slice(1, 3) // Show next 2 cards (Total 3 visible)

    if (!activeItem) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-full aspect-[2/3] max-h-[55vh] border-4 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-4">
                    <Check size={64} className="text-green-500" />
                    <div className="text-2xl font-bold text-slate-200">All Voted!</div>
                    <p className="text-slate-400">Waiting for more nominations...</p>
                    {canUndo && (
                        <button onClick={onUndo} className="mt-4 px-6 py-3 bg-white/10 rounded-xl font-bold flex items-center gap-2">
                            <Undo2 size={18} /> Undo Last Vote
                        </button>
                    )}
                    <button onClick={onDone} className="mt-4 px-8 py-3 bg-indigo-500 text-white rounded-xl font-bold shadow-lg transition-colors">
                        Done Voting
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col relative">
            <div className="flex-1 relative flex items-center justify-center p-4 pb-24">
                {/* Background Cards */}
                {nextItems.reverse().map((item, index) => {
                    const depth = nextItems.length - index
                    const scale = 0.95 - (depth * 0.05)
                    const translateY = -10 - (depth * 30) // Reduced spacing
                    const overlayOpacity = 0.2 + (depth * 0.15)

                    return (
                        <div 
                            key={item.id}
                            className="absolute w-[90%] max-w-[340px] aspect-[2/3] max-h-[55vh] bg-slate-800 rounded-3xl border border-white/5 shadow-2xl overflow-hidden pointer-events-none transition-all duration-500 ease-in-out"
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
                    {activeItem && (
                        <DraggableCard
                            key={activeItem.id}
                            item={activeItem}
                            onVote={onVote}
                            onSkip={onSkip}
                            onReadMore={onReadMore}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* Action Bar */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 z-50">
                <ActionButton icon={Undo2} color="text-yellow-400" borderColor="border-yellow-400" onClick={onUndo} disabled={!canUndo} />
                <ActionButton icon={Heart} color="text-pink-500" borderColor="border-pink-500" fill onClick={() => onVote(activeItem.id, 2)} />
                <ActionButton icon={Clock} color="text-slate-300" borderColor="border-slate-500" onClick={() => onSkip(activeItem.id)} />
            </div>
        </div>
    )
}

function ActionButton({ icon: Icon, color, borderColor, onClick, fill = false, disabled = false }) {
    const shouldFill = fill || Icon === ThumbsUp || Icon === ThumbsDown

    return (
        <button 
            onClick={onClick}
            disabled={disabled}
            className={`w-14 h-14 rounded-full bg-slate-900 border-2 ${borderColor} ${color} flex items-center justify-center shadow-lg transition-transform ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
        >
            <Icon size={24} fill={shouldFill ? "currentColor" : "none"} className="opacity-80" />
        </button>
    )
}

function DraggableCard({ item, onVote, onSkip, onReadMore }) {
    const [isFlipped, setIsFlipped] = useState(false)
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const isDragging = useRef(false)
    const description = item?.movie?.description?.trim() || ''
    const hasLongDescription = description.length > 220
    
    // Smoother rotation (less wobble)
    const rotate = useTransform(x, [-200, 200], [-10, 10])
    
    // Opacity transforms for stamps
    const opacityLike = useTransform(x, [25, 100], [0, 1])
    const opacityNope = useTransform(x, [-25, -100], [0, 1])
    const opacitySuper = useTransform(y, [-25, -100], [0, 1])
    const opacitySkip = useTransform(y, [25, 100], [0, 1])
    
    const handleDragEnd = (event, info) => {
        setTimeout(() => { isDragging.current = false }, 50)
        const threshold = 100
        const xOffset = info.offset.x
        const yOffset = info.offset.y
        
        if (yOffset < -threshold && Math.abs(yOffset) > Math.abs(xOffset)) {
             onVote(item.id, 2) // Super Like
        } else if (yOffset > threshold && Math.abs(yOffset) > Math.abs(xOffset)) {
             onSkip(item.id) // Skip (Down)
        } else if (xOffset > threshold) {
             onVote(item.id, 1) // Like
        } else if (xOffset < -threshold) {
             onVote(item.id, -2) // Dislike
        } else {
            // Snap back with smoother spring
            animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 })
            animate(y, 0, { type: 'spring', stiffness: 300, damping: 25 })
        }
    }

    const variants = {
        enter: { scale: 0.9, opacity: 1, y: -40 },
        center: { scale: 1, opacity: 1, y: 0, x: 0, rotate: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
        exit: (direction) => {
            const duration = 0.2
            if (direction === 1) return { x: 500, opacity: 0, rotate: 10, transition: { duration } }
            if (direction === -2) return { x: -500, opacity: 0, rotate: -10, transition: { duration } }
            if (direction === 2) return { y: -500, opacity: 0, transition: { duration } }
            if (direction === 'skip') return { y: 500, opacity: 0, transition: { duration } }
            return { scale: 0.9, opacity: 0, transition: { duration } }
        }
    }

    return (
        <motion.div
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ x, y, rotate, zIndex: 50, touchAction: 'none' }}
            drag
            dragMomentum={false}
            onDragStart={() => { isDragging.current = true }}
            onDragEnd={handleDragEnd}
            onClick={() => !isDragging.current && setIsFlipped(prev => !prev)}
            className="absolute w-[90%] max-w-[340px] aspect-[2/3] max-h-[55vh] cursor-grab active:cursor-grabbing perspective-1000 touch-none select-none"
        >
            <motion.div style={{ opacity: opacityLike }} className="absolute top-10 left-10 z-50 border-4 border-blue-400 text-blue-400 rounded-lg px-4 py-2 text-4xl font-black uppercase -rotate-12 tracking-widest bg-black/60 backdrop-blur-md shadow-2xl pointer-events-none">LIKE</motion.div>
            <motion.div style={{ opacity: opacityNope }} className="absolute top-10 right-10 z-50 border-4 border-red-500 text-red-500 rounded-lg px-4 py-2 text-4xl font-black uppercase rotate-12 tracking-widest bg-black/60 backdrop-blur-md shadow-2xl pointer-events-none">NOPE</motion.div>
            <motion.div style={{ opacity: opacitySuper }} className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 border-4 border-pink-500 text-pink-500 rounded-lg px-4 py-2 text-3xl font-black uppercase tracking-widest bg-black/60 backdrop-blur-md shadow-2xl pointer-events-none whitespace-nowrap -rotate-12">SUPER LIKE</motion.div>
            <motion.div style={{ opacity: opacitySkip }} className="absolute top-12 left-1/2 -translate-x-1/2 z-50 border-4 border-amber-400 text-amber-400 rounded-lg px-4 py-2 text-3xl font-black uppercase tracking-widest bg-black/60 backdrop-blur-md shadow-2xl pointer-events-none whitespace-nowrap rotate-12">SKIP</motion.div>

            {/* Card Content */}
            <div className="w-full h-full relative bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                {/* Back Layer (Info) */}
                <div className="absolute inset-0 overflow-hidden bg-slate-900 p-6">
                    <div className="flex h-full flex-col min-h-0">
                        <div className="flex gap-4 mb-4">
                            <div className="w-24 shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-slate-800 shadow-lg">
                                <CardVisuals movie={item.movie} isTheater={item.nomination_type === 'theater'} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xl font-bold leading-tight mb-1">{item.movie.title}</h2>
                                <div className="text-sm text-slate-400 mb-2">{item.movie.year || 'N/A'}</div>
                                {item.movie.rt_score && (
                                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-xs font-bold text-yellow-400">
                                        <Star size={12} fill="currentColor" /> {item.movie.rt_score}%
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                            {item.movie.genre?.map(g => (
                                <span key={g} className="text-xs bg-white/10 px-2 py-1 rounded-full">{g}</span>
                            ))}
                        </div>

                        <div className="mt-auto">
                            {item.theater_notes && (
                                <span className="block mb-3 line-clamp-3 text-amber-200/80 italic border-l-2 border-amber-500/50 pl-3 py-1 bg-amber-500/5 rounded-r-lg">
                                    {item.theater_notes}
                                </span>
                            )}
                            <p className="text-sm text-slate-300 leading-relaxed line-clamp-6">
                                {description || "No description available."}
                            </p>
                            {hasLongDescription && (
                                <button
                                    type="button"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onReadMore(item.movie)
                                    }}
                                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white"
                                >
                                    Read More
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Front Layer (Poster) */}
                <motion.div 
                    initial={false}
                    animate={{ y: isFlipped ? '-100%' : '0%' }}
                    transition={{ 
                        type: "spring", 
                        stiffness: isFlipped ? 120 : 250, 
                        damping: isFlipped ? 20 : 35 
                    }}
                    className="absolute inset-0 bg-slate-900 z-10"
                >
                    <CardVisuals movie={item.movie} showMeta isTheater={item.nomination_type === 'theater'} />
                    <div className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white/70 pointer-events-none">
                        <Info size={20} />
                    </div>
                </motion.div>
            </div>
        </motion.div>
    )
}

function GridView({ nominations, myVotes, onSelect }) {
    const [filter, setFilter] = useState('all')

    const filteredNominations = nominations.filter(nom => {
        const vote = myVotes[nom.id]
        if (filter === 'missing') return !vote
        if (filter === 'voted') return !!vote
        if (filter === 'liked') return vote === 1
        if (filter === 'disliked') return vote === -2
        if (filter === 'superliked') return vote === 2
        return true
    })

    const toggleFilter = (target) => {
        setFilter(prev => prev === target ? 'all' : target)
    }

    return (
        <div className="flex flex-col h-full w-full">
            {/* Filters */}
            <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide shrink-0 pb-3 items-center">
                <FilterButton label="Missing Vote" active={filter === 'missing'} onClick={() => toggleFilter('missing')} activeColor="bg-indigo-500 border-indigo-500 text-white" />
                <FilterButton label="Voted" active={filter === 'voted'} onClick={() => toggleFilter('voted')} activeColor="bg-indigo-500 border-indigo-500 text-white" />
                
                <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

                <FilterButton active={filter === 'liked'} onClick={() => toggleFilter('liked')} activeColor="bg-blue-500 border-blue-500 text-white" icon={ThumbsUp} />
                <FilterButton active={filter === 'disliked'} onClick={() => toggleFilter('disliked')} activeColor="bg-red-500 border-red-500 text-white" icon={ThumbsDown} />
                <FilterButton active={filter === 'superliked'} onClick={() => toggleFilter('superliked')} activeColor="bg-pink-500 border-pink-500 text-white" icon={Heart} />
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto p-4 pt-0 pb-24">
                <div className="grid grid-cols-3 gap-3">
                    {filteredNominations.map(nom => {
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
                                    <p className="text-xs font-bold text-white leading-tight line-clamp-3">{nom.movie.title}</p>
                                </div>
                                
                                {/* Subtle Vote Indicator */}
                                {vote && (
                                    <div className="absolute top-1 right-1 p-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
                                        {vote === 1 && <ThumbsUp size={14} className="text-blue-500" fill="currentColor" />}
                                        {vote === -2 && <ThumbsDown size={14} className="text-red-500" fill="currentColor" />}
                                        {vote === 2 && <Heart size={14} className="text-pink-500" fill="currentColor" />}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
                {filteredNominations.length === 0 && (
                    <div className="text-center py-10 text-slate-500 text-sm">
                        No movies found.
                    </div>
                )}
            </div>
        </div>
    )
}

function FilterButton({ label, active, onClick, activeColor = "bg-white text-black border-white", icon: Icon }) {
    const shouldFill = Icon === ThumbsUp || Icon === ThumbsDown || Icon === Heart

    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                active 
                    ? activeColor 
                    : 'bg-transparent border-white/10 text-slate-400'
            }`}
        >
            {Icon && <Icon size={16} fill={shouldFill ? "currentColor" : "none"} />}
            {label}
        </button>
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
                    <ActionButton icon={ThumbsDown} color={vote === -2 ? "text-white !bg-red-500" : "text-red-500"} borderColor="border-red-500" onClick={() => onVote(nom.id, -2)} />
                    <ActionButton icon={Heart} color={vote === 2 ? "text-white !bg-pink-500" : "text-pink-500"} borderColor="border-pink-500" fill={true} onClick={() => onVote(nom.id, 2)} />
                    <ActionButton icon={ThumbsUp} color={vote === 1 ? "text-white !bg-blue-500" : "text-blue-500"} borderColor="border-blue-500" fill={true} onClick={() => onVote(nom.id, 1)} />
                </div>
            </div>
            
            <button 
                className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white/70 backdrop-blur-sm border border-white/10 z-20"
                onClick={onClose}
            >
                <X size={20} />
            </button>
        </motion.div>
    )
}

function DescriptionModal({ movie, onClose }) {
    const description = movie?.description?.trim() || 'No description available.'
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-end justify-center bg-black/85 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="relative flex h-[70dvh] w-full max-w-md flex-col rounded-t-[32px] border border-white/10 bg-gradient-to-b from-slate-950 via-slate-900 to-black px-5 pt-5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-300">Movie Description</div>
                        <div className="mt-1 text-lg font-bold text-white leading-tight">{movie?.title}</div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full bg-white/10 p-2 text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pb-6">
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                            {description}
                        </p>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

function CardVisuals({ movie, showMeta = false, isTheater = false }) {
    return (
        <div className="w-full h-full relative">
            {isTheater && (
                <div className="absolute top-2 left-2 z-20 bg-amber-400 text-black px-2 py-1 rounded-md shadow-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider border border-white/20">
                    <Ticket size={12} strokeWidth={2.5} />
                    <span>Theater</span>
                </div>
            )}
            <MoviePoster
                title={movie.title}
                posterPath={movie.poster_path}
                className="w-full h-full"
                imageClassName="w-full h-full object-cover pointer-events-none select-none"
                iconSize={64}
                showTitle
                titleClassName="mt-4 text-2xl font-black uppercase tracking-tighter text-white/90 line-clamp-3"
            />
            
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

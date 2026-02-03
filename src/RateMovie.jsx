import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from './supabaseClient'
import { X, Star, ThumbsUp, Check, Film } from 'lucide-react'
import { POSTER_BASE_URL } from './tmdbClient'

export default function RateMovie({ eventId, movie, onClose }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [wouldWatchAgain, setWouldWatchAgain] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!rating) return alert('Pick a rating first!')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const { error: reviewError } = await supabase
      .from('reviews')
      .upsert([
        {
          event_id: eventId,
          movie_id: movie.id,
          user_id: user.id,
          rating,
          comment: comment.trim() || null,
          would_watch_again: wouldWatchAgain
        }
      ], { onConflict: 'event_id, user_id' })

    const { error: attendeeError } = await supabase
      .from('event_attendees')
      .upsert([{ event_id: eventId, user_id: user.id }], { onConflict: 'event_id, user_id' })

    setSaving(false)
    if (reviewError || attendeeError) {
      console.error('Review Error:', reviewError)
      console.error('Attendee Error:', attendeeError)
      alert(`Error: ${reviewError?.message || attendeeError?.message}`)
      return
    }
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ y: "100%" }} 
        animate={{ y: 0 }} 
        exit={{ y: "100%" }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md h-[85dvh] bg-gradient-to-b from-slate-950 via-slate-900 to-black border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6 shrink-0">
             <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-2xl font-black leading-tight text-white">Rate Movie</h2>
                <p className="text-slate-400 text-sm truncate">{movie.title}</p>
             </div>
             <button onClick={onClose} className="bg-white/10 p-2 rounded-full text-white hover:bg-white/20 transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 pb-6">
            {/* Poster - Centered and larger */}
            <div className="flex justify-center mb-8">
                <div className="relative w-40 aspect-[2/3] rounded-xl overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.1)] ring-1 ring-white/10">
                    {movie.poster_path ? (
                        <img src={`${POSTER_BASE_URL}${movie.poster_path}`} alt={movie.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-600"><Film size={32} /></div>
                    )}
                </div>
            </div>

            {/* Rating */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold text-slate-300 uppercase tracking-wider">Your Score</label>
                    <span className="text-2xl font-black text-indigo-500">{rating}<span className="text-base text-slate-600">/10</span></span>
                </div>
                <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }).map((_, idx) => {
              const value = idx + 1
              const isActive = rating === value
              return (
                <button
                  key={value}
                  onClick={() => setRating(value)}
                  className={`h-12 rounded-xl font-black text-lg transition-all ${isActive ? 'bg-indigo-500 text-white scale-105 shadow-lg' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                >
                  {value}
                </button>
              )
            })}
          </div>
        </div>

            {/* Comment */}
            <div className="mb-6">
                <label className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 block">Quick Take</label>
          <textarea
            placeholder="Drop a quick reaction or quote..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 min-h-[100px] resize-none"
          />
            </div>

            {/* Watch Again */}
          <button
            type="button"
            onClick={() => setWouldWatchAgain(prev => !prev)}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${wouldWatchAgain ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'}`}
          >
            <span className="font-bold flex items-center gap-3">
                <ThumbsUp size={20} className={wouldWatchAgain ? "fill-current" : ""} /> Would Watch Again
            </span>
            {wouldWatchAgain && <Check size={20} />}
          </button>
        </div>

        {/* Footer Action */}
        <div className="shrink-0 pt-4 border-t border-white/10">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-rose-500 text-white p-4 rounded-2xl font-black text-lg hover:bg-rose-600 transition-colors disabled:opacity-50 shadow-lg shadow-rose-500/20"
        >
          {saving ? 'Saving...' : 'Submit Review'}
        </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

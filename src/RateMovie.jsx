import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from './supabaseClient'
import { X, Star, ThumbsUp } from 'lucide-react'
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-2xl h-[75vh] bg-slate-900 border-t border-white/10 rounded-t-3xl p-5 flex flex-col"
      >
        {(() => {
          const posterUrl = movie.poster_path ? `${POSTER_BASE_URL}${movie.poster_path}` : null
          return (
        <div className="flex justify-between items-center mb-3.5">
          <div className="flex gap-3 items-center">
            {posterUrl && <img src={posterUrl} alt={movie.title} className="w-10 h-14 object-cover rounded-md" />}
            <div>
            <h2 className="m-0 text-xl font-bold">Rate {movie.title}</h2>
            <div className="text-sm text-slate-400">Post-watch ratings help your crew learn your taste.</div>
          </div>
          </div>
          <button onClick={onClose} className="bg-slate-700 p-2 rounded-full text-white"><X size={18} /></button>
        </div>
          )
        })()}

        <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-4">
          <div className="text-sm mb-2.5 font-bold">Your Rating (1-10)</div>
          <div className="grid grid-cols-5 gap-2.5">
            {Array.from({ length: 10 }).map((_, idx) => {
              const value = idx + 1
              const isActive = rating === value
              return (
                <button
                  key={value}
                  onClick={() => setRating(value)}
                  className={`py-3 rounded-lg border font-bold ${isActive ? 'border-accent bg-accent/20 text-accent' : 'border-white/10 bg-white/5 text-slate-300'}`}
                >
                  {value}
                </button>
              )
            })}
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-4">
          <div className="text-sm mb-2.5 font-bold flex items-center gap-1.5">
            <Star size={16} className="text-amber-300" /> Quick Take
          </div>
          <textarea
            placeholder="Drop a quick reaction or quote..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[110px] w-full bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base"
          />
          <button
            type="button"
            onClick={() => setWouldWatchAgain(prev => !prev)}
            className={`mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border font-bold ${wouldWatchAgain ? 'border-accent/60 bg-accent/20 text-accent' : 'border-white/10 bg-white/5 text-slate-300'}`}
            aria-pressed={wouldWatchAgain}
          >
            <ThumbsUp size={16} />
            Would watch again
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="mt-auto bg-accent text-black p-3.5 rounded-2xl font-extrabold"
        >
          {saving ? 'Saving...' : 'Submit Rating'}
        </button>
      </motion.div>
    </motion.div>
  )
}

import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from './supabaseClient'
import { X, Star, ThumbsUp } from 'lucide-react'

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
      style={{ position: 'fixed', inset: 0, zIndex: 2500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{ width: '100%', maxWidth: '560px', height: '75vh', background: '#141424', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex-between" style={{ marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0 }}>Rate {movie.title}</h2>
            <div className="text-sm" style={{ color: '#aaa' }}>Post-watch ratings help your crew learn your taste.</div>
          </div>
          <button onClick={onClose} style={{ background: '#333', padding: '8px', borderRadius: '50%', color: 'white' }}><X size={18} /></button>
        </div>

        <div className="glass-panel" style={{ marginBottom: '16px' }}>
          <div className="text-sm" style={{ marginBottom: '10px', fontWeight: 700 }}>Your Rating (1-10)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
            {Array.from({ length: 10 }).map((_, idx) => {
              const value = idx + 1
              const isActive = rating === value
              return (
                <button
                  key={value}
                  onClick={() => setRating(value)}
                  style={{
                    padding: '12px 0',
                    borderRadius: '12px',
                    border: isActive ? '1px solid #00E5FF' : '1px solid rgba(255,255,255,0.08)',
                    background: isActive ? 'rgba(0,229,255,0.2)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? '#00E5FF' : '#ddd',
                    fontWeight: 700
                  }}
                >
                  {value}
                </button>
              )
            })}
          </div>
        </div>

        <div className="glass-panel" style={{ marginBottom: '16px' }}>
          <div className="text-sm" style={{ marginBottom: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Star size={16} color="#FFD166" /> Quick Take
          </div>
          <textarea
            placeholder="Drop a quick reaction or quote..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ minHeight: '110px', width: '100%' }}
          />
          <label style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ThumbsUp size={16} /> Would watch again
            </span>
            <input className="toggle" type="checkbox" checked={wouldWatchAgain} onChange={(e) => setWouldWatchAgain(e.target.checked)} />
          </label>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{ marginTop: 'auto', background: '#00E5FF', color: 'black', padding: '14px', borderRadius: '14px', fontWeight: 800 }}
        >
          {saving ? 'Saving...' : 'Submit Rating'}
        </button>
      </motion.div>
    </motion.div>
  )
}

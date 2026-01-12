import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { User, Trophy, Target, Film, Sparkles, ChevronLeft, Star, ThumbsUp } from 'lucide-react'
import MovieCard from './MovieCard'
import LoadingSpinner from './LoadingSpinner'

export default function ProfileView({ session }) {
  const [loading, setLoading] = useState(true)
  const [coordinatorCount, setCoordinatorCount] = useState(0)
  const [nominationSuccess, setNominationSuccess] = useState(0)
  const [topGenre, setTopGenre] = useState('N/A')
  const [genreCount, setGenreCount] = useState(0)
  const [reviewHistory, setReviewHistory] = useState([])
  const [profileDisplayName, setProfileDisplayName] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false)
  const [savingDisplayName, setSavingDisplayName] = useState(false)
  const [displayNameError, setDisplayNameError] = useState('')

  useEffect(() => {
    if (session?.user) loadStats()
  }, [session])

  useEffect(() => {
    if (!session?.user) return
    const currentDisplayName = session.user.user_metadata?.display_name || ''
    const fallbackName = session.user.user_metadata?.username || ''
    const initialName = currentDisplayName || fallbackName || 'Movie Fan'
    setProfileDisplayName(initialName)
    setEditDisplayName(currentDisplayName || fallbackName)
  }, [session])

  async function loadStats() {
    setLoading(true)
    const userId = session.user.id

    const { data: createdEvents } = await supabase
      .from('events')
      .select('id')
      .eq('created_by', userId)

    const { data: nominations } = await supabase
      .from('nominations')
      .select('id, movie_id, event:events (id, selected_nomination_id, selected_movie_id)')
      .eq('nominated_by', userId)

    const nominationTotal = nominations?.length || 0
    const nominationWins = (nominations || []).filter(n => {
      if (n.event?.selected_nomination_id) return n.event.selected_nomination_id === n.id
      return n.movie_id && n.event?.selected_movie_id === n.movie_id
    }).length
    const successPercent = nominationTotal ? Math.round((nominationWins / nominationTotal) * 100) : 0

    const { data: reviews } = await supabase
      .from('reviews')
      .select('id, rating, comment, would_watch_again, movie:movies (*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    const genreTally = {}
    ;(reviews || []).forEach((review) => {
      const genres = review.movie?.genre || []
      const list = Array.isArray(genres) ? genres : [genres]
      list.forEach((g) => {
        if (!g) return
        genreTally[g] = (genreTally[g] || 0) + 1
      })
    })

    let bestGenre = 'N/A'
    let bestCount = 0
    Object.entries(genreTally).forEach(([genre, count]) => {
      if (count > bestCount) {
        bestGenre = genre
        bestCount = count
      }
    })

    setCoordinatorCount(createdEvents?.length || 0)
    setNominationSuccess(successPercent)
    setTopGenre(bestGenre)
    setGenreCount(bestCount)
    setReviewHistory(reviews || [])
    setLoading(false)
  }

  async function handleDisplayNameSave() {
    if (!session?.user) return
    const rawDisplayName = editDisplayName.trim()
    if (!rawDisplayName) {
      setDisplayNameError('Display name cannot be empty.')
      return
    }

    setSavingDisplayName(true)
    setDisplayNameError('')

    const { data: sessionData } = await supabase.auth.getSession()
    let activeSession = sessionData?.session || null
    if (!activeSession) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError || !refreshed?.session) {
        setDisplayNameError('Your session expired. Please sign in again.')
        setSavingDisplayName(false)
        return
      }
      activeSession = refreshed.session
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: { display_name: rawDisplayName }
    })

    if (authError) {
      setDisplayNameError(authError.message)
      setSavingDisplayName(false)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ display_name: rawDisplayName })
      .eq('id', session.user.id)

    if (profileError) {
      setDisplayNameError(profileError.message)
      setSavingDisplayName(false)
      return
    }

    setProfileDisplayName(rawDisplayName)
    setIsEditingDisplayName(false)
    setSavingDisplayName(false)
  }

  function handleDisplayNameCancel() {
    setEditDisplayName(profileDisplayName === 'Movie Fan' ? '' : profileDisplayName)
    setDisplayNameError('')
    setIsEditingDisplayName(false)
  }

  if (loading) return <LoadingSpinner label="Loading profile..." />

  return (
    <div style={{ paddingBottom: '40px', height: '100%', overflowY: 'auto', paddingRight: '12px' }}>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <button style={{ background: 'none', color: '#888', padding: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <ChevronLeft size={20} /> Back to Hub
        </button>
      </Link>

      <div className="glass-panel" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '54px', height: '54px', minWidth: '54px', minHeight: '54px', flexShrink: 0, borderRadius: '50%', background: 'rgba(0,229,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={26} color="#00E5FF" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '1.6rem' }}>{profileDisplayName || 'Movie Fan'}</h1>
            {!isEditingDisplayName && (
              <button
                type="button"
                onClick={() => {
                  setIsEditingDisplayName(true)
                  setDisplayNameError('')
                }}
                style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', borderRadius: '999px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600 }}
              >
                Edit display name
              </button>
            )}
          </div>
          {isEditingDisplayName && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="New display name"
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', padding: '8px 12px', borderRadius: '10px', color: 'white' }}
              />
              <button
                type="button"
                onClick={handleDisplayNameSave}
                disabled={savingDisplayName}
                style={{ background: '#00E5FF', color: '#0b0b0b', borderRadius: '10px', padding: '8px 14px', fontWeight: 700 }}
              >
                {savingDisplayName ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleDisplayNameCancel}
                disabled={savingDisplayName}
                style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', borderRadius: '10px', padding: '8px 12px', fontWeight: 600 }}
              >
                Cancel
              </button>
            </div>
          )}
          {displayNameError && (
            <div className="text-sm" style={{ color: '#FF8FA3', marginTop: '6px' }}>
              {displayNameError}
            </div>
          )}
          <div className="text-sm" style={{ color: '#aaa' }}>{session.user.email}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div className="glass-panel">
          <div className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#aaa' }}>
            <Trophy size={16} /> The Coordinator
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{coordinatorCount}</div>
          <div className="text-sm">Events you created</div>
        </div>
        <div className="glass-panel">
          <div className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#aaa' }}>
            <Target size={16} /> Nomination Success
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{nominationSuccess}%</div>
          <div className="text-sm">Your picks that won</div>
        </div>
        <div className="glass-panel">
          <div className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#aaa' }}>
            <Sparkles size={16} /> Genre Junkie
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{topGenre}</div>
          <div className="text-sm">{genreCount ? `${genreCount} reviews` : 'No reviews yet'}</div>
        </div>
      </div>

      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Film size={18} color="#00E5FF" />
        <h2 style={{ margin: 0 }}>Review History</h2>
      </div>

      {reviewHistory.length === 0 && (
        <div className="text-sm" style={{ textAlign: 'center', color: '#888' }}>Rate a movie to build your history.</div>
      )}

      {reviewHistory.map((review) => (
        <MovieCard
          key={review.id}
          movie={review.movie}
          meta={
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FFD166', fontWeight: 700 }}>
                <Star size={14} /> {review.rating}/10
              </span>
              {review.would_watch_again && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00E5FF', fontWeight: 600 }}>
                  <ThumbsUp size={14} /> Would watch again
                </span>
              )}
            </div>
          }
        >
          {review.comment && (
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#cbd5e1' }}>
              "{review.comment}"
            </p>
          )}
        </MovieCard>
      ))}
    </div>
  )
}

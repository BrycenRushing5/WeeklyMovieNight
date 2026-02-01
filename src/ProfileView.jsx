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
    <div className="pb-10 h-full overflow-y-auto pr-3">
      <Link to="/" className="no-underline">
        <button className="bg-transparent text-slate-400 p-0 mb-5 flex items-center gap-1.5">
          <ChevronLeft size={20} /> Back to Hub
        </button>
      </Link>

      <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-5 flex items-center gap-4">
        <div className="w-14 h-14 min-w-[54px] min-h-[54px] shrink-0 rounded-full bg-accent/20 flex items-center justify-center">
          <User size={26} className="text-accent" />
        </div>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="m-0 text-2xl font-bold">{profileDisplayName || 'Movie Fan'}</h1>
            {!isEditingDisplayName && (
              <button
                type="button"
                onClick={() => {
                  setIsEditingDisplayName(true)
                  setDisplayNameError('')
                }}
                className="bg-white/10 text-white px-3 py-1.5 rounded-full text-xs font-semibold"
              >
                Edit display name
              </button>
            )}
          </div>
          {isEditingDisplayName && (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="New display name"
                className="bg-black/30 border-none px-3 py-2 rounded-lg text-white"
              />
              <button
                type="button"
                onClick={handleDisplayNameSave}
                disabled={savingDisplayName}
                className="bg-accent text-black px-3.5 py-2 rounded-lg font-bold"
              >
                {savingDisplayName ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleDisplayNameCancel}
                disabled={savingDisplayName}
                className="bg-white/10 text-white px-3 py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          )}
          {displayNameError && (
            <div className="text-sm text-red-400 mt-1.5">
              {displayNameError}
            </div>
          )}
          <div className="text-sm text-slate-400">{session.user.email}</div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mb-6">
        <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4">
          <div className="text-sm flex items-center gap-1.5 text-slate-400">
            <Trophy size={16} /> The Coordinator
          </div>
          <div className="text-3xl font-extrabold">{coordinatorCount}</div>
          <div className="text-sm">Events you created</div>
        </div>
        <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4">
          <div className="text-sm flex items-center gap-1.5 text-slate-400">
            <Target size={16} /> Nomination Success
          </div>
          <div className="text-3xl font-extrabold">{nominationSuccess}%</div>
          <div className="text-sm">Your picks that won</div>
        </div>
        <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4">
          <div className="text-sm flex items-center gap-1.5 text-slate-400">
            <Sparkles size={16} /> Genre Junkie
          </div>
          <div className="text-xl font-extrabold">{topGenre}</div>
          <div className="text-sm">{genreCount ? `${genreCount} reviews` : 'No reviews yet'}</div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Film size={18} className="text-accent" />
        <h2 className="m-0 text-xl font-bold">Review History</h2>
      </div>

      {reviewHistory.length === 0 && (
        <div className="text-sm text-center text-slate-500">Rate a movie to build your history.</div>
      )}

      {reviewHistory.map((review) => (
        <MovieCard
          key={review.id}
          movie={review.movie}
          meta={
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                <Star size={14} /> {review.rating}/10
              </span>
              {review.would_watch_again && (
                <span className="flex items-center gap-1.5 text-accent font-semibold">
                  <ThumbsUp size={14} /> Would watch again
                </span>
              )}
            </div>
          }
        >
          {review.comment && (
            <p className="m-0 text-base text-slate-300">
              "{review.comment}"
            </p>
          )}
        </MovieCard>
      ))}
    </div>
  )
}

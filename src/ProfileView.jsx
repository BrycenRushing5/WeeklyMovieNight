import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import {
  Camera,
  ChevronLeft,
  Clapperboard,
  Edit3,
  Film,
  Heart,
  ImagePlus,
  MessageSquare,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  Ticket,
  Trophy,
  X,
} from 'lucide-react'
import MovieCard from './MovieCard'
import LoadingSpinner from './LoadingSpinner'
import PersonAvatar from './PersonAvatar'
import { PROFILE_AVATARS } from './profileAvatars'

const PROFILE_AVATAR_BUCKET = 'profile-avatars'

function getMetadataDisplayName(session) {
  return session?.user?.user_metadata?.display_name || ''
}

function getMetadataUsername(session) {
  return session?.user?.user_metadata?.username || ''
}

function getMetadataAvatarKey(session) {
  return session?.user?.user_metadata?.avatar_key || ''
}

function getMetadataAvatarUrl(session) {
  return session?.user?.user_metadata?.avatar_url || ''
}

function formatReviewDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function getTopGenre(reviews) {
  const genreTally = {}

  ;(reviews || []).forEach((review) => {
    const genres = Array.isArray(review.movie?.genre)
      ? review.movie.genre
      : review.movie?.genre
        ? [review.movie.genre]
        : []

    genres.forEach((genre) => {
      if (!genre) return
      genreTally[genre] = (genreTally[genre] || 0) + 1
    })
  })

  return Object.entries(genreTally).reduce((best, entry) => {
    if (!best || entry[1] > best[1]) return entry
    return best
  }, null)
}

function calculateNominationWins(nominations, events) {
  const nominationsByEventId = new Map()

  ;(nominations || []).forEach((nomination) => {
    if (!nomination.event_id) return
    const key = String(nomination.event_id)
    const list = nominationsByEventId.get(key) || []
    list.push(nomination)
    nominationsByEventId.set(key, list)
  })

  let wins = 0

  ;(events || []).forEach((event) => {
    const eventNominations = nominationsByEventId.get(String(event.id)) || []
    if (eventNominations.length === 0) return

    if (event.selected_nomination_id) {
      if (eventNominations.some((nomination) => String(nomination.id) === String(event.selected_nomination_id))) {
        wins += 1
      }
      return
    }

    if (event.selected_movie_id) {
      const matchingNominations = eventNominations.filter(
        (nomination) => nomination.movie_id && String(nomination.movie_id) === String(event.selected_movie_id)
      )

      if (matchingNominations.length > 0) {
        wins += 1
      }
    }
  })

  return wins
}

function getNominationStory(stats) {
  if (!stats.nominationTotal) {
    return {
      eyebrow: 'Pitch Deck Empty',
      title: 'Your crowd-pleaser score is waiting.',
      copy: 'Nominate a few movies and this screen will start telling you how often your picks become movie night.',
    }
  }

  if (stats.nominationSuccess >= 60) {
    return {
      eyebrow: 'Crowd Pleaser',
      title: 'Your nominations usually get the room moving.',
      copy: 'When you throw a movie into the mix, there is a real chance it becomes the pick.',
    }
  }

  if (stats.nominationSuccess >= 35) {
    return {
      eyebrow: 'Sleeper Hit',
      title: 'You land enough winners to keep everyone on edge.',
      copy: 'Your taste mixes consensus picks with a few well-aimed curveballs.',
    }
  }

  return {
    eyebrow: 'Deep Cut Hunter',
    title: 'You swing for original picks more than safe ones.',
    copy: 'Not every room is ready for your vision yet, but the range is there.',
  }
}

function revokePreviewUrl(url) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

function sanitizeFilename(fileName) {
  return (fileName || 'photo')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function uploadProfilePhoto(userId, file) {
  const extension = file.name?.includes('.') ? file.name.split('.').pop() : 'jpg'
  const safeName = sanitizeFilename(file.name || `avatar.${extension}`)
  const path = `${userId}/${Date.now()}-${safeName}`

  const { error } = await supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (error) {
    throw new Error(
      error.message?.includes('Bucket not found')
        ? 'Could not upload photo. Create the profile-avatars storage bucket first.'
        : error.message || 'Could not upload photo.'
    )
  }

  const { data } = supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .getPublicUrl(path)

  return data?.publicUrl || ''
}

function MetricPips({ value = 0, max = 10, tone = 'indigo' }) {
  const fillCount = Math.max(0, Math.min(max, Math.round(value)))
  const toneClass =
    tone === 'rose'
      ? 'from-rose-500 to-amber-400'
      : tone === 'teal'
        ? 'from-teal-400 to-indigo-500'
        : 'from-indigo-400 to-indigo-500'

  return (
    <div className="mt-4 grid grid-cols-10 gap-1">
      {Array.from({ length: max }).map((_, index) => (
        <div
          key={index}
          className={`h-2 rounded-full ${index < fillCount ? `bg-gradient-to-r ${toneClass}` : 'bg-white/8'}`}
        />
      ))}
    </div>
  )
}

function SpotlightChip({ label, value, tone = 'indigo' }) {
  const toneClass =
    tone === 'rose'
      ? 'bg-rose-500/14 text-rose-200'
      : tone === 'amber'
        ? 'bg-amber-400/14 text-amber-200'
        : 'bg-indigo-500/14 text-indigo-200'

  return (
    <div className={`rounded-2xl px-3 py-3 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.18em]">{label}</div>
      <div className="mt-1 text-lg font-black text-white">{value}</div>
    </div>
  )
}

function FlavorCard({ icon: Icon, eyebrow, title, value, tone = 'indigo', children }) {
  const toneClass =
    tone === 'rose'
      ? 'from-rose-500/14 via-slate-900 to-slate-900 border-rose-500/20 text-rose-300'
      : tone === 'amber'
        ? 'from-amber-400/14 via-slate-900 to-slate-900 border-amber-400/20 text-amber-300'
        : tone === 'teal'
          ? 'from-teal-400/14 via-slate-900 to-slate-900 border-teal-400/20 text-teal-300'
          : 'from-indigo-500/14 via-slate-900 to-slate-900 border-indigo-500/20 text-indigo-300'

  return (
    <div className={`rounded-[28px] border bg-gradient-to-br p-5 shadow-xl ${toneClass}`}>
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em]">
        <Icon size={15} />
        <span>{eyebrow}</span>
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-400">{title}</div>
      <div className="mt-1 text-3xl font-black tracking-tight text-white">{value}</div>
      {children && <div className="mt-3 text-sm text-slate-300">{children}</div>}
    </div>
  )
}

function AvatarOption({ label, selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-[24px] border px-2 py-3 text-center ${
        selected ? 'border-indigo-400 bg-indigo-500/16' : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      {children}
      <span className={`text-[11px] font-black uppercase tracking-[0.14em] ${selected ? 'text-white' : 'text-slate-400'}`}>
        {label}
      </span>
    </button>
  )
}

export default function ProfileView({ session }) {
  const [loading, setLoading] = useState(true)
  const [profileDisplayName, setProfileDisplayName] = useState('')
  const [profileUsername, setProfileUsername] = useState('')
  const [profileAvatarKey, setProfileAvatarKey] = useState('')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [profileSupportsAvatarKey, setProfileSupportsAvatarKey] = useState(false)
  const [profileSupportsAvatarUrl, setProfileSupportsAvatarUrl] = useState(false)
  const [stats, setStats] = useState({
    coordinatorCount: 0,
    nominationWins: 0,
    nominationTotal: 0,
    nominationSuccess: 0,
    topGenre: 'No genre yet',
    genreCount: 0,
    reviewCount: 0,
    averageRating: 0,
    wouldWatchAgainRate: 0,
    superlikesGiven: 0,
    attendanceCount: 0,
  })
  const [reviewHistory, setReviewHistory] = useState([])
  const [showEditor, setShowEditor] = useState(false)
  const [draftDisplayName, setDraftDisplayName] = useState('')
  const [draftAvatarKey, setDraftAvatarKey] = useState('')
  const [draftAvatarUrl, setDraftAvatarUrl] = useState('')
  const [draftPhotoPreviewUrl, setDraftPhotoPreviewUrl] = useState('')
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileNotice, setProfileNotice] = useState('')
  const photoInputRef = useRef(null)

  useEffect(() => {
    if (session?.user) loadProfile()
  }, [session])

  useEffect(() => () => {
    revokePreviewUrl(draftPhotoPreviewUrl)
  }, [draftPhotoPreviewUrl])

  const activeDisplayName = profileDisplayName || profileUsername || 'Movie Fan'
  const usernameHandle = profileUsername ? `@${profileUsername}` : ''
  const recentReviews = useMemo(() => reviewHistory.slice(0, 25), [reviewHistory])
  const nominationStory = useMemo(() => getNominationStory(stats), [stats])
  const editorAvatarUrl = draftPhotoPreviewUrl || draftAvatarUrl
  const latestReviewDate = recentReviews[0]?.created_at ? formatReviewDate(recentReviews[0].created_at) : 'No reviews yet'

  function resetDraftState() {
    revokePreviewUrl(draftPhotoPreviewUrl)
    setDraftDisplayName(profileDisplayName === 'Movie Fan' ? '' : profileDisplayName)
    setDraftAvatarKey(profileAvatarKey || '')
    setDraftAvatarUrl(profileAvatarUrl || '')
    setDraftPhotoPreviewUrl('')
    setPendingPhotoFile(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  function openEditor() {
    resetDraftState()
    setProfileError('')
    setProfileNotice('')
    setShowEditor(true)
  }

  function closeEditor() {
    resetDraftState()
    setProfileError('')
    setShowEditor(false)
  }

  function clearPhotoSelection() {
    revokePreviewUrl(draftPhotoPreviewUrl)
    setDraftPhotoPreviewUrl('')
    setPendingPhotoFile(null)
    setDraftAvatarUrl('')
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  function selectInitials() {
    clearPhotoSelection()
    setDraftAvatarKey('')
  }

  function selectPresetAvatar(key) {
    clearPhotoSelection()
    setDraftAvatarKey(key)
  }

  function handlePhotoSelected(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setProfileError('Choose an image file for your profile photo.')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Profile photos must be 5 MB or smaller.')
      event.target.value = ''
      return
    }

    setProfileError('')
    revokePreviewUrl(draftPhotoPreviewUrl)
    const previewUrl = URL.createObjectURL(file)
    setPendingPhotoFile(file)
    setDraftPhotoPreviewUrl(previewUrl)
    setDraftAvatarUrl('')
    setDraftAvatarKey('')
  }

  async function loadProfile() {
    if (!session?.user) return

    setLoading(true)
    setProfileNotice('')
    setProfileError('')

    const userId = session.user.id

    const [
      profileResponse,
      createdEventsResponse,
      nominationsResponse,
      reviewsResponse,
      votesResponse,
      attendanceResponse,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('events').select('id').eq('created_by', userId),
      supabase.from('nominations').select('id, event_id, movie_id').eq('nominated_by', userId),
      supabase
        .from('reviews')
        .select('id, rating, comment, would_watch_again, created_at, movie:movies (*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase.from('votes').select('id, vote_type').eq('user_id', userId),
      supabase.from('event_attendees').select('event_id').eq('user_id', userId),
    ])

    const nominations = nominationsResponse.data || []
    const nominationEventIds = Array.from(new Set(nominations.map((nomination) => nomination.event_id).filter(Boolean)))

    const nominationEventsResponse = nominationEventIds.length > 0
      ? await supabase
          .from('events')
          .select('id, selected_nomination_id, selected_movie_id')
          .in('id', nominationEventIds)
      : { data: [], error: null }

    const profileRow = profileResponse.data || null
    const supportsAvatarKey = Boolean(profileRow) && Object.prototype.hasOwnProperty.call(profileRow, 'avatar_key')
    const supportsAvatarUrl = Boolean(profileRow) && Object.prototype.hasOwnProperty.call(profileRow, 'avatar_url')
    const resolvedDisplayName =
      profileRow?.display_name ||
      getMetadataDisplayName(session) ||
      profileRow?.username ||
      getMetadataUsername(session) ||
      'Movie Fan'
    const resolvedUsername =
      profileRow?.username ||
      getMetadataUsername(session) ||
      ''
    const resolvedAvatarKey =
      (supportsAvatarKey ? profileRow?.avatar_key : '') ||
      getMetadataAvatarKey(session) ||
      ''
    const resolvedAvatarUrl =
      (supportsAvatarUrl ? profileRow?.avatar_url : '') ||
      getMetadataAvatarUrl(session) ||
      ''

    const reviews = reviewsResponse.data || []
    const reviewCount = reviews.length
    const averageRating = reviewCount
      ? Math.round((reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / reviewCount) * 10) / 10
      : 0
    const wouldWatchAgainCount = reviews.filter((review) => review.would_watch_again).length
    const wouldWatchAgainRate = reviewCount ? Math.round((wouldWatchAgainCount / reviewCount) * 100) : 0

    const topGenreEntry = getTopGenre(reviews)
    const nominationWins = calculateNominationWins(nominations, nominationEventsResponse.data || [])
    const nominationTotal = nominations.length
    const nominationSuccess = nominationTotal ? Math.round((nominationWins / nominationTotal) * 100) : 0
    const attendanceCount = new Set((attendanceResponse.data || []).map((row) => row.event_id).filter(Boolean)).size
    const superlikesGiven = (votesResponse.data || []).filter((vote) => vote.vote_type === 2).length

    setProfileDisplayName(resolvedDisplayName)
    setProfileUsername(resolvedUsername)
    setProfileAvatarKey(resolvedAvatarKey)
    setProfileAvatarUrl(resolvedAvatarUrl)
    setProfileSupportsAvatarKey(supportsAvatarKey)
    setProfileSupportsAvatarUrl(supportsAvatarUrl)
    setDraftDisplayName(resolvedDisplayName === 'Movie Fan' ? '' : resolvedDisplayName)
    setDraftAvatarKey(resolvedAvatarKey)
    setDraftAvatarUrl(resolvedAvatarUrl)
    setStats({
      coordinatorCount: createdEventsResponse.data?.length || 0,
      nominationWins,
      nominationTotal,
      nominationSuccess,
      topGenre: topGenreEntry?.[0] || 'No genre yet',
      genreCount: topGenreEntry?.[1] || 0,
      reviewCount,
      averageRating,
      wouldWatchAgainRate,
      superlikesGiven,
      attendanceCount,
    })
    setReviewHistory(reviews)
    setLoading(false)
  }

  async function getActiveUserMetadata() {
    const { data: sessionData } = await supabase.auth.getSession()
    let activeSession = sessionData?.session || null

    if (!activeSession) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError || !refreshed?.session) {
        throw new Error('Your session expired. Please sign in again.')
      }
      activeSession = refreshed.session
    }

    return activeSession.user?.user_metadata || {}
  }

  async function handleProfileSave() {
    if (!session?.user) return

    const rawDisplayName = draftDisplayName.trim()
    if (!rawDisplayName) {
      setProfileError('Display name cannot be empty.')
      return
    }

    setSavingProfile(true)
    setProfileError('')
    setProfileNotice('')

    try {
      let nextAvatarUrl = draftAvatarUrl || ''
      let nextAvatarKey = draftAvatarKey || ''

      if (pendingPhotoFile) {
        nextAvatarUrl = await uploadProfilePhoto(session.user.id, pendingPhotoFile)
        nextAvatarKey = ''
      }

      const currentMetadata = await getActiveUserMetadata()
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          display_name: rawDisplayName,
          avatar_key: nextAvatarKey || '',
          avatar_url: nextAvatarUrl || '',
        },
      })

      if (authError) throw authError

      const profileUpdate = { display_name: rawDisplayName }
      if (profileSupportsAvatarKey) profileUpdate.avatar_key = nextAvatarKey || null
      if (profileSupportsAvatarUrl) profileUpdate.avatar_url = nextAvatarUrl || null

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', session.user.id)

      if (profileError) throw profileError

      setProfileDisplayName(rawDisplayName)
      setProfileAvatarKey(nextAvatarKey)
      setProfileAvatarUrl(nextAvatarUrl)
      setDraftAvatarKey(nextAvatarKey)
      setDraftAvatarUrl(nextAvatarUrl)
      revokePreviewUrl(draftPhotoPreviewUrl)
      setDraftPhotoPreviewUrl('')
      setPendingPhotoFile(null)
      if (photoInputRef.current) photoInputRef.current.value = ''
      setShowEditor(false)

      const avatarNeedsSchema =
        (nextAvatarKey && !profileSupportsAvatarKey) ||
        (nextAvatarUrl && !profileSupportsAvatarUrl)

      setProfileNotice(
        avatarNeedsSchema
          ? 'Profile updated. Avatar is saved to your account, and will sync app-wide once the profile avatar columns are added.'
          : 'Profile updated.'
      )
    } catch (error) {
      setProfileError(error.message || 'Could not save your profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  if (loading) return <LoadingSpinner label="Loading profile..." />

  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white">
      <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-24">
        <div className="px-0 py-1 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <Link to="/" className="no-underline">
              <button className="p-2 rounded-full bg-white/10">
                <ChevronLeft size={20} />
              </button>
            </Link>
            <h1 className="text-3xl font-black tracking-tighter text-indigo-500">Profile</h1>
          </div>
        </div>

        <div className="mt-6 rounded-[30px] border border-white/10 bg-gradient-to-br from-indigo-500/14 via-slate-900 to-rose-500/10 p-5 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <PersonAvatar
              name={activeDisplayName}
              avatarKey={profileAvatarKey}
              avatarUrl={profileAvatarUrl}
              size={96}
              className="border-white/15 shadow-[0_0_28px_rgba(99,102,241,0.22)]"
              initialsClassName="text-2xl"
            />
            <h2 className="mt-4 text-[30px] font-black leading-tight tracking-tight text-white">
              {activeDisplayName}
            </h2>
            {usernameHandle && (
              <div className="mt-1 text-sm font-semibold text-slate-400">{usernameHandle}</div>
            )}
            <div className="mt-4">
              <button
                type="button"
                onClick={openEditor}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-black text-white"
              >
                <Edit3 size={15} />
                Edit Profile
              </button>
            </div>
          </div>

          {showEditor && (
            <div className="mt-5 rounded-[28px] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Edit Profile</div>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
                  aria-label="Close editor"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <PersonAvatar
                  name={draftDisplayName || activeDisplayName}
                  avatarKey={draftAvatarKey}
                  avatarUrl={editorAvatarUrl}
                  size={92}
                  className="border-white/15"
                  initialsClassName="text-2xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Profile Photo</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3.5 py-2 text-sm font-black text-indigo-200"
                    >
                      <ImagePlus size={15} />
                      Upload Photo
                    </button>
                    {(draftPhotoPreviewUrl || draftAvatarUrl) && (
                      <button
                        type="button"
                        onClick={clearPhotoSelection}
                        className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-sm font-bold text-white"
                      >
                        <Camera size={15} />
                        Remove Photo
                      </button>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelected}
                  />
                </div>
              </div>

              <div className="mt-5">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Display Name</div>
                <input
                  type="text"
                  value={draftDisplayName}
                  onChange={(event) => setDraftDisplayName(event.target.value)}
                  placeholder="Display name"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
                />
              </div>

              <div className="mt-5">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Character Avatars</div>
                <div className="mt-3 grid grid-cols-3 gap-4 sm:grid-cols-4">
                  <AvatarOption
                    label="Initials"
                    selected={!editorAvatarUrl && draftAvatarKey === ''}
                    onClick={selectInitials}
                  >
                    <PersonAvatar
                      name={draftDisplayName || activeDisplayName}
                      avatarKey=""
                      size={68}
                      className="border-white/10"
                      initialsClassName="text-lg"
                    />
                  </AvatarOption>

                  {PROFILE_AVATARS.map((avatar) => (
                    <AvatarOption
                      key={avatar.key}
                      label={avatar.label}
                      selected={!editorAvatarUrl && draftAvatarKey === avatar.key}
                      onClick={() => selectPresetAvatar(avatar.key)}
                    >
                      <PersonAvatar
                        name={avatar.label}
                        avatarKey={avatar.key}
                        size={68}
                        className="border-white/10"
                      />
                    </AvatarOption>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleProfileSave}
                  disabled={savingProfile}
                  className="rounded-2xl bg-indigo-500 px-4 py-3 font-black text-white"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={savingProfile}
                  className="rounded-2xl bg-white/10 px-4 py-3 font-bold text-white"
                >
                  Cancel
                </button>
              </div>

              {profileError && (
                <div className="mt-3 text-sm font-medium text-rose-400">{profileError}</div>
              )}
            </div>
          )}

          {profileNotice && (
            <div className="mt-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
              {profileNotice}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-[1.3fr_0.95fr]">
          <div className="rounded-[30px] border border-[rgba(225,29,72,0.2)] bg-gradient-to-br from-[rgba(225,29,72,0.14)] via-slate-900 to-indigo-500/10 p-6 shadow-2xl">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--theme-primary)]">
              {nominationStory.eyebrow}
            </div>
            <h2 className="mt-2 text-[28px] font-black leading-tight tracking-tight text-white">
              Nomination Success
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
              {nominationStory.title} {nominationStory.copy}
            </p>
            <div className="mt-6 flex items-end gap-4">
              <div className="text-6xl font-black leading-none text-white">
                {stats.nominationTotal ? `${stats.nominationSuccess}%` : '--'}
              </div>
              <div className="pb-2 text-sm font-semibold text-slate-300">
                {stats.nominationWins} wins from {stats.nominationTotal} nominations
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${stats.nominationTotal ? Math.max(stats.nominationSuccess, 8) : 12}%`,
                  background: 'linear-gradient(90deg, var(--theme-primary), var(--theme-accent), var(--theme-secondary))',
                }}
              />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <SpotlightChip label="Hosted" value={stats.coordinatorCount} tone="rose" />
              <SpotlightChip label="Attended" value={stats.attendanceCount} tone="indigo" />
              <SpotlightChip label="Reviewed" value={stats.reviewCount} tone="amber" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <FlavorCard
              icon={Star}
              eyebrow="Critic Meter"
              title={stats.reviewCount ? `${stats.reviewCount} ratings logged` : 'No ratings logged yet'}
              value={stats.reviewCount ? `${stats.averageRating}/10` : '--'}
              tone="indigo"
            >
              <MetricPips value={stats.averageRating} tone="indigo" />
            </FlavorCard>

            <FlavorCard
              icon={ThumbsUp}
              eyebrow="Encore Energy"
              title="Would watch again"
              value={stats.reviewCount ? `${stats.wouldWatchAgainRate}%` : '--'}
              tone="teal"
            >
              {stats.reviewCount
                ? `${stats.wouldWatchAgainRate}% of your reviews ended with a thumbs up for another round.`
                : 'Once you start reviewing, this will show how often a movie earns a repeat watch.'}
            </FlavorCard>

            <FlavorCard
              icon={Trophy}
              eyebrow="Director's Chair"
              title="Movie nights you hosted"
              value={stats.coordinatorCount}
              tone="amber"
            >
              {stats.coordinatorCount
                ? `You have already called the shots on ${stats.coordinatorCount} movie ${stats.coordinatorCount === 1 ? 'night' : 'nights'}.`
                : 'Plan a night and this stat starts keeping score.'}
            </FlavorCard>
          </div>
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[30px] border border-white/10 bg-gradient-to-br from-indigo-500/12 via-slate-900 to-slate-900 p-5 shadow-xl">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-300" />
              <h2 className="m-0 text-xl font-black tracking-tight text-white">More To Your Taste</h2>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                  <Film size={14} />
                  Genre Crush
                </div>
                <div className="mt-3 text-2xl font-black tracking-tight text-white">
                  {stats.genreCount ? stats.topGenre : 'No genre yet'}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {stats.genreCount ? `${stats.genreCount} reviews point here` : 'Rate a few movies and this will lock in.'}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                  <Heart size={14} />
                  Superlike Energy
                </div>
                <div className="mt-3 text-2xl font-black tracking-tight text-white">{stats.superlikesGiven}</div>
                <div className="mt-1 text-sm text-slate-400">
                  {stats.superlikesGiven
                    ? `You dropped ${stats.superlikesGiven} all-in vote${stats.superlikesGiven === 1 ? '' : 's'}.`
                    : 'No superlikes fired yet.'}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FlavorCard
              icon={Clapperboard}
              eyebrow="Screen Time"
              title="Events attended"
              value={stats.attendanceCount}
              tone="rose"
            >
              More nights in the room means a better read on your real movie taste.
            </FlavorCard>

            <FlavorCard
              icon={MessageSquare}
              eyebrow="Review Shelf"
              title="Written movie reactions"
              value={stats.reviewCount}
              tone="indigo"
            >
              Your review history is the memory bank for future movie debates.
            </FlavorCard>

            <FlavorCard
              icon={Ticket}
              eyebrow="Latest Note"
              title="Most recent review"
              value={latestReviewDate}
              tone="teal"
            >
              Your latest reaction is always the quickest snapshot of where your taste is headed.
            </FlavorCard>

            <FlavorCard
              icon={Target}
              eyebrow="Hit Rate"
              title="Winning nominations"
              value={`${stats.nominationWins}/${stats.nominationTotal || 0}`}
              tone="amber"
            >
              The simplest version of the stat you asked for, kept visible next to the bigger spotlight card.
            </FlavorCard>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <Film size={18} className="text-rose-500" />
          <h2 className="m-0 text-xl font-black tracking-tight text-white">Recent Reviews</h2>
        </div>

        {recentReviews.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-white/10 bg-slate-900/60 px-5 py-10 text-center text-sm text-slate-400">
            Rate a movie to build your profile history.
          </div>
        ) : (
          <div className="mt-4">
            {recentReviews.map((review) => (
              <MovieCard
                key={review.id}
                movie={review.movie}
                meta={
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1 text-sm font-bold text-amber-300">
                      <Star size={14} /> {review.rating}/10
                    </span>
                    {review.would_watch_again && (
                      <span className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-sm font-semibold text-indigo-300">
                        <ThumbsUp size={14} /> Would watch again
                      </span>
                    )}
                    {review.created_at && (
                      <span className="rounded-full bg-white/6 px-3 py-1 text-sm font-semibold text-slate-400">
                        {formatReviewDate(review.created_at)}
                      </span>
                    )}
                  </div>
                }
              >
                {review.comment ? (
                  <p className="m-0 text-base text-slate-300">"{review.comment}"</p>
                ) : (
                  <p className="m-0 text-sm text-slate-500">No written review for this one.</p>
                )}
              </MovieCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

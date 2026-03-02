export const PROFILE_AVATARS = [
  { key: 'star-cat', label: 'Star Cat', src: '/avatars/star-cat.svg' },
  { key: 'film-bot', label: 'Film Bot', src: '/avatars/film-bot.svg' },
  { key: 'neon-ghost', label: 'Neon Ghost', src: '/avatars/neon-ghost.svg' },
  { key: 'comet-fox', label: 'Comet Fox', src: '/avatars/comet-fox.svg' },
  { key: 'moon-frog', label: 'Moon Frog', src: '/avatars/moon-frog.svg' },
  { key: 'night-owl', label: 'Night Owl', src: '/avatars/night-owl.svg' },
]

export function getProfileAvatar(key) {
  if (!key) return null
  return PROFILE_AVATARS.find((avatar) => avatar.key === key) || null
}

export function getProfileAvatarSrc(key) {
  return getProfileAvatar(key)?.src || ''
}

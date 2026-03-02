import { getProfileAvatarSrc } from './profileAvatars'

function initialsFor(name) {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || '?'
}

export default function PersonAvatar({
  name,
  avatarKey,
  avatarUrl = '',
  size = 56,
  className = '',
  initialsClassName = '',
  alt,
}) {
  const avatarSrc = avatarUrl || getProfileAvatarSrc(avatarKey)

  return (
    <div
      className={`overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 ${className}`.trim()}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt={alt || name || 'Profile avatar'}
          className="h-full w-full object-cover object-center"
          draggable="false"
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/25 to-rose-500/25 text-white ${initialsClassName}`.trim()}>
          <span className="font-black">{initialsFor(name)}</span>
        </div>
      )}
    </div>
  )
}

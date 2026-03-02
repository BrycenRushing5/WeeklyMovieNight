import { useEffect, useMemo, useState } from 'react'
import { Clapperboard, Film, Ticket } from 'lucide-react'
import { clsx } from 'clsx'
import { POSTER_BASE_URL } from './tmdbClient'

const FALLBACK_GRADIENTS = [
  'from-rose-600 via-rose-500 to-orange-500',
  'from-indigo-600 via-blue-600 to-cyan-500',
  'from-emerald-600 via-teal-500 to-cyan-500',
  'from-violet-600 via-fuchsia-500 to-pink-500',
  'from-amber-500 via-orange-500 to-rose-500',
]

const FALLBACK_ICONS = [Film, Ticket, Clapperboard]

function getPosterTheme(title = '') {
  const length = title.length || 0
  return {
    gradientClassName: FALLBACK_GRADIENTS[length % FALLBACK_GRADIENTS.length],
    Icon: FALLBACK_ICONS[length % FALLBACK_ICONS.length],
  }
}

export function getMoviePosterUrl(posterPath) {
  if (!posterPath || typeof posterPath !== 'string') return ''
  if (/^https?:\/\//i.test(posterPath)) return posterPath
  return `${POSTER_BASE_URL}${posterPath}`
}

export default function MoviePoster({
  title = '',
  posterPath,
  alt,
  className,
  imageClassName,
  fallbackClassName,
  iconClassName,
  iconSize = 24,
  showTitle = true,
  titleClassName,
}) {
  const posterUrl = useMemo(() => getMoviePosterUrl(posterPath), [posterPath])
  const [imageFailed, setImageFailed] = useState(false)
  const { gradientClassName, Icon } = getPosterTheme(title)

  useEffect(() => {
    setImageFailed(false)
  }, [posterUrl])

  const showPosterImage = Boolean(posterUrl) && !imageFailed
  const isHeroFallback = iconSize >= 48
  const isLargeFallback = iconSize >= 32
  const isMediumFallback = iconSize >= 22
  const isCompactFallback = iconSize >= 16
  const fallbackPaddingClassName = isHeroFallback
    ? 'p-4'
    : isLargeFallback
      ? 'p-3'
      : isMediumFallback
        ? 'p-2.5'
        : isCompactFallback
          ? 'p-2'
          : 'p-1.5'
  const titleBaseClassName = isHeroFallback
    ? 'mt-4 text-2xl leading-[0.9]'
    : isLargeFallback
      ? 'mt-3 text-base leading-[0.95]'
      : isMediumFallback
        ? 'mt-2 text-[11px] leading-[1.02]'
        : isCompactFallback
          ? 'mt-1.5 text-[9px] leading-[1]'
          : 'mt-1 text-[7px] leading-[0.95]'

  return (
    <div className={clsx('relative overflow-hidden bg-slate-800', className)}>
      {showPosterImage ? (
        <img
          src={posterUrl}
          alt={alt || title || 'Movie poster'}
          className={clsx('h-full w-full object-cover', imageClassName)}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className={clsx(
            'absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-gradient-to-br text-center',
            gradientClassName,
            fallbackPaddingClassName,
            fallbackClassName
          )}
        >
          <Icon size={iconSize} className={clsx('shrink-0 text-white/25', iconClassName)} />
          {showTitle ? (
            <div
              className={clsx(
                'line-clamp-3 max-w-full break-words font-black tracking-tight text-white/90',
                titleBaseClassName,
                titleClassName
              )}
            >
              {title || 'Movie Night'}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

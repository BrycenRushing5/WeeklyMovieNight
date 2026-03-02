import { motion } from 'framer-motion'
import { clsx } from 'clsx'

export default function MovieCard({ movie, children, meta, topRight }) {
  // Fallback for missing data
  const hasTitle = Boolean(movie.title)
  const genreList = Array.isArray(movie.genre) ? movie.genre : (movie.genre ? [movie.genre] : [])
  const hasGenres = genreList.length > 0
  const hasScore = movie.rt_score !== null && movie.rt_score !== undefined
  const score = hasScore ? movie.rt_score : '-'
  const genres = hasGenres ? genreList.join(', ') : ''
  const description = movie.description?.trim() || ''
  
  // Color code the score
  const scoreColor = movie.rt_score >= 80 ? 'text-green-400 border-green-400' : movie.rt_score >= 60 ? 'text-yellow-400 border-yellow-400' : 'text-slate-400 border-slate-400'

  return (
    <motion.div 
      layout /* This magic prop makes other cards slide around when this one expands */
      className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-4 mb-4 relative"
    >
      {topRight && (
        <div className="absolute -top-3 -right-3 z-10">
          {topRight}
        </div>
      )}
      {/* HEADER ROW */}
      {(hasTitle || hasGenres || hasScore) && (
        <div className="flex justify-between items-start mb-2">
          <div>
            {hasTitle && <h3 className="text-lg font-bold">{movie.title}</h3>}
            {hasGenres && <p className="text-sm text-slate-400 mt-1">{genres}</p>}
          </div>
          
          {(hasScore || hasTitle) && (
            <div className="flex flex-col items-end gap-1.5">
              {/* SCORE BADGE */}
              <div className={clsx(
                "bg-black/30 px-2 py-1 rounded-md border text-xs font-bold whitespace-nowrap",
                scoreColor
              )}>
                {score === '-' ? '-' : `🍅 ${score}%`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* METADATA (Like "Nominated by...") */}
      {meta && (
        <div className="mb-3">
          {meta}
        </div>
      )}

      {/* DESCRIPTION */}
      {description && (
        <div className="relative mb-4">
          <p className="text-sm text-slate-300 leading-normal">
            {description}
          </p>
        </div>
      )}

      {/* ACTION AREA (Voting Buttons or Remove Button go here) */}
      {children && (
        <div className="pt-3 border-t border-white/10">
          {children}
        </div>
      )}
    </motion.div>
  )
}

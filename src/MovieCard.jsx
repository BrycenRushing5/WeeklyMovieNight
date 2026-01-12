import { motion } from 'framer-motion'

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
  const scoreColor = movie.rt_score >= 80 ? '#4ade80' : movie.rt_score >= 60 ? '#facc15' : '#94a3b8'

  return (
    <motion.div 
      layout /* This magic prop makes other cards slide around when this one expands */
      className="glass-panel" 
      style={{ marginBottom: '16px', padding: '16px', borderRadius: '16px', position: 'relative', overflow: 'visible' }}
    >
      {topRight && (
        <div style={{ position: 'absolute', top: '-12px', right: '-12px', zIndex: 2 }}>
          {topRight}
        </div>
      )}
      {/* HEADER ROW */}
      {(hasTitle || hasGenres || hasScore) && (
        <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            {hasTitle && <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>{movie.title}</h3>}
            {hasGenres && <p className="text-sm" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>{genres}</p>}
          </div>
          
          {(hasScore || hasTitle) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
              {/* SCORE BADGE */}
              <div style={{ 
                background: 'rgba(0,0,0,0.3)', 
                padding: '4px 8px', 
                borderRadius: '8px', 
                border: `1px solid ${scoreColor}`,
                color: scoreColor,
                fontWeight: 'bold',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap'
              }}>
                {score === '-' ? '-' : `🍅 ${score}%`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* METADATA (Like "Nominated by...") */}
      {meta && (
        <div style={{ marginBottom: '12px' }}>
          {meta}
        </div>
      )}

      {/* DESCRIPTION */}
      {description && (
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.4em' }}>
            {description}
          </p>
        </div>
      )}

      {/* ACTION AREA (Voting Buttons or Remove Button go here) */}
      {children && (
        <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {children}
        </div>
      )}
    </motion.div>
  )
}

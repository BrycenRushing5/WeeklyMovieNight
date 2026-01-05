import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function MovieCard({ movie, children, meta, topRight }) {
  const [expanded, setExpanded] = useState(false)

  // Fallback for missing data
  const score = movie.rt_score || '-'
  const genres = movie.genre?.join(', ') || 'Genre N/A'
  const description = movie.description?.trim() || ''
  const canExpand = description.length > 140
  
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
      <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>{movie.title}</h3>
          <p className="text-sm" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>{genres}</p>
        </div>
        
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
      </div>

      {/* METADATA (Like "Nominated by...") */}
      {meta && (
        <div style={{ marginBottom: '12px' }}>
          {meta}
        </div>
      )}

      {/* DESCRIPTION (EXPANDABLE) */}
      {description && (
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          {canExpand ? (
            <>
              <motion.p
                initial={false}
                animate={{ height: expanded ? 'auto' : '2.8em' }}
                style={{ 
                  margin: 0, 
                  fontSize: '0.95rem', 
                  color: '#cbd5e1', 
                  lineHeight: '1.4em',
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                onClick={() => setExpanded(!expanded)}
              >
                {description}
              </motion.p>
              <div 
                onClick={() => setExpanded(!expanded)}
                style={{ 
                  display: 'flex', justifyContent: 'center', marginTop: '4px', 
                  cursor: 'pointer', opacity: 0.5 
                }}
              >
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.4em' }}>
              {description}
            </p>
          )}
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

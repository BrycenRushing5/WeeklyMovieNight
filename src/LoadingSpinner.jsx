import { Film } from 'lucide-react'

export default function LoadingSpinner({ label = 'Loading...', size = 72, showLabel = true, compact = false }) {
  return (
    <div
      className={`loading-shell${compact ? ' compact' : ''}`}
      style={{ '--spinner-size': `${size}px` }}
    >
      <div className="loading-logo" role="status" aria-live="polite" aria-label={label}>
        <Film className="loading-icon" aria-hidden="true" size={64} strokeWidth={1.6} />
      </div>
      {showLabel ? <div className="loading-text">{label}</div> : null}
    </div>
  )
}

import { Film } from 'lucide-react'

export default function LoadingSpinner({ label = 'Loading...', size = 72, showLabel = true, compact = false }) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center py-4 w-full">
        <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <Film className="text-rose-500 relative z-10 p-1.5" size={size * 0.6} />
        </div>
        {showLabel && <div className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</div>}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-black">
      <div className="relative flex items-center justify-center">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
        
        {/* Spinning Ring */}
        <div 
            className="absolute rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin"
            style={{ width: size + 24, height: size + 24 }}
        />
        
        {/* Icon */}
        <div className="relative z-10 animate-pulse">
            <Film className="text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]" size={size} strokeWidth={1.5} />
        </div>
      </div>
      
      {showLabel && (
        <div className="mt-8 text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-indigo-400 uppercase tracking-[0.2em] animate-pulse">
            {label}
        </div>
      )}
    </div>
  )
}

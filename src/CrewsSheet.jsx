import { motion } from 'framer-motion'
import { ArrowRight, Plus, X } from 'lucide-react'
import { Link } from 'react-router-dom'

function getCrewInitials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'C'
}

export default function CrewsSheet({
  crews,
  userId,
  newCrewName,
  setNewCrewName,
  onCreateCrew,
  creatingCrew,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl"
      >
        <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-white/10" />

        <div className="border-b border-white/10 p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-purple-400">Crews</div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Your Movie Crews</h2>
              <p className="mt-1 text-sm text-slate-400">
                Open a crew or start a new one here.
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full bg-white/5 p-2 text-slate-300">
              <X size={18} />
            </button>
          </div>

          <form
            onSubmit={async (event) => {
              event.preventDefault()
              await onCreateCrew()
            }}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Create A Crew</div>
            <div className="mt-1 text-sm text-slate-400">Create a crew and jump straight into it.</div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={newCrewName}
                onChange={(event) => setNewCrewName(event.target.value)}
                placeholder="Movie crew name"
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={creatingCrew || !newCrewName.trim()}
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 font-black text-white disabled:opacity-50 sm:w-auto"
              >
                <Plus size={16} />
                {creatingCrew ? 'Creating' : 'Create'}
              </button>
            </div>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {crews.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 px-5 py-10 text-center">
              <div className="text-lg font-black text-white">No crews yet</div>
              <p className="mt-2 text-sm text-slate-400">
                Create one above and use it for shared events, invites, and group planning.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {crews.map(crew => (
                <Link key={crew.id} to={`/group/${crew.id}`} onClick={onClose} className="block">
                  <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/80 to-indigo-500/80 text-sm font-black text-white shadow-lg">
                      {getCrewInitials(crew.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-base font-black text-white">{crew.name}</div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${crew.created_by === userId ? 'bg-amber-500/15 text-amber-300' : 'bg-white/10 text-slate-300'}`}>
                          {crew.created_by === userId ? 'Creator' : 'Member'}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-400">Open crew details</div>
                    </div>
                    <ArrowRight size={18} className="shrink-0 text-slate-500" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

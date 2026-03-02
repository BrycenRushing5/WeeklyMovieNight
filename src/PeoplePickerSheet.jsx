import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Search, UserPlus, Users, X } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'
import PersonAvatar from './PersonAvatar'
import { getPersonAvatarKey, getPersonAvatarUrl, searchPeople } from './peopleSearch'

function PersonRow({ person, onAdd, busy }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <PersonAvatar
        name={person.name}
        avatarKey={getPersonAvatarKey(person)}
        avatarUrl={getPersonAvatarUrl(person)}
        size={44}
        className="shrink-0 rounded-2xl border-white/10 shadow-lg"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-white">{person.name}</div>
        <div className="truncate text-xs text-slate-400">
          {person.username ? `@${person.username}` : 'Movie Fan'}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAdd(person)}
        disabled={busy}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-indigo-500/15 px-4 text-xs font-black text-indigo-300 ring-1 ring-indigo-500/30 disabled:opacity-60"
      >
        {busy ? <Check size={14} /> : <UserPlus size={14} />}
        {busy ? 'Adding' : 'Add'}
      </button>
    </div>
  )
}

function Section({ title, description, items, onAdd, addingIds }) {
  if (items.length === 0) return null

  return (
    <section className="space-y-3">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{title}</div>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      <div className="space-y-2">
        {items.map(person => (
          <PersonRow key={person.id} person={person} onAdd={onAdd} busy={addingIds.has(String(person.id))} />
        ))}
      </div>
    </section>
  )
}

export default function PeoplePickerSheet({
  title,
  subtitle,
  placeholder = 'Search by name or username',
  searchEmptyText = 'No people matched that search.',
  browseEmptyText = 'Search by name or username to add someone new.',
  excludeIds = [],
  sections = [],
  onAdd,
  onClose,
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [addingIds, setAddingIds] = useState(new Set())
  const [locallyAddedIds, setLocallyAddedIds] = useState(new Set())
  const [actionError, setActionError] = useState('')
  const inputRef = useRef(null)

  const trimmedQuery = query.trim()
  const hiddenIdList = useMemo(() => {
    return Array.from(new Set(
      [...(excludeIds || []), ...locallyAddedIds]
        .filter(id => id !== null && id !== undefined && id !== '')
        .map(id => String(id))
    )).sort()
  }, [excludeIds, locallyAddedIds])
  const hiddenIdKey = hiddenIdList.join('|')
  const hiddenIds = useMemo(() => new Set(hiddenIdList), [hiddenIdKey])

  useEffect(() => {
    let active = true

    async function runSearch() {
      if (trimmedQuery.length < 2) {
        setResults([])
        setLoadingSearch(false)
        return
      }

      setLoadingSearch(true)
      const people = await searchPeople(trimmedQuery, { excludeIds: Array.from(hiddenIds) })
      if (!active) return
      setResults(people)
      setLoadingSearch(false)
    }

    runSearch()
    return () => {
      active = false
    }
  }, [trimmedQuery, hiddenIdKey])

  const visibleSections = useMemo(() => {
    const seen = new Set(hiddenIds)

    return (sections || []).map(section => {
      const items = (section.items || []).filter(person => {
        const id = String(person.id)
        if (!id || seen.has(id)) return false
        seen.add(id)
        return true
      })

      return { ...section, items }
    }).filter(section => section.items.length > 0)
  }, [sections, hiddenIdKey])

  const visibleResults = useMemo(() => {
    return results.filter(person => !hiddenIds.has(String(person.id)))
  }, [results, hiddenIdKey])

  const handleAdd = async (person) => {
    const personId = String(person.id)
    setActionError('')
    setAddingIds(prev => new Set(prev).add(personId))

    try {
      await onAdd(person)
      setLocallyAddedIds(prev => new Set(prev).add(personId))
    } catch (error) {
      console.error('Error adding person:', error)
      setActionError(error?.message || 'Could not add that person.')
    } finally {
      setAddingIds(prev => {
        const next = new Set(prev)
        next.delete(personId)
        return next
      })
    }
  }

  const isSearching = trimmedQuery.length >= 2

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        onClick={(event) => event.stopPropagation()}
        className="flex h-[78vh] w-full max-w-lg max-h-[38rem] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl"
      >
        <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-white/10" />

        <div className="shrink-0 border-b border-white/10 p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-400">People</div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{title}</h2>
              {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-full bg-white/5 p-2 text-slate-300">
              <X size={18} />
            </button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/12 via-slate-900 to-rose-500/10 p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              <Users size={14} />
              Find People
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                inputRef.current?.blur()
              }}
              className="relative mt-3"
            >
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur()
                  }
                }}
                enterKeyHint="search"
                placeholder={placeholder}
                className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 pl-11 pr-4 text-white outline-none focus:border-indigo-500"
              />
            </form>
            <div className="mt-2 text-xs text-slate-500">
              {isSearching ? 'Search results update as you type.' : 'Type at least 2 characters, or pick from the suggestions below.'}
            </div>
          </div>

          {actionError && (
            <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {actionError}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isSearching ? (
            loadingSearch ? (
              <LoadingSpinner label="Searching people..." compact size={40} />
            ) : visibleResults.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-slate-500">
                {searchEmptyText}
              </div>
            ) : (
              <Section
                title="Search Results"
                items={visibleResults}
                onAdd={handleAdd}
                addingIds={addingIds}
              />
            )
          ) : visibleSections.length > 0 ? (
            <div className="space-y-6">
              {visibleSections.map(section => (
                <Section
                  key={section.id || section.title}
                  title={section.title}
                  description={section.description}
                  items={section.items}
                  onAdd={handleAdd}
                  addingIds={addingIds}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-slate-500">
              {browseEmptyText}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

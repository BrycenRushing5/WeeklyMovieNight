import { supabase } from './supabaseClient'

function normalizeId(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function sanitizeSearchTerm(query) {
  return (query || '')
    .trim()
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sortPeopleByName(left, right) {
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
}

export function getPersonName(person) {
  if (!person) return 'Movie Fan'
  return person.name || person.display_name || person.username || person.profiles?.display_name || person.profiles?.username || 'Movie Fan'
}

export function getPersonUsername(person) {
  if (!person) return ''
  return person.username || person.profiles?.username || ''
}

export function getPersonAvatarKey(person) {
  if (!person) return ''
  return person.avatar_key || person.profiles?.avatar_key || ''
}

export function getPersonAvatarUrl(person) {
  if (!person) return ''
  return person.avatar_url || person.profiles?.avatar_url || ''
}

export function getPersonInitials(person) {
  const name = typeof person === 'string' ? person : getPersonName(person)
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map(part => part[0]?.toUpperCase() || '')
  return initials.join('') || '?'
}

export function dedupePeople(...lists) {
  const seen = new Set()
  const merged = []

  lists.flat().forEach(person => {
    const id = normalizeId(person?.id ?? person?.user_id)
    if (!id || seen.has(id)) return
    seen.add(id)
    merged.push({
      id,
      name: getPersonName(person),
      username: getPersonUsername(person),
      avatar_key: getPersonAvatarKey(person),
      avatar_url: getPersonAvatarUrl(person),
    })
  })

  return merged
}

function filterExcludedPeople(people, excludeIds = []) {
  const excluded = new Set((excludeIds || []).map(normalizeId))
  return dedupePeople(people).filter(person => !excluded.has(person.id))
}

export async function searchPeople(query, { excludeIds = [], limit = 12 } = {}) {
  const searchTerm = sanitizeSearchTerm(query)
  if (searchTerm.length < 2) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`display_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`)
    .limit(limit)

  if (error) {
    console.error('Error searching profiles:', error)
    return []
  }

  return filterExcludedPeople(data || [], excludeIds)
    .sort(sortPeopleByName)
    .slice(0, limit)
}

export async function loadRecentPeople(userId, { excludeIds = [], limit = 12 } = {}) {
  if (!userId) return []

  const { data: myEvents, error: myEventsError } = await supabase
    .from('event_attendees')
    .select('event_id')
    .eq('user_id', userId)

  if (myEventsError) {
    console.error('Error loading recent people event ids:', myEventsError)
    return []
  }

  const eventIds = (myEvents || []).map(item => item.event_id).filter(Boolean)
  if (eventIds.length === 0) return []

  const { data, error } = await supabase
    .from('event_attendees')
    .select('user_id, profiles(*)')
    .in('event_id', eventIds)
    .neq('user_id', userId)

  if (error) {
    console.error('Error loading recent people:', error)
    return []
  }

  return filterExcludedPeople(data || [], [...excludeIds, userId])
    .sort(sortPeopleByName)
    .slice(0, limit)
}

export async function loadGroupPeople(groupId, { excludeIds = [], limit = 20 } = {}) {
  if (!groupId) return []

  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, profiles(*)')
    .eq('group_id', groupId)

  if (error) {
    console.error('Error loading group people:', error)
    return []
  }

  return filterExcludedPeople(data || [], excludeIds)
    .sort(sortPeopleByName)
    .slice(0, limit)
}

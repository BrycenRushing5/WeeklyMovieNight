import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function JoinGroup({ session }) {
  const { shareCode } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('Joining group...')
  const eventId = searchParams.get('eventId')
  const addToGroup = searchParams.get('addToGroup') !== '0'

  useEffect(() => {
    if (session) {
      joinGroup()
    }
  }, [session])

  async function joinGroup() {
    // 1. Find the group ID from the code
    const { data: group, error } = await supabase
      .from('groups')
      .select('id, name')
      .eq('share_code', shareCode)
      .single()

    if (error || !group) {
      setStatus('Invalid Invite Link 😞')
      return
    }

    if (addToGroup) {
      // 2. Add user to group
      const { error: joinError } = await supabase
        .from('group_members')
        .insert([{ group_id: group.id, user_id: session.user.id }])

      if (joinError) {
        // If error is code 23505, it means they are already in the group (UNIQUE constraint)
        if (joinError.code === '23505') {
          if (eventId) {
            await supabase.from('event_attendees').upsert([{ event_id: eventId, user_id: session.user.id }], { onConflict: 'event_id, user_id' })
            return navigate(`/room/${eventId}`)
          }
          alert(`You are already in ${group.name}!`)
          navigate(`/group/${group.id}`)
          return
        }
        console.error(joinError)
        setStatus('Error joining group')
        return
      }
    }

    if (eventId) {
      await supabase.from('event_attendees').upsert([{ event_id: eventId, user_id: session.user.id }], { onConflict: 'event_id, user_id' })
      navigate(`/room/${eventId}`)
      return
    }

    alert(`Success! You joined ${group.name}`)
    navigate(`/group/${group.id}`)
  }

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>{status}</h2>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function JoinGroup({ session }) {
  const { shareCode } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('Joining group...')

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

    // 2. Add user to group
    const { error: joinError } = await supabase
      .from('group_members')
      .insert([{ group_id: group.id, user_id: session.user.id }])

    if (joinError) {
      // If error is code 23505, it means they are already in the group (UNIQUE constraint)
      if (joinError.code === '23505') {
        alert(`You are already in ${group.name}!`)
        navigate('/')
        return
      }
      console.error(joinError)
      setStatus('Error joining group')
    } else {
      alert(`Success! You joined ${group.name}`)
      navigate('/')
    }
  }

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>{status}</h2>
    </div>
  )
}
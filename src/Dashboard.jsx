import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom' // We need this for navigation
import { supabase } from './supabaseClient'

export default function Dashboard({ session }) {
  const [groups, setGroups] = useState([])
  const [newGroupName, setNewGroupName] = useState('')
  const [loading, setLoading] = useState(false)
  
  // FIX: Get the username from metadata instead of the email
  const username = session.user.user_metadata.username || session.user.email

  useEffect(() => {
    getMyGroups()
  }, [])

  async function getMyGroups() {
    // This query asks: "Give me all groups that I am a member of"
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        group:groups (
          id, name, share_code
        )
      `)
      .eq('user_id', session.user.id)

    if (error) console.error(error)
    else setGroups(data.map(item => item.group)) // Flatten the structure
  }

  async function createGroup() {
    if (!newGroupName) return
    setLoading(true)

    // 1. Create the Group
    // We generate a random share code instantly
    const shareCode = Math.random().toString(36).substring(2, 9)
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .insert([{ name: newGroupName, share_code: shareCode }])
      .select()
      .single()

    if (groupError) {
      alert('Error creating group')
      setLoading(false)
      return
    }

    // 2. Add ME to the group automatically
    const { error: memberError } = await supabase
      .from('group_members')
      .insert([{ group_id: groupData.id, user_id: session.user.id }])

    if (!memberError) {
      setNewGroupName('')
      getMyGroups() // Refresh the list
    }
    setLoading(false)
  }

  const copyInviteLink = (shareCode) => {
    // Creates a link like: https://your-site.com/join/abc1234
    const url = `${window.location.origin}/join/${shareCode}`
    navigator.clipboard.writeText(url)
    alert('Invite link copied to clipboard! Send it to your friends.')
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>👋 Hi, {username}</h1>
        <button onClick={() => supabase.auth.signOut()} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc' }}>Sign Out</button>
      </div>

      {/* CREATE GROUP SECTION */}
      <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '12px', marginBottom: '30px' }}>
        <h3>Create a New Squad</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            placeholder="Group Name (e.g. Sunday Watchers)" 
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
          />
          <button 
            onClick={createGroup} 
            disabled={loading}
            style={{ padding: '10px 20px', background: 'black', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {/* GROUPS LIST */}
      <h3>Your Groups</h3>
      {groups.length === 0 ? <p style={{color: '#888'}}>You aren't in any groups yet.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {groups.map(group => (
            <div key={group.id} style={{ border: '1px solid #eee', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>{group.name}</h3>
                <Link to={`/group/${group.id}`} style={{ color: '#4da6ff', textDecoration: 'none', fontWeight: 'bold' }}>View Events →</Link>
              </div>
              <button 
                onClick={() => copyInviteLink(group.share_code)}
                style={{ padding: '8px 12px', background: '#e0f7fa', color: '#006064', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                🔗 Copy Invite
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
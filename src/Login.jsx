import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function Login() {
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const navigate = useNavigate()

  // Helper: Generate a random ID for the user (simple version)
  const getUserId = () => {
    let id = localStorage.getItem('movie_user_id')
    if (!id) {
      id = Math.random().toString(36).substring(7)
      localStorage.setItem('movie_user_id', id)
    }
    return id
  }

  const handleCreate = async () => {
    if (!name) return alert('Please enter your name!')
    
    // Generate a simple 4-digit code (e.g., 2394)
    const code = Math.floor(1000 + Math.random() * 9000).toString()
    
    const userId = getUserId()
    
    // Create the session in Supabase
    const { data, error } = await supabase
      .from('sessions')
      .insert([{ session_code: code, host_user_id: userId, watch_date: new Date() }])
      .select()

    if (error) {
      console.error(error)
      alert('Error creating room')
    } else {
      // Save details and move to the voting room
      localStorage.setItem('movie_user_name', name)
      localStorage.setItem('session_id', data[0].id)
      navigate(`/room/${code}`)
    }
  }

  const handleJoin = async () => {
    if (!name || !roomCode) return alert('Please enter name and code!')
    
    // Check if room exists
    const { data, error } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_code', roomCode)
      .single()

    if (error || !data) {
      alert('Room not found!')
    } else {
      const userId = getUserId()
      localStorage.setItem('movie_user_name', name)
      localStorage.setItem('session_id', data.id)
      navigate(`/room/${roomCode}`)
    }
  }

  return (
    <div className="login-container" style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>🍿 Movie Night</h1>
      <input 
        placeholder="Your Name" 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        style={{ padding: '10px', fontSize: '16px', display: 'block', margin: '10px auto' }}
      />
      
      <div style={{ marginTop: '30px' }}>
        <h3>Host a Night</h3>
        <button onClick={handleCreate} style={{ padding: '10px 20px' }}>Create New Group</button>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h3>Join a Group</h3>
        <input 
          placeholder="Enter 4-digit Code" 
          value={roomCode} 
          onChange={(e) => setRoomCode(e.target.value)}
          style={{ padding: '10px', width: '150px' }} 
        />
        <br />
        <button onClick={handleJoin} style={{ marginTop: '10px', padding: '10px 20px' }}>Join</button>
      </div>
    </div>
  )
}
import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    // THE TRICK: Automatically create a fake email based on the username
    // We remove spaces and make it lowercase to avoid issues
    const cleanUsername = username.trim().replace(/\s+/g, '').toLowerCase()
    const ghostEmail = `${cleanUsername}@movienight.com`

    let errorDetails = null

    if (isSignUp) {
      // SIGN UP
      const { error } = await supabase.auth.signUp({
        email: ghostEmail,
        password: password,
        options: {
          data: { username: username }, // Saves the "Real" display name
        },
      })
      errorDetails = error
    } else {
      // LOG IN
      const { error } = await supabase.auth.signInWithPassword({
        email: ghostEmail,
        password: password,
      })
      errorDetails = error
    }

    if (errorDetails) {
      // If the error says "Invalid login credentials", we can say "Wrong password or username"
      alert(errorDetails.message)
    } 
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
      <h1>🎬 {isSignUp ? 'Join the Crew' : 'Welcome Back'}</h1>
      <p style={{color: '#666', marginBottom: '20px'}}>
        {isSignUp ? 'Create a username to start voting.' : 'Enter your username to continue.'}
      </p>

      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <input
          type="text"
          placeholder="Username (e.g. MovieBuff99)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }}
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }}
        />

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            padding: '12px', background: 'black', color: 'white', 
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' 
          }}
        >
          {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Log In'}
        </button>
      </form>

      <div style={{ marginTop: '20px', fontSize: '0.9rem' }}>
        <button 
          onClick={() => setIsSignUp(!isSignUp)}
          style={{ background: 'none', border: 'none', color: '#4da6ff', textDecoration: 'underline', cursor: 'pointer' }}
        >
          {isSignUp ? 'I already have an account' : 'New here? Create an account'}
        </button>
      </div>
    </div>
  )
}
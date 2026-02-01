import { useState } from 'react'
import { supabase } from './supabaseClient'
import { Film } from 'lucide-react'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState(null)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [username, setUsername] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setAuthError(null)
    
    const email = `${username}@movienight.com`

    if (isSigningUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
            display_name: username
          }
        }
      })
      if (error) setAuthError(error)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setAuthError(error)
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-black selection:bg-pink-500/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
            <Film size={48} className="mx-auto text-primary" />
            <h1 className="text-4xl font-extrabold mt-4">Movie Night</h1>
            <p className="text-slate-400">Your place for cinematic showdowns.</p>
        </div>

        <form
          className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-8"
          onSubmit={handleAuth}
        >
          <input
            className="w-full bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base mb-4"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            className="w-full bg-black/30 border border-white/10 text-white p-3.5 rounded-lg text-base"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <button
            className="w-full mt-6 bg-primary text-white p-3 rounded-lg font-bold text-lg"
            disabled={loading}
          >
            {loading ? 'Processing...' : (isSigningUp ? 'Sign Up' : 'Sign In')}
          </button>
          
          {authError && (
            <div className="mt-4 text-center text-red-400">
              {authError.message}
            </div>
          )}
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => setIsSigningUp(!isSigningUp)}
            className="text-slate-400 hover:text-white"
          >
            {isSigningUp
              ? 'Already have an account? Sign In'
              : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  )
}

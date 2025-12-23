import { useState } from 'react'
import { motion } from 'framer-motion' // For smooth entrance
import { User, Lock, Film, ArrowRight } from 'lucide-react' // Icons
import { supabase } from './supabaseClient'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    // The ghost email trick
    const cleanUsername = username.trim().replace(/\s+/g, '').toLowerCase()
    const ghostEmail = `${cleanUsername}@movienight.com`

    let errorDetails = null
    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email: ghostEmail, password, options: { data: { username } } })
      : await supabase.auth.signInWithPassword({ email: ghostEmail, password })

    if (error) alert(error.message.includes('Invalid login') ? 'Wrong username or password' : error.message)
    setLoading(false)
  }

  // Animation variants for staggered entrance
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.1 } 
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <div style={{ 
      minHeight: '80vh', /* Center vertically on screen */
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center' 
    }}>
      
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ width: '100%', maxWidth: '360px' }} /*Keep it slim */
      >
        
        {/* HEADER */}
        <motion.div variants={itemVariants} style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Film size={48} className="gradient-text" style={{ marginBottom: '10px' }} />
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-1px', lineHeight: 1, margin: 0 }}>
            <span className="gradient-text">Popcorn</span><br />
            & Picks.
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '10px', fontSize: '1.1rem' }}>
            {isSignUp ? 'Join the crew.' : 'Welcome back.'}
          </p>
        </motion.div>

        {/* FORM */}
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* Username Input with Icon */}
          <motion.div variants={itemVariants} style={{ position: 'relative' }}>
            <User size={20} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ paddingLeft: '44px', background: 'rgba(255,255,255,0.05)', border: 'none' }} /* Subtle background */
            />
          </motion.div>

          {/* Password Input with Icon */}
          <motion.div variants={itemVariants} style={{ position: 'relative' }}>
            <Lock size={20} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ paddingLeft: '44px', background: 'rgba(255,255,255,0.05)', border: 'none' }}
            />
          </motion.div>

          <motion.button 
            variants={itemVariants}
            type="submit" 
            disabled={loading}
            style={{ 
              marginTop: '10px',
              background: 'var(--primary)', /* Neon Pink accent */
              color: 'white', padding: '16px', borderRadius: '14px', fontSize: '1.1rem',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
              boxShadow: '0 4px 20px rgba(255, 0, 85, 0.3)' /* Subtle glow */
            }}
          >
            {loading ? 'Processing...' : (
              <>
                {isSignUp ? 'Create Account' : 'Sign In'} <ArrowRight size={20} />
              </>
            )}
          </motion.button>
        </form>

        {/* TOGGLE LINK */}
        <motion.div variants={itemVariants} style={{ marginTop: '30px', textAlign: 'center' }}>
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            style={{ background: 'none', color: 'var(--text-muted)', fontSize: '0.9rem' }}
          >
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <span style={{ color: 'var(--text)', fontWeight: '600', textDecoration: 'underline' }}>
              {isSignUp ? 'Sign In' : 'Join Now'}
            </span>
          </button>
        </motion.div>

      </motion.div>
    </div>
  )
}
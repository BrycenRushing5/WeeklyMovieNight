import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Lock, Film, ArrowRight } from 'lucide-react'
import { supabase } from './supabaseClient'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showCreatePrompt, setShowCreatePrompt] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    const cleanUsername = username.trim().replace(/\s+/g, '').toLowerCase()
    const ghostEmail = `${cleanUsername}@movienight.com`

    const { error } = isSignUp 
      ? await supabase.auth.signUp({
          email: ghostEmail,
          password,
          options: { data: { username, display_name: displayName } }
        })
      : await supabase.auth.signInWithPassword({ email: ghostEmail, password })

    if (error) {
      const isInvalidLogin = error.message.toLowerCase().includes('invalid login')
      if (!isSignUp && isInvalidLogin) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.trim())
          .maybeSingle()
        
        if (!profile) setShowCreatePrompt(true)
        else alert('Wrong username or password')
      } else {
        alert(error.message.includes('Invalid login') ? 'Wrong username or password' : error.message)
      }
    }
    setLoading(false)
  }

  // Animation variants
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
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      paddingTop: '15vh' /* <-- ANCHOR TO TOP (Prevents Jumping) */
    }}>
      
      <motion.div 
        layout /* <-- SMOOTHS RESIZING */
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ width: '100%', maxWidth: '360px' }}
      >
        {/* HEADER */}
        {/* We add layout here too so if padding changes it slides instead of jumping */}
        <motion.div layout variants={itemVariants} style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Film size={48} className="gradient-text" style={{ marginBottom: '10px' }} />
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-1px', lineHeight: 1, margin: 0 }}>
            <span className="gradient-text">Popcorn</span><br />
            & Picks.
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '10px', fontSize: '1.1rem' }}>
            {isSignUp ? 'Join the crew.' : 'Welcome back.'}
          </p>
        </motion.div>

        {/* FORMS */}
        <AnimatePresence mode="wait">
          {isSignUp ? (
            <SignUpForm
              key="signup"
              itemVariants={itemVariants}
              loading={loading}
              username={username}
              setUsername={setUsername}
              displayName={displayName}
              setDisplayName={setDisplayName}
              password={password}
              setPassword={setPassword}
              onSubmit={handleAuth}
            />
          ) : (
            <SignInForm
              key="signin"
              itemVariants={itemVariants}
              loading={loading}
              username={username}
              setUsername={setUsername}
              password={password}
              setPassword={setPassword}
              onSubmit={handleAuth}
            />
          )}
        </AnimatePresence>

        {/* TOGGLE LINK */}
        <motion.div layout variants={itemVariants} style={{ marginTop: '30px', textAlign: 'center' }}>
          <button 
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              if (isSignUp) setDisplayName('')
            }}
            style={{ background: 'none', color: 'var(--text-muted)', fontSize: '0.9rem' }}
          >
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <span style={{ color: 'var(--text)', fontWeight: '600', textDecoration: 'underline' }}>
              {isSignUp ? 'Sign In' : 'Join Now'}
            </span>
          </button>
        </motion.div>

      </motion.div>

      {/* ERROR PROMPT */}
      <AnimatePresence>
        {showCreatePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)' }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              style={{ width: '90%', maxWidth: '420px', background: '#1a1a2e', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Profile not found</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                We couldn’t find that username. Did you want to create a profile instead?
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setIsSignUp(true)
                    setShowCreatePrompt(false)
                  }}
                  style={{ flex: 1, background: '#00E5FF', color: 'black', padding: '10px', borderRadius: '12px', fontWeight: 700 }}
                >
                  Create Profile
                </button>
                <button
                  onClick={() => setShowCreatePrompt(false)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: 'white', padding: '10px', borderRadius: '12px', fontWeight: 700 }}
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ... Use the same SignInForm and SignUpForm components (with motion.form) from the previous step ...
function SignInForm({ itemVariants, loading, username, setUsername, password, setPassword, onSubmit }) {
    return (
      <motion.form 
        initial="hidden" animate="visible" exit="hidden"
        onSubmit={onSubmit} 
        style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
      >
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Username</span>
          <div style={{ position: 'relative' }}>
            <User size={20} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ paddingLeft: '44px', background: 'rgba(255,255,255,0.05)', border: 'none' }} />
          </div>
        </motion.div>
  
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Password</span>
          <div style={{ position: 'relative' }}>
            <Lock size={20} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ paddingLeft: '44px', background: 'rgba(255,255,255,0.05)', border: 'none' }} />
          </div>
        </motion.div>
  
        <motion.button variants={itemVariants} type="submit" disabled={loading} style={{ marginTop: '10px', background: 'var(--primary)', color: 'white', padding: '16px', borderRadius: '14px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 4px 20px rgba(255, 0, 85, 0.3)' }}>
          {loading ? 'Processing...' : <>Sign In <ArrowRight size={20} /></>}
        </motion.button>
      </motion.form>
    )
  }
  
  function SignUpForm({ itemVariants, loading, username, setUsername, displayName, setDisplayName, password, setPassword, onSubmit }) {
    return (
      <motion.form 
        initial="hidden" animate="visible" exit="hidden"
        onSubmit={onSubmit} 
        style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
      >
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Username</span>
          <div style={{ position: 'relative' }}>
            <User size={20} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ paddingLeft: '44px', background: 'rgba(255,255,255,0.05)', border: 'none' }} />
          </div>
        </motion.div>
  
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Display Name</span>
          <div style={{ position: 'relative' }}>
            <User size={20} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
            <input type="text" placeholder="Display Name (shown to others)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required style={{ paddingLeft: '44px', background: 'rgba(255,255,255,0.05)', border: 'none' }} />
          </div>
        </motion.div>
  
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Password</span>
          <div style={{ position: 'relative' }}>
            <Lock size={20} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ paddingLeft: '44px', background: 'rgba(255,255,255,0.05)', border: 'none' }} />
          </div>
        </motion.div>
  
        <motion.button variants={itemVariants} type="submit" disabled={loading} style={{ marginTop: '10px', background: 'var(--primary)', color: 'white', padding: '16px', borderRadius: '14px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 4px 20px rgba(255, 0, 85, 0.3)' }}>
          {loading ? 'Processing...' : <>Create Account <ArrowRight size={20} /></>}
        </motion.button>
      </motion.form>
    )
  }
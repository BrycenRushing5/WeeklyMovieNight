import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react'
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
      flex: 1, 
      width: '100%',
      display: 'flex', 
      flexDirection: 'column', 
    }}>
      
      {/* TOP SECTION - HEADER */}
      {/* Play with flexBasis (currently 45%) to adjust vertical position */}
      <div style={{ 
        flexBasis: '35%', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'flex-end', 
        alignItems: 'center', 
        paddingBottom: '30px',
        paddingTop: '15px'
      }}>
        <motion.div variants={itemVariants} initial="hidden" animate="visible" style={{ textAlign: 'center', marginTop: '18px' }}>
          <img
            src="/flick-pick-logo.png"
            alt="Flick Pick logo"
            style={{
              width: '112px',
              height: '112px',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto 14px auto',
              filter: 'drop-shadow(0 0 24px rgba(99, 102, 241, 0.28))',
            }}
            draggable="false"
          />
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-1px', lineHeight: 1, margin: 0 }}>
            <span style={{ color: '#e11d48' }}>Flick</span>
            <span style={{ color: '#6366f1' }}>Pick</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '10px', fontSize: '1.1rem' }}>
            {isSignUp ? 'Join the crew' : 'Welcome back'}
          </p>
        </motion.div>
      </div>

      {/* BOTTOM SECTION - FORMS */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'flex-start', 
        alignItems: 'center',
        padding: '0 20px'
      }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
        {/* FORMS */}
        <AnimatePresence mode="wait">
          {isSignUp ? (
            <motion.div
              key="signup"
              initial="hidden" animate="visible" exit="hidden"
              variants={containerVariants}
            >
              <SignUpForm
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
              <motion.div variants={itemVariants} style={{ marginTop: '24px', textAlign: 'center' }}>
                <button 
                  type="button"
                  onClick={() => { setIsSignUp(false); setDisplayName('') }}
                  style={{ background: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', border: 'none', cursor: 'pointer' }}
                >
                  Already have an account? <span style={{ color: 'white', fontWeight: '600', textDecoration: 'underline' }}>Sign In</span>
                </button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="signin"
              initial="hidden" animate="visible" exit="hidden"
              variants={containerVariants}
            >
              <SignInForm
                itemVariants={itemVariants}
                loading={loading}
                username={username}
                setUsername={setUsername}
                password={password}
                setPassword={setPassword}
                onSubmit={handleAuth}
              />
              <motion.div variants={itemVariants} style={{ marginTop: '24px', textAlign: 'center' }}>
                <button 
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  style={{ background: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', border: 'none', cursor: 'pointer' }}
                >
                  Don't have an account? <span style={{ color: 'white', fontWeight: '600', textDecoration: 'underline' }}>Join Now</span>
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        </div>
      </div>

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
    const [showPassword, setShowPassword] = useState(false)
    return (
      <form 
        onSubmit={onSubmit} 
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
          <span className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', marginLeft: '4px' }}>USERNAME</span>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ width: '100%', padding: '12px 12px 12px 44px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none' }} />
          </div>
        </motion.div>
  
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
          <span className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', marginLeft: '4px' }}>PASSWORD</span>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px 44px 12px 44px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none' }} />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </motion.div>
  
        <motion.button variants={itemVariants} type="submit" disabled={loading} style={{ marginTop: '8px', background: 'var(--theme-primary)', color: 'white', padding: '14px', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 4px 20px var(--theme-primary-shadow)', border: 'none', cursor: 'pointer' }}>
          {loading ? 'Processing...' : <>Sign In <ArrowRight size={20} /></>}
        </motion.button>
      </form>
    )
  }
  
  function SignUpForm({ itemVariants, loading, username, setUsername, displayName, setDisplayName, password, setPassword, onSubmit }) {
    const [showPassword, setShowPassword] = useState(false)
    return (
      <form 
        onSubmit={onSubmit} 
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
          <span className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', marginLeft: '4px' }}>USERNAME</span>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ width: '100%', padding: '12px 12px 12px 44px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none' }} />
          </div>
        </motion.div>
  
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
          <span className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', marginLeft: '4px' }}>DISPLAY NAME</span>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input type="text" placeholder="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required style={{ width: '100%', padding: '12px 12px 12px 44px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none' }} />
          </div>
        </motion.div>
  
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
          <span className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', marginLeft: '4px' }}>PASSWORD</span>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px 44px 12px 44px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none' }} />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </motion.div>
  
        <motion.button variants={itemVariants} type="submit" disabled={loading} style={{ marginTop: '8px', background: 'var(--theme-primary)', color: 'white', padding: '14px', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 4px 20px var(--theme-primary-shadow)', border: 'none', cursor: 'pointer' }}>
          {loading ? 'Processing...' : <>Create Account <ArrowRight size={20} /></>}
        </motion.button>
      </form>
    )
  }

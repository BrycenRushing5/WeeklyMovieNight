import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { supabase } from './supabaseClient'

// Legacy accounts sign in with a fabricated address built from the username.
// New accounts (web or iOS) use a real email, so sign-in accepts either.
const GHOST_EMAIL_DOMAIN = 'movienight.com'

function ghostEmailFor(username) {
  const clean = username.trim().replace(/\s+/g, '').toLowerCase()
  return `${clean}@${GHOST_EMAIL_DOMAIN}`
}

// Asks the database how a username signs in, without ever exposing an email.
// Returns { exists, uses_email }; falls back to legacy behavior if the
// helper function hasn't been installed yet.
async function fetchLoginHint(username) {
  const { data, error } = await supabase.rpc('username_login_hint', { candidate: username })
  if (error || !data) return null
  return data
}

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showCreatePrompt, setShowCreatePrompt] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')

    try {
      if (isSignUp) await handleSignUp()
      else await handleSignIn()
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async () => {
    const value = identifier.trim()
    if (!value) return

    let signInEmail = value
    let usernameNotFound = false

    if (!value.includes('@')) {
      const hint = await fetchLoginHint(value)

      if (hint?.exists && hint.uses_email) {
        setErrorMessage(
          'That account signs in with its email address. Enter the email you signed up with.'
        )
        return
      }

      usernameNotFound = hint ? !hint.exists : false
      signInEmail = ghostEmailFor(value)
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password,
    })

    if (!error) return

    const isInvalidLogin = error.message.toLowerCase().includes('invalid login')

    if (isInvalidLogin && usernameNotFound) {
      setShowCreatePrompt(true)
    } else if (isInvalidLogin) {
      setErrorMessage(
        value.includes('@') ? 'Wrong email or password.' : 'Wrong username or password.'
      )
    } else {
      setErrorMessage(error.message)
    }
  }

  const handleSignUp = async () => {
    const cleanUsername = username.trim()
    const cleanEmail = email.trim()

    if (!cleanUsername || !displayName.trim() || !cleanEmail || !password) {
      setErrorMessage('Please fill out every field.')
      return
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Enter a valid email address so you can recover your account.')
      return
    }

    // Real check this time: a SECURITY DEFINER function, because profiles is
    // hidden from signed-out visitors by row-level security.
    const { data: available, error: checkError } = await supabase.rpc('username_available', {
      candidate: cleanUsername,
    })

    if (!checkError && available === false) {
      setErrorMessage('That username is already taken. Try another one.')
      return
    }

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { username: cleanUsername, display_name: displayName.trim() } },
    })

    if (error) {
      const message = error.message.toLowerCase()
      if (message.includes('already registered') || message.includes('already been registered')) {
        setErrorMessage('An account already uses that email. Try signing in instead.')
      } else if (message.includes('duplicate') || message.includes('unique')) {
        setErrorMessage('That username is already taken. Try another one.')
      } else {
        setErrorMessage(error.message)
      }
    }
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
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                onSubmit={handleAuth}
              />
              {errorMessage && <ErrorNote message={errorMessage} />}
              <motion.div variants={itemVariants} style={{ marginTop: '24px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => { setIsSignUp(false); setDisplayName(''); setErrorMessage('') }}
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
                identifier={identifier}
                setIdentifier={setIdentifier}
                password={password}
                setPassword={setPassword}
                onSubmit={handleAuth}
              />
              {errorMessage && <ErrorNote message={errorMessage} />}
              <motion.div variants={itemVariants} style={{ marginTop: '24px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => { setIsSignUp(true); setErrorMessage('') }}
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
                    setUsername(identifier.trim())
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

function ErrorNote({ message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginTop: '14px',
        padding: '10px 12px',
        borderRadius: '12px',
        background: 'rgba(225, 29, 72, 0.12)',
        border: '1px solid rgba(225, 29, 72, 0.35)',
        color: '#fda4af',
        fontSize: '0.85rem',
        lineHeight: 1.4,
        textAlign: 'center',
      }}
    >
      {message}
    </motion.div>
  )
}

const fieldWrapStyle = { display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }
const labelStyle = { color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', marginLeft: '4px' }
const inputStyle = { width: '100%', padding: '12px 12px 12px 44px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none' }
const iconStyle = { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }
const submitStyle = { marginTop: '8px', background: 'var(--theme-primary)', color: 'white', padding: '14px', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 4px 20px var(--theme-primary-shadow)', border: 'none', cursor: 'pointer' }

function SignInForm({ itemVariants, loading, identifier, setIdentifier, password, setPassword, onSubmit }) {
    const [showPassword, setShowPassword] = useState(false)
    return (
      <form
        onSubmit={onSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <motion.div variants={itemVariants} style={fieldWrapStyle}>
          <span className="text-sm" style={labelStyle}>USERNAME OR EMAIL</span>
          <div style={{ position: 'relative' }}>
            <User size={18} style={iconStyle} />
            <input type="text" placeholder="Username or email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoCapitalize="none" autoCorrect="off" required style={inputStyle} />
          </div>
        </motion.div>

        <motion.div variants={itemVariants} style={fieldWrapStyle}>
          <span className="text-sm" style={labelStyle}>PASSWORD</span>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={iconStyle} />
            <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ ...inputStyle, paddingRight: '44px' }} />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </motion.div>

        <motion.button variants={itemVariants} type="submit" disabled={loading} style={submitStyle}>
          {loading ? 'Processing...' : <>Sign In <ArrowRight size={20} /></>}
        </motion.button>
      </form>
    )
  }

  function SignUpForm({ itemVariants, loading, username, setUsername, displayName, setDisplayName, email, setEmail, password, setPassword, onSubmit }) {
    const [showPassword, setShowPassword] = useState(false)
    return (
      <form
        onSubmit={onSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <motion.div variants={itemVariants} style={fieldWrapStyle}>
          <span className="text-sm" style={labelStyle}>USERNAME</span>
          <div style={{ position: 'relative' }}>
            <User size={18} style={iconStyle} />
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" required style={inputStyle} />
          </div>
        </motion.div>

        <motion.div variants={itemVariants} style={fieldWrapStyle}>
          <span className="text-sm" style={labelStyle}>DISPLAY NAME</span>
          <div style={{ position: 'relative' }}>
            <User size={18} style={iconStyle} />
            <input type="text" placeholder="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required style={inputStyle} />
          </div>
        </motion.div>

        <motion.div variants={itemVariants} style={fieldWrapStyle}>
          <span className="text-sm" style={labelStyle}>EMAIL</span>
          <div style={{ position: 'relative' }}>
            <Mail size={18} style={iconStyle} />
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" autoCorrect="off" required style={inputStyle} />
          </div>
        </motion.div>

        <motion.div variants={itemVariants} style={fieldWrapStyle}>
          <span className="text-sm" style={labelStyle}>PASSWORD</span>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={iconStyle} />
            <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ ...inputStyle, paddingRight: '44px' }} />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </motion.div>

        <motion.button variants={itemVariants} type="submit" disabled={loading} style={submitStyle}>
          {loading ? 'Processing...' : <>Create Account <ArrowRight size={20} /></>}
        </motion.button>
      </form>
    )
  }

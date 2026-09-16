import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ShieldCheck, X } from 'lucide-react'
import { supabase } from './supabaseClient'

// Legacy accounts were created with a fabricated address built from the
// username, so there's no way to recover them if the password is forgotten.
// Prompt those users (once per browser session) to attach a real email.
const GHOST_EMAIL_DOMAIN = '@movienight.com'
const DISMISS_KEY = 'flickpick:recovery-email-dismissed'

export default function RecoveryEmailPrompt({ session }) {
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState('')

  const currentEmail = session?.user?.email || ''
  const needsRealEmail = currentEmail.toLowerCase().endsWith(GHOST_EMAIL_DOMAIN)

  useEffect(() => {
    if (!needsRealEmail) {
      setVisible(false)
      return
    }
    if (sessionStorage.getItem(DISMISS_KEY)) return

    // Don't interrupt someone following an invite link — the app prompt owns
    // that moment. They'll be asked once they reach the dashboard.
    if (/^\/(room|join)\//.test(window.location.pathname)) return

    // Give the dashboard a moment to paint before interrupting.
    const timer = setTimeout(() => setVisible(true), 900)
    return () => clearTimeout(timer)
  }, [needsRealEmail])

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  const save = async (event) => {
    event.preventDefault()
    const value = email.trim()

    if (!value.includes('@') || !value.includes('.')) {
      setError('Enter a valid email address.')
      return
    }
    if (value.toLowerCase().endsWith(GHOST_EMAIL_DOMAIN)) {
      setError('Use a real email address you can receive mail at.')
      return
    }

    setSaving(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser(
      { email: value },
      { emailRedirectTo: window.location.origin }
    )

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSentTo(value)
  }

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.78)',
          backdropFilter: 'blur(6px)',
          padding: '18px',
        }}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0 }}
          style={{
            width: '100%',
            maxWidth: '430px',
            background: 'linear-gradient(160deg, #1a1a2e 0%, #0f172a 60%, #020617 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '26px',
            padding: '24px',
            position: 'relative',
            boxShadow: '0 24px 70px rgba(0,0,0,0.6)',
          }}
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: '999px',
              width: '32px',
              height: '32px',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>

          {sentTo ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <ShieldCheck size={22} style={{ color: '#34d399' }} />
                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>Check your inbox</div>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 18px 0' }}>
                We sent a confirmation link to <strong style={{ color: 'white' }}>{sentTo}</strong>.
                Click it to finish adding your email. Until then you can keep signing in with your
                username — nothing changes.
              </p>
              <button
                type="button"
                onClick={dismiss}
                style={{
                  width: '100%',
                  background: 'var(--theme-primary, #e11d48)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '13px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Got it
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Mail size={22} style={{ color: '#fbbf24' }} />
                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>Protect your account</div>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                Your account doesn’t have a real email yet, so there’s no way to recover it if you
                forget your password. Add one now — you’ll still be able to sign in with your
                username.
              </p>

              <form onSubmit={save}>
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                  <Mail
                    size={18}
                    style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 44px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '1rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {error && (
                  <div style={{ color: '#fda4af', fontSize: '0.85rem', marginBottom: '10px' }}>{error}</div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    width: '100%',
                    background: 'var(--theme-primary, #e11d48)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '13px',
                    fontSize: '1rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 6px 24px rgba(225, 29, 72, 0.3)',
                  }}
                >
                  {saving ? 'Sending...' : 'Add Email'}
                </button>
              </form>

              <button
                type="button"
                onClick={dismiss}
                style={{
                  width: '100%',
                  marginTop: '10px',
                  background: 'transparent',
                  color: '#94a3b8',
                  border: 'none',
                  padding: '10px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Maybe later
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Smartphone, Globe, Download, X } from 'lucide-react'

// Set this once FlickPick is live on the App Store, e.g.
// 'https://apps.apple.com/app/id1234567890'. While it's empty the prompt
// still offers to open the app for people who already have it, and simply
// keeps everyone else in the browser.
const APP_STORE_URL = ''

const DISMISS_KEY = 'flickpick:link-prompt-dismissed'

function isAppleMobile() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isIOS = /iPhone|iPod|iPad/.test(ua)
  // iPadOS reports itself as a Mac, so check for touch support too.
  const isIPadOS = /Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document
  return isIOS || isIPadOS
}

// Turns the current web URL into the matching in-app destination.
// /room/55 -> flickpick://room/55
// /join/ab12cd -> flickpick://join/ab12cd   (?eventId=55 jumps to the room)
function appURLForPath(pathname, search) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length < 2) return null

  const [section, value] = parts
  if (section === 'room' && value) return `flickpick://room/${value}`

  if (section === 'join' && value) {
    const eventId = new URLSearchParams(search).get('eventId')
    return eventId ? `flickpick://room/${eventId}` : `flickpick://join/${value}`
  }

  return null
}

function describe(pathname) {
  return pathname.startsWith('/join/') ? 'this crew invite' : 'this movie night'
}

export default function AppLinkPrompt() {
  const [visible, setVisible] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [target, setTarget] = useState(null)

  useEffect(() => {
    if (!isAppleMobile()) return
    if (sessionStorage.getItem(DISMISS_KEY)) return

    const appURL = appURLForPath(window.location.pathname, window.location.search)
    if (!appURL) return

    setTarget(appURL)
    setVisible(true)
  }, [])

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  // Deliberately no "did it open?" timer: iOS puts up its own confirmation
  // dialog before switching apps, so any timing heuristic fires while that
  // dialog is still on screen and wrongly claims the app is missing. Offer
  // the alternatives instead and let the person choose.
  const openApp = () => {
    if (!target) return
    setAttempted(true)
    window.location.href = target
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
          zIndex: 3000,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          padding: '16px',
        }}
        onClick={dismiss}
      >
        <motion.div
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          onClick={(event) => event.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '420px',
            background: 'linear-gradient(160deg, #1a1a2e 0%, #0f172a 60%, #020617 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '28px',
            padding: '22px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            position: 'relative',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <img
              src="/flick-pick-logo.png"
              alt=""
              style={{ width: '44px', height: '44px', objectFit: 'contain' }}
              draggable="false"
            />
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.15 }}>
                <span style={{ color: '#e11d48' }}>Flick</span>
                <span style={{ color: '#6366f1' }}>Pick</span>
                <span style={{ color: 'white' }}> for iPhone</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '2px' }}>
                {attempted
                  ? 'Opening the app… Nothing happened? Grab it below or stay in your browser.'
                  : `Open ${describe(window.location.pathname)} in the app for the best experience.`}
              </div>
            </div>
          </div>

          {/* Both paths are offered explicitly: iOS gives no reliable way to
              detect whether an app is installed, so we let people choose
              instead of guessing wrong. */}
          {true && (
            <button
              type="button"
              onClick={openApp}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                background: 'var(--theme-primary, #e11d48)',
                color: 'white',
                border: 'none',
                borderRadius: '14px',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 6px 24px rgba(225, 29, 72, 0.35)',
              }}
            >
              <Smartphone size={18} /> {attempted ? 'Try opening again' : 'Open in the app'}
            </button>
          )}

          {APP_STORE_URL && (
            <a
              href={APP_STORE_URL}
              style={{
                width: '100%',
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                background: 'rgba(255,255,255,0.06)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '14px',
                padding: '13px',
                fontSize: '0.95rem',
                fontWeight: 700,
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
            >
              <Download size={18} /> Don’t have it? Get the app
            </a>
          )}

          <button
            type="button"
            onClick={dismiss}
            style={{
              width: '100%',
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              background: 'rgba(255,255,255,0.06)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '14px',
              padding: '13px',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Globe size={18} /> Continue in browser
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

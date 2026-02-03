import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import Dashboard from './Dashboard'
import JoinGroup from './JoinGroup'
import GroupView from './GroupView' 
import EventView from './EventView'
import ProfileView from './ProfileView'
import NominateView from './NominateView'
import VoteView from './VoteView'
import RevealView from './RevealView'
import LoadingSpinner from './LoadingSpinner'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fix for mobile "overscroll" showing white bars
    document.body.style.margin = '0'
    document.body.style.padding = '0'

    // Apply global background to body to prevent borders/overscroll issues
    document.body.classList.add(
      'bg-black', 
      'text-white', 
      'bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))]', 
      'from-slate-900', 'via-black', 'to-black', 
      'selection:bg-pink-500/30'
    )

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div 
      className="w-full flex flex-col min-h-[100dvh]"
    >
      {/* Global Scrollbar Styles */}
      <style>{`
        :root { color-scheme: dark; }
        /* Hide scrollbar globally but keep functionality */
        ::-webkit-scrollbar { display: none; }
        html, body, * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
      `}</style>

      {loading ? (
        <LoadingSpinner label="Loading..." />
      ) : !session ? (
        <Auth />
      ) : (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard session={session} />} />
            {/* The Magic Route */}
            <Route path="/join/:shareCode" element={<JoinGroup session={session} />} />
            {/* Future Route: Group Details */}
            {/* <Route path="/group/:groupId" element={<GroupView session={session} />} /> */}
            <Route path="/group/:groupId" element={<GroupView session={session} />} />
            <Route path="/room/:code" element={<EventView />} />
            <Route path="/room/:code/nominate" element={<NominateView />} />
            <Route path="/room/:code/vote" element={<VoteView />} />
            <Route path="/room/:code/reveal" element={<RevealView />} />
            <Route path="/profile" element={<ProfileView session={session} />} />
          </Routes>
        </BrowserRouter>
      )}
    </div>
  )
}

export default App

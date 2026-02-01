import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import Dashboard from './Dashboard'
import GroupView from './GroupView' 
import EventView from './EventView'
import ProfileView from './ProfileView'
import JoinGroup from './JoinGroup'
import NominateView from './NominateView' // New import
import VoteView from './VoteView'       // New import
import RevealView from './RevealView'     // New import

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

  if (loading) return <div className="loading-shell">
    <div className="loading-logo">
      <div className="loading-icon"></div>
    </div>
    <div className="loading-text">Loading...</div>
  </div>

  // If NOT logged in, we only show Auth. 
  // NOTE: If they clicked an Invite Link, the URL is still in the browser. 
  // Once they log in/sign up, the Router below takes over and handles the /join logic!
  if (!session) {
    return <Auth />
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen w-full bg-black text-white bg-[radial-gradient(circle_at_top,var(--tw-gradient-stops))] from-slate-900 via-black to-black selection:bg-pink-500/30">
        <Routes>
          <Route path="/" element={<Dashboard session={session} />} />
          <Route path="/join/:shareCode" element={<JoinGroup session={session} />} />
          <Route path="/group/:groupId" element={<GroupView session={session} />} />
          <Route path="/room/:code" element={<EventView />} />
          <Route path="/room/:code/nominate" element={<NominateView />} /> {/* New route */}
          <Route path="/room/:code/vote" element={<VoteView />} />       {/* New route */}
          <Route path="/room/:code/reveal" element={<RevealView />} />     {/* New route */}
          <Route path="/profile" element={<ProfileView session={session} />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App

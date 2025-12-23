import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import Dashboard from './Dashboard'
import JoinGroup from './JoinGroup'
// import GroupView from './GroupView' // We will build this next!

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

  if (loading) return <div style={{padding: '20px'}}>Loading...</div>

  // If NOT logged in, we only show Auth. 
  // NOTE: If they clicked an Invite Link, the URL is still in the browser. 
  // Once they log in/sign up, the Router below takes over and handles the /join logic!
  if (!session) {
    return <Auth />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard session={session} />} />
        {/* The Magic Route */}
        <Route path="/join/:shareCode" element={<JoinGroup session={session} />} />
        {/* Future Route: Group Details */}
        {/* <Route path="/group/:groupId" element={<GroupView session={session} />} /> */}
      </Routes>
    </BrowserRouter>
  )
}

export default App
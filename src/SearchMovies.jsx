import { useState, useEffect } from 'react'
import { motion } from 'framer-motion' 
import { X, Search, Filter, Book, Ticket, Users } from 'lucide-react' 
import { supabase } from './supabaseClient'

const GENRES = ['Action', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Thriller', 'Family']

export default function SearchMovies({ eventId, groupId, onClose, onNominate, customAction }) {
  const isEventMode = !!eventId
  const [activeTab, setActiveTab] = useState('search') 
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  
  // Lists
  const [myWatchlist, setMyWatchlist] = useState([])
  const [crewWatchlist, setCrewWatchlist] = useState([])
  
  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [minScore, setMinScore] = useState(70)
  const [useScoreFilter, setUseScoreFilter] = useState(false)
  const [genreFilter, setGenreFilter] = useState('')

  // Write In
  const [isWritingIn, setIsWritingIn] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newGenre, setNewGenre] = useState(GENRES[0])
  const [newScore, setNewScore] = useState('')

  useEffect(() => {
    if (activeTab === 'search' && !isWritingIn) {
        const delayDebounceFn = setTimeout(() => searchMovies(), 300)
        return () => clearTimeout(delayDebounceFn)
    }
    if (activeTab === 'watchlist') fetchMyWatchlist()
    if (activeTab === 'crew') fetchCrewWatchlists()
  }, [searchTerm, activeTab, genreFilter, minScore, useScoreFilter, isWritingIn])

  // 1. GLOBAL SEARCH
  async function searchMovies() {
    let query = supabase.from('movies').select().limit(20)
    if (searchTerm) query = query.ilike('title', `%${searchTerm}%`)
    const { data } = await query
    setResults(applyFilters(data || []))
  }

  // 2. MY WATCHLIST
  async function fetchMyWatchlist() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('user_wishlist').select('movie:movies (*)').eq('user_id', user.id)
    setMyWatchlist(applyFilters(data ? data.map(i => i.movie) : []))
  }

  // 3. CREW WATCHLISTS (New!)
  async function fetchCrewWatchlists() {
    if (!groupId) return
    const { data: { user } } = await supabase.auth.getUser()
    
    // Get all group members EXCEPT me
    const { data: members } = await supabase.from('group_members').select('user_id').eq('group_id', groupId).neq('user_id', user.id)
    const memberIds = members.map(m => m.user_id)

    if (memberIds.length === 0) return setCrewWatchlist([])

    // Get their watchlists
    const { data } = await supabase.from('user_wishlist').select('movie:movies (*)').in('user_id', memberIds)
    
    // Remove duplicates (if multiple friends want the same movie)
    const uniqueMovies = []
    const seenIds = new Set()
    data?.forEach(item => {
        if (!seenIds.has(item.movie.id)) {
            uniqueMovies.push(item.movie)
            seenIds.add(item.movie.id)
        }
    })
    
    setCrewWatchlist(applyFilters(uniqueMovies))
  }

  // Helper: Apply Genre & Score Filters locally
  function applyFilters(list) {
    return list.filter(m => {
        const score = m.rt_score === null ? 100 : m.rt_score // Treat null as 100
        const scorePass = !useScoreFilter || score >= minScore
        const genrePass = !genreFilter || (m.genre && m.genre.includes(genreFilter))
        const searchPass = !searchTerm || m.title.toLowerCase().includes(searchTerm.toLowerCase())
        return scorePass && genrePass && searchPass
    })
  }

  async function handleWriteIn(isTheater = false) {
    const titleToUse = isTheater ? (newTitle || "Movie Theater Trip") : newTitle
    if (!titleToUse) return alert("Title required!")

    const { data: movie } = await supabase.from('movies').insert([{ 
        title: titleToUse, 
        description: isTheater ? 'Trip to the cinema' : 'User Write-in', 
        genre: isTheater ? ['Theater'] : [newGenre], 
        rt_score: newScore ? parseInt(newScore) : null 
      }]).select().single()

    if (movie) handleSelect(movie, isTheater)
  }

  const handleSelect = (movie, isTheater = false) => {
    if (customAction) customAction(movie)
    else onNominate(movie, isTheater) 
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} style={{ width: '100%', maxWidth: '500px', height: '85vh', background: '#1a1a2e', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 40px rgba(0,0,0,0.5)' }}>
        
        <div className="flex-between" style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>{isEventMode ? 'Nominate' : 'Add to Watchlist'}</h2>
          <button onClick={onClose} style={{ background: '#333', padding: '8px', borderRadius: '50%', color: 'white' }}><X size={20} /></button>
        </div>

        {/* TABS */}
        {isEventMode && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '5px' }}>
              <TabButton active={activeTab === 'search'} onClick={() => {setActiveTab('search'); setIsWritingIn(false)}}><Search size={16}/> Search</TabButton>
              <TabButton active={activeTab === 'watchlist'} onClick={() => setActiveTab('watchlist')}><Book size={16}/> Mine</TabButton>
              <TabButton active={activeTab === 'crew'} onClick={() => setActiveTab('crew')}><Users size={16}/> Crew</TabButton>
              <TabButton active={activeTab === 'theater'} onClick={() => setActiveTab('theater')}><Ticket size={16}/> Out</TabButton>
          </div>
        )}

        {!isEventMode && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <button
              onClick={() => { setActiveTab('search'); setIsWritingIn(false) }}
              style={{ flex: 1, padding: '10px', borderRadius: '12px', background: !isWritingIn ? '#00E5FF' : 'rgba(255,255,255,0.1)', color: !isWritingIn ? 'black' : 'white', fontWeight: 700 }}
            >
              Search Database
            </button>
            <button
              onClick={() => setIsWritingIn(true)}
              style={{ flex: 1, padding: '10px', borderRadius: '12px', background: isWritingIn ? '#00E5FF' : 'rgba(255,255,255,0.1)', color: isWritingIn ? 'black' : 'white', fontWeight: 700 }}
            >
              Write In
            </button>
          </div>
        )}

        {/* FILTERS (Shared across lists) */}
        {activeTab !== 'theater' && !isWritingIn && (
            <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                <div className="flex-between" onClick={() => setShowFilters(!showFilters)}>
                    <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                        <Search size={16} color="#888"/>
                        <input placeholder="Search list..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{background:'transparent', border:'none', padding:0, height:'auto'}}/>
                    </div>
                    <Filter size={16} color={showFilters ? '#00E5FF' : '#666'} />
                </div>
                {showFilters && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #333' }}>
                         <div className="flex-gap" style={{marginBottom:'10px'}}>
                            <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} style={{padding:'8px', fontSize:'0.8rem'}}>
                                <option value="">All Genres</option>
                                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                         </div>
                         <div className="flex-between">
                            <span className="text-sm">Min Score {minScore}%</span>
                            <input type="checkbox" checked={useScoreFilter} onChange={(e) => setUseScoreFilter(e.target.checked)} />
                         </div>
                         {useScoreFilter && <input type="range" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />}
                    </div>
                )}
            </div>
        )}

        {/* LIST RENDERING */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'search' && !isWritingIn && results.map(m => <MovieRow key={m.id} movie={m} onSelect={() => handleSelect(m)} />)}
            {activeTab === 'watchlist' && myWatchlist.map(m => <MovieRow key={m.id} movie={m} onSelect={() => handleSelect(m)} />)}
            {activeTab === 'crew' && crewWatchlist.map(m => <MovieRow key={m.id} movie={m} onSelect={() => handleSelect(m)} />)}
            
            {/* Empty States */}
            {activeTab === 'search' && !isWritingIn && isEventMode && (
              <div style={{ padding:'20px', textAlign:'center' }}>
                <button onClick={() => setIsWritingIn(true)} style={{ background:'#00E5FF', color:'black', padding:'10px 20px', borderRadius:'20px', fontWeight: 700 }}>
                  + Write In Movie
                </button>
              </div>
            )}
            {activeTab === 'crew' && crewWatchlist.length === 0 && <p className="text-sm" style={{textAlign:'center'}}>Your friends have empty watchlists.</p>}
            
            {/* Write In Form */}
            {isWritingIn && (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input placeholder="Title" value={newTitle || searchTerm} onChange={(e) => setNewTitle(e.target.value)} />
                    <div className="flex-gap">
                        <select value={newGenre} onChange={(e) => setNewGenre(e.target.value)} style={{flex: 1}}>{GENRES.map(g => <option key={g} value={g}>{g}</option>)}</select>
                        <input type="number" placeholder="RT Score" value={newScore} onChange={(e) => setNewScore(e.target.value)} style={{flex: 1}} />
                    </div>
                    <button onClick={() => handleWriteIn(false)} style={{ background: '#00E5FF', color: 'black', padding: '15px', borderRadius: '12px' }}>Save & Select</button>
                    <button onClick={() => setIsWritingIn(false)} className="text-sm" style={{background:'none'}}>Cancel</button>
                 </div>
            )}

            {/* Theater Form */}
            {activeTab === 'theater' && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <Ticket size={48} color="gold" style={{marginBottom:'10px'}}/>
                    <h3 style={{color:'gold'}}>Let's Go Out</h3>
                    <input placeholder="Specific Movie (Optional)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{marginTop:'20px'}} />
                    <button onClick={() => handleWriteIn(true)} style={{ background: 'gold', color: 'black', width: '100%', padding: '15px', borderRadius: '12px', marginTop: '15px' }}>Nominate Trip</button>
                </div>
            )}
        </div>
      </motion.div>
    </div>
  )
}

function TabButton({ active, children, onClick }) {
    return <button onClick={onClick} style={{ padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', background: active ? 'white' : 'rgba(255,255,255,0.1)', color: active ? 'black' : 'white', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>{children}</button>
}

function MovieRow({ movie, onSelect }) {
    return <div onClick={onSelect} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', marginBottom: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', cursor: 'pointer' }}><div><div style={{ fontWeight: '600' }}>{movie.title}</div><div className="text-sm">{movie.genre?.join(', ')}</div></div>{movie.rt_score && <span className="tag">🍅 {movie.rt_score}%</span>}</div>
}

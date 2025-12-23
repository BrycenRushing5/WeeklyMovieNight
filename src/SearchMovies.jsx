import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function SearchMovies({ sessionId, onClose, onNominate }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  // Hardcoded genres for the dropdown (matches your Master List data)
  const genres = ['Action', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Thriller', 'Family']

  useEffect(() => {
    // Debounce search slightly to avoid too many DB calls
    const delayDebounceFn = setTimeout(() => {
      searchMovies()
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm, selectedGenre, minScore])

  async function searchMovies() {
    setLoading(true)
    
    // 1. Base Query
    let query = supabase
      .from('movies')
      .select()
      .gte('rt_score', minScore) // Filter by Score (Greater Than or Equal)

    // 2. Add Title Filter if typed
    if (searchTerm) {
      query = query.ilike('title', `%${searchTerm}%`)
    }

    // 3. Add Genre Filter if selected
    if (selectedGenre) {
      // "contains" checks if the array in the DB includes the selected genre
      query = query.contains('genre', [selectedGenre]) 
    }

    const { data, error } = await query
    
    if (error) console.error('Search error:', error)
    else setResults(data || [])
    
    setLoading(false)
  }

  const handleNominate = async (movie) => {
    const userName = localStorage.getItem('movie_user_name')

    // Add to nominations table
    const { error } = await supabase
      .from('nominations')
      .insert([
        { session_id: sessionId, movie_id: movie.id, nominated_by: userName }
      ])

    if (error) {
      alert('Error: This movie might already be nominated!')
    } else {
      // Trigger update in parent and close search
      onNominate()
      onClose()
    }
  }

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, padding: '20px', overflowY: 'auto'
    }}>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', maxWidth: '500px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Add a Movie</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '20px' }}>✖️</button>
        </div>

        {/* FILTERS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <input 
            placeholder="Search titles..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '10px', fontSize: '16px' }}
          />

          <div style={{ display: 'flex', gap: '10px' }}>
            <select 
              value={selectedGenre} 
              onChange={(e) => setSelectedGenre(e.target.value)}
              style={{ flex: 1, padding: '10px' }}
            >
              <option value="">All Genres</option>
              {genres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem' }}>
              <label>Min Score: {minScore}%</label>
              <input 
                type="range" min="0" max="100" 
                value={minScore} 
                onChange={(e) => setMinScore(Number(e.target.value))} 
              />
            </div>
          </div>
        </div>

        {/* RESULTS LIST */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {loading ? <p>Searching...</p> : results.map(movie => (
            <div key={movie.id} style={{ borderBottom: '1px solid #eee', padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{movie.title}</strong>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                  {movie.genre.join(', ')} • 🍅 {movie.rt_score}%
                </div>
              </div>
              <button 
                onClick={() => handleNominate(movie)}
                style={{ padding: '5px 10px', background: '#4da6ff', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                Add
              </button>
            </div>
          ))}
          {results.length === 0 && !loading && <p style={{textAlign: 'center', color: '#888'}}>No movies found.</p>}
        </div>

      </div>
    </div>
  )
}
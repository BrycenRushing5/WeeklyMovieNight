import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './Login'
import MovieRoom from './MovieRoom'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/room/:code" element={<MovieRoom />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
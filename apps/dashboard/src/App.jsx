import { useState, useEffect } from 'react'

function App() {
  const [status, setStatus] = useState('connecting...')

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setStatus(data.status))
      .catch(() => setStatus('disconnected'))
  }, [])

  return (
    <div className="min-h-screen bg-canvas-cream flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-medium text-ink-black mb-4">
          Phantom
        </h1>
        <p className="text-xl text-slate-600 mb-8">
          Ambient spatial memory for everyday life
        </p>
        <div className="inline-block px-6 py-2 bg-ink-black text-canvas-cream rounded-pill">
          Status: {status}
        </div>
      </div>
    </div>
  )
}

export default App

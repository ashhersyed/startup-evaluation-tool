import { Router, Route } from 'wouter'
import { Toaster } from 'sonner'
import Home from './pages/Home'
import Results from './pages/Results'

function App() {
  return (
    <>
      <Toaster position="top-center" theme="dark" />
      <Router>
        <Route path="/" component={Home} />
        <Route path="/results" component={Results} />
      </Router>
    </>
  )
}

export default App

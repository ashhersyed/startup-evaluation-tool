import { Router, Route } from 'wouter'
import Home from './pages/Home'
import Scorer from './pages/Scorer'

function App() {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/scorer" component={Scorer} />
    </Router>
  )
}

export default App

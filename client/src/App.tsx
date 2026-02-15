import { Router, Route } from 'wouter'
import { Toaster } from 'sonner'
import Home from './pages/Home'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import Recommendations from './pages/Recommendations'

function App() {
  return (
    <>
      <Toaster position="top-center" theme="dark" />
      <Router>
        <Route path="/" component={Home} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/jobs/:id" component={JobDetail} />
        <Route path="/recommendations" component={Recommendations} />
      </Router>
    </>
  )
}

export default App

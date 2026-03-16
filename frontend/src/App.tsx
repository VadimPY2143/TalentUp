import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AuthProvider } from "./auth/AuthContext"
import Home from "./pages/Home"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import CandidateSearch from "./pages/CandidateSearch"
import ProtectedRoute from "./routes/ProtectedRoute"
import Footer from "./components/layout/Footer"

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/candidates" element={<CandidateSearch />} />
              </Route>
            </Routes>
          </div>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

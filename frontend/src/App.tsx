import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AuthProvider } from "./auth/AuthContext"
import Home from "./pages/Home"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import CandidateSearch from "./pages/CandidateSearch"
import JobSearch from "./pages/JobSearch"
import JobSearchNew from "./pages/JobSearchNew"
import Messages from "./pages/Messages"
import Analytics from "./pages/Analytics"
import OAuthCallback from "./pages/OAuthCallback"
import CompanyProfile from "./pages/CompanyProfile"
import PaymentTest from "./pages/PaymentTest"
import ProtectedRoute from "./routes/ProtectedRoute"
import RoleRoute from "./routes/RoleRoute"
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
              <Route path="/oauth/callback" element={<OAuthCallback />} />
              <Route path="/jobs" element={<JobSearchNew />} />
              <Route path="/companies/:companyId" element={<CompanyProfile />} />
              <Route path="/payment" element={<PaymentTest />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/jobs-old" element={<JobSearch />} />
                <Route element={<RoleRoute allowed={["employer"]} />}>
                  <Route path="/candidates" element={<CandidateSearch />} />
                </Route>
                <Route element={<RoleRoute allowed={["worker"]} />}>
                  <Route path="/analytics" element={<Analytics />} />
                </Route>
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

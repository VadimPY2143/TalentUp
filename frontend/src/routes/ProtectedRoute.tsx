import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../auth/useAuth"

const ProtectedRoute = () => {
  const { isAuthenticated, isAuthReady } = useAuth()

  if (!isAuthReady) {
    return <div className="p-6 text-center text-sm text-slate-500">Завантаження...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute

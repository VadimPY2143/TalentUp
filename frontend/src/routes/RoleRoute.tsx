import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import type { UserRole } from "../types/auth"

type Props = {
  allowed: UserRole[]
  redirectTo?: string
}

const RoleRoute = ({ allowed, redirectTo = "/dashboard" }: Props) => {
  const { role } = useAuth()

  if (!role || !allowed.includes(role)) {
    return <Navigate to={redirectTo} replace />
  }

  return <Outlet />
}

export default RoleRoute


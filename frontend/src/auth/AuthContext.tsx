import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import { logoutUser, refreshSession } from "../api/auth"
import { clearAccessToken, setAccessToken } from "../api/client"
import type { UserRole } from "../types/auth"
import { decodeJwt } from "./jwt"

interface AuthContextValue {
  token: string | null
  isAuthReady: boolean
  isAuthenticated: boolean
  role: UserRole | null
  email: string | null
  login: (token: string) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [role, setRole] = useState<UserRole | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const data = await refreshSession()
        if (!cancelled) {
          setToken(data.access_token)
        }
      } catch {
        if (!cancelled) {
          setToken((prev) => prev)
        }
      } finally {
        if (!cancelled) {
          setIsAuthReady(true)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setAccessToken(token)
    if (token) {
      const payload = decodeJwt(token)
      setRole(payload?.role ?? null)
      setEmail(payload?.sub ?? null)
    } else {
      clearAccessToken()
      setRole(null)
      setEmail(null)
    }
  }, [token])

  const login = useCallback((nextToken: string) => {
    setAccessToken(nextToken)
    setToken(nextToken)
    setIsAuthReady(true)
  }, [])

  const logout = useCallback(() => {
    void logoutUser().catch(() => undefined)
    setToken(null)
    setIsAuthReady(true)
  }, [])

  const value = useMemo(
    () => ({
      token,
      isAuthReady,
      isAuthenticated: Boolean(token),
      role,
      email,
      login,
      logout,
    }),
    [token, isAuthReady, role, email, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import type { UserRole } from "../types/auth"
import { decodeJwt } from "./jwt"

interface AuthContextValue {
  token: string | null
  isAuthenticated: boolean
  role: UserRole | null
  login: (token: string) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const TOKEN_KEY = "accessToken"

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY)
  })
  const [role, setRole] = useState<UserRole | null>(null)

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      const payload = decodeJwt(token)
      setRole(payload?.role ?? null)
    } else {
      localStorage.removeItem(TOKEN_KEY)
      setRole(null)
    }
  }, [token])

  const login = useCallback((nextToken: string) => {
    setToken(nextToken)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
  }, [])

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      role,
      login,
      logout,
    }),
    [token, role, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

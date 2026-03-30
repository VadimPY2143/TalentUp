import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import type { UserRole } from "../types/auth"
import { decodeJwt } from "./jwt"

interface AuthContextValue {
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  role: UserRole | null
  email: string | null
  login: (token: string, refreshToken: string) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const ACCESS_TOKEN_KEY = "accessToken"
const REFRESH_TOKEN_KEY = "refreshToken"

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  })
  const [refreshToken, setRefreshToken] = useState<string | null>(() => {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  })
  const [role, setRole] = useState<UserRole | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token)
      const payload = decodeJwt(token)
      setRole(payload?.role ?? null)
      setEmail(payload?.sub ?? null)
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      setRole(null)
      setEmail(null)
    }
  }, [token])

  useEffect(() => {
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY)
    }
  }, [refreshToken])

  const login = useCallback((nextToken: string, nextRefreshToken: string) => {
    setToken(nextToken)
    setRefreshToken(nextRefreshToken)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setRefreshToken(null)
  }, [])

  const value = useMemo(
    () => ({
      token,
      refreshToken,
      isAuthenticated: Boolean(token),
      role,
      email,
      login,
      logout,
    }),
    [token, refreshToken, role, email, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

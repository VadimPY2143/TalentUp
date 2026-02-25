import type { UserRole } from "../types/auth"

interface JwtPayload {
  sub?: string
  role?: UserRole
  exp?: number
}

const decodeBase64Url = (value: string) => {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=")
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/")
  return atob(base64)
}

export const decodeJwt = (token: string): JwtPayload | null => {
  try {
    const [, payload] = token.split(".")
    if (!payload) {
      return null
    }
    const decoded = decodeBase64Url(payload)
    return JSON.parse(decoded) as JwtPayload
  } catch {
    return null
  }
}

export type UserRole = "worker" | "employer"

export interface RegisterPayload {
  username: string
  email: string
  password: string
  role: UserRole
}

export interface UserResponse {
  username: string
  email: string
  role: UserRole
}

export interface LoginPayload {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: "bearer"
}

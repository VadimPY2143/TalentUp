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

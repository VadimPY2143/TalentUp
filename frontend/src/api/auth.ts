import { apiFetch } from "./client"
import type { RegisterPayload, UserResponse, LoginPayload, TokenResponse } from "../types/auth"

export const registerUser = (payload: RegisterPayload) => {
  return apiFetch<UserResponse>("/user/register", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export const loginUser = (payload: LoginPayload) => {
  return apiFetch<TokenResponse>("/user/login", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export const refreshTokens = (refreshToken: string) => {
  return apiFetch<TokenResponse>("/user/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
}

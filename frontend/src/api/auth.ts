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

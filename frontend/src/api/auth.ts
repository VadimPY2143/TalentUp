import { apiFetch, refreshAccessTokenViaCookie } from "./client"
import type {
  ChangePasswordPayload,
  RegisterPayload,
  UserResponse,
  LoginPayload,
  TokenResponse,
} from "../types/auth"

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

export const changePassword = (payload: ChangePasswordPayload) => {
  return apiFetch<TokenResponse>("/user/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export const refreshSession = () => {
  return refreshAccessTokenViaCookie().then((accessToken) => ({
    access_token: accessToken,
    token_type: "bearer" as const,
  }))
}

export const logoutUser = () => {
  return apiFetch<void>("/user/logout", {
    method: "POST",
  })
}

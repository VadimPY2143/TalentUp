import { apiFetch } from "./client"
import type { RegisterPayload, UserResponse } from "../types/auth"

export const registerUser = (payload: RegisterPayload) => {
  return apiFetch<UserResponse>("/user/register", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

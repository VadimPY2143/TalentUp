import { apiFetch } from "./client"
import type { LanguageOption, UserProfile, UserProfilePayload } from "../types/profile"

export const getUserProfile = () => {
  return apiFetch<UserProfile>("/user/profile")
}

export const upsertUserProfile = (payload: UserProfilePayload) => {
  return apiFetch<UserProfile>("/user/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export const searchLanguages = (query = "", limit = 12) => {
  const params = new URLSearchParams()
  if (query.trim()) {
    params.set("query", query.trim())
  }
  params.set("limit", String(limit))

  return apiFetch<LanguageOption[]>(`/languages?${params.toString()}`)
}

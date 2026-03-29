import { apiFetch } from "./client"

export interface UserProfile {
  id: number
  user_id: number
  city: string | null
  education: string | null
  bio: string | null
  birth_date: string | null
  phone: string | null
  languages: string[] | null
  links: string[] | null
  created_at: string
  updated_at: string
}

export interface UserProfileCreate {
  city?: string
  education?: string
  bio?: string
  birth_date?: string
  phone?: string
  languages?: string[]
  links?: string[]
}

export interface UserProfileUpdate {
  city?: string | null
  education?: string | null
  bio?: string | null
  birth_date?: string | null
  phone?: string | null
  languages?: string[] | null
  links?: string[] | null
}

export const getUserProfile = async (): Promise<UserProfile> => {
  return apiFetch<UserProfile>("/user/profile")
}

export const createUserProfile = async (payload: UserProfileCreate): Promise<UserProfile> => {
  return apiFetch<UserProfile>("/user/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export const updateUserProfile = async (payload: UserProfileUpdate): Promise<UserProfile> => {
  return apiFetch<UserProfile>("/user/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export const patchUserProfile = async (payload: UserProfileUpdate): Promise<UserProfile> => {
  return apiFetch<UserProfile>("/user/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export interface UserInfo {
  username: string
  email: string
  role: "worker" | "employer"
}

export const getCurrentUser = async (): Promise<UserInfo> => {
  return apiFetch<UserInfo>("/users/me")
}

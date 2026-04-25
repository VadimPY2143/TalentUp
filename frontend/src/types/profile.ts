export interface LanguageOption {
  id: number
  name: string
}

export interface UserProfilePayload {
  city?: string | null
  education?: string | null
  bio?: string | null
  birth_date?: string | null
  phone?: string | null
  languages?: string[]
  links?: string[]
}

export interface UserProfile extends UserProfilePayload {
  id: number
  user_id: number
  created_at: string
  updated_at: string
}

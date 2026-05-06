export interface LanguageOption {
  id: number
  name: string
}

export interface UserLanguage {
  id: number
  language_id: number
  language_name: string
  proficiency_level: string
}

export interface UserLink {
  id: number
  title: string
  url: string
}

export interface UserProfilePayload {
  city?: string | null
  education?: string | null
  bio?: string | null
  birth_date?: string | null
  phone?: string | null
  languages?: string[]
  links?: string[]
  user_languages?: Array<{ name: string; proficiency_level: string }>
  user_links?: Array<{ title: string; url: string }>
}

export interface UserProfile {
  id: number
  user_id: number
  city?: string | null
  education?: string | null
  bio?: string | null
  birth_date?: string | null
  phone?: string | null
  languages?: string[] | null
  links?: string[] | null
  created_at: string
  updated_at: string
  user_languages?: UserLanguage[]
  user_links?: UserLink[]
}

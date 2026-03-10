export interface CompanyPayload {
  name: string
  legal_name?: string
  description?: string
  industry?: string
  company_size?: string
  website?: string
  email?: string
  phone?: string
  country?: string
  city?: string
  address?: string
  founded_year?: number
  logo_url?: string
}

export interface CompanyUpdatePayload {
  name?: string
  legal_name?: string
  description?: string
  industry?: string
  company_size?: string
  website?: string
  email?: string
  phone?: string
  country?: string
  city?: string
  address?: string
  founded_year?: number
  logo_url?: string
}

export interface CompanyResponse {
  id: number
  user_id: number
  name: string
  legal_name?: string | null
  description?: string | null
  industry?: string | null
  company_size?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  country?: string | null
  city?: string | null
  address?: string | null
  founded_year?: number | null
  logo_url?: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

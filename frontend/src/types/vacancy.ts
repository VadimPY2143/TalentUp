export interface VacancyPayload {
  title: string
  description: string
  responsibilities?: string
  requirements?: string
  is_active?: boolean
  employment_type?: string[]
  location?: string
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  experience_years_min?: number
  experience_years_max?: number
  work_format?: string[]
  expires_at?: string
}

export interface VacancyAIFillPayload {
  description: string
}

export interface VacancyUpdatePayload {
  title?: string
  description?: string
  responsibilities?: string
  requirements?: string
  is_active?: boolean
  employment_type?: string[]
  location?: string
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  experience_years_min?: number
  experience_years_max?: number
  work_format?: string[]
  expires_at?: string
}

export interface VacancyResponse {
  id: number
  company_id: number
  created_by_user_id: number
  title: string
  description: string
  responsibilities?: string | null
  requirements?: string | null
  is_active: boolean
  employment_type?: string[] | null
  location?: string | null
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string | null
  experience_years_min?: number | null
  experience_years_max?: number | null
  work_format?: string[] | null
  expires_at?: string | null
  created_at: string
  updated_at: string
}

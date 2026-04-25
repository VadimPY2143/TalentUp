export type VacancySubscriptionEmploymentKind =
  | "Full-time"
  | "Part-time"
  | "Contract"
  | "Internship"
  | "Temporary"

export type VacancySubscriptionWorkFormat = "Remote" | "Hybrid" | "Office"

export interface VacancySubscriptionFilters {
  city_id?: number | null
  location?: string | null
  employment_kind?: VacancySubscriptionEmploymentKind[] | null
  work_format?: VacancySubscriptionWorkFormat[] | null
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string | null
  experience_years_min?: number | null
  experience_years_max?: number | null
  exclude_expired?: boolean
}

export interface VacancySubscription {
  id: number
  user_id: number
  email: string
  search_text: string
  filters: VacancySubscriptionFilters
  is_active: boolean
  next_run_at: string
  last_processed_at: string | null
  last_sent_at: string | null
  created_at: string
  updated_at: string
}

export interface VacancySubscriptionCreatePayload {
  search_text: string
  filters?: VacancySubscriptionFilters
  is_active?: boolean
}

export interface VacancySubscriptionUpdatePayload {
  search_text?: string
  filters?: VacancySubscriptionFilters
  is_active?: boolean
  next_run_at?: string
}

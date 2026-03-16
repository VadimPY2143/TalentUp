export type CandidateSort = "relevance" | "date" | "experience"

export interface CandidateSearchParams {
  query?: string
  city?: string
  remote?: boolean
  experience_min?: number
  experience_max?: number
  skills?: string[]
  salary_min?: number
  salary_max?: number
  employment_type?: string[]
  page?: number
  page_size?: number
  sort?: CandidateSort
}

export interface CandidateSearchItem {
  id: number
  name?: string | null
  title?: string | null
  summary?: string | null
  desired_role?: string | null
  years_experience?: number | null
  skills?: string[] | null
  location?: string | null
  city?: string | null
  is_remote?: boolean | null
  is_active?: boolean | null
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string | null
  employment_type?: string[] | null
  pdf_file_path?: string | null
  updated_at?: string | null
}

export interface CandidateSearchResponse {
  total: number
  items: CandidateSearchItem[]
}

export type CandidateSort = "relevance" | "date" | "experience"

export interface CandidateSearchParams {
  query?: string
  location?: string
  years_experience?: number
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  employment_type?: string[]
  page?: number
  page_size?: number
  sort?: CandidateSort
}

export interface CandidateSearchItem {
  id: number
  user_id?: number | null
  name?: string | null
  title?: string | null
  summary?: string | null
  desired_role?: string | null
  years_experience?: number | null
  location?: string | null
  is_active?: boolean | null
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string | null
  employment_type?: string[] | null
  created_at?: string | null
  pdf_file_path?: string | null
  pdf_original_name?: string | null
  pdf_size?: number | null
  pdf_uploaded_at?: string | null
  updated_at?: string | null
}

export interface CandidateSearchResponse {
  total: number
  items: CandidateSearchItem[]
}

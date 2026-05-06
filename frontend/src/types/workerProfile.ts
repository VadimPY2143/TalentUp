export interface WorkerProfileLanguage {
  id: number
  language_id: number
  language_name: string
  proficiency_level: string
}

export interface WorkerProfileLink {
  id: number
  title: string
  url: string
}

export interface WorkerActiveResume {
  id: number
  title: string
  summary?: string | null
  desired_role?: string | null
  employment_type?: string[] | null
  location?: string | null
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string | null
  years_experience?: number | null
  is_active: boolean
  pdf_file_path?: string | null
  pdf_original_name?: string | null
  pdf_size?: number | null
  pdf_uploaded_at?: string | null
  updated_at: string
}

export interface EmployerWorkerProfile {
  user_id: number
  username: string
  city?: string | null
  education?: string | null
  bio?: string | null
  phone?: string | null
  languages?: string[] | null
  links?: string[] | null
  user_languages: WorkerProfileLanguage[]
  user_links: WorkerProfileLink[]
  active_resumes: WorkerActiveResume[]
}

export type ApplicationStatus = "applied" | "viewed" | "chat_started"

export interface VacancyBrief {
  id: number
  title: string
  company_id: number
}

export interface ApplicationHistoryItem {
  id: number
  status: ApplicationStatus
  comment?: string | null
  changed_at: string
}

export interface JobApplication {
  id: number
  user_id: number
  candidate_name?: string | null
  vacancy_id: number
  resume_id?: number | null
  resume_title?: string | null
  cover_letter?: string | null
  status: ApplicationStatus
  created_at: string
  updated_at: string
  vacancy?: VacancyBrief | null
  history: ApplicationHistoryItem[]
}

export interface ApplicationResume {
  id: number
  user_id: number
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
  created_at: string
  updated_at: string
}

export interface CreateApplicationPayload {
  vacancy_id: number
  resume_id: number
  cover_letter?: string
}

export interface UpdateApplicationStatusPayload {
  status: ApplicationStatus
  comment?: string
}

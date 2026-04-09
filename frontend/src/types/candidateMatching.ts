export type CandidateMatchJobStatus = "pending" | "running" | "done" | "failed"

export interface CandidateMatchRunRequest {
  requested_limit?: number
}

export interface CandidateMatchRunResponse {
  job_id: string
  vacancy_id: number
  status: CandidateMatchJobStatus
  requested_limit: number
}

export interface CandidateMatchResultItem {
  rank: number
  application_id: number
  resume_id: number
  candidate_user_id: number
  candidate_name: string
  title: string
  desired_role?: string | null
  years_experience?: number | null
  location?: string | null
  employment_type: string[]
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string | null
  cover_letter?: string | null
  score_total: number
  score_sql: number
  confidence: number
  verdict: "strong_match" | "match" | "weak_match" | "mismatch" | string
  matched_skills: string[]
  missing_skills: string[]
  strengths: string[]
  risks: string[]
  summary: string
}

export interface CandidateMatchJobResponse {
  job_id: string
  vacancy_id: number
  created_by_user_id: number
  status: CandidateMatchJobStatus
  requested_limit: number
  prefiltered_count?: number | null
  scored_count?: number | null
  created_at: string
  updated_at: string
  error?: string | null
  result: CandidateMatchResultItem[]
}

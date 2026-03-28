export type EmploymentType = "Remote" | "Office" | "Hybrid"
export type CurrencyType = "USD" | "EUR" | "UAH"

export interface ResumeBase {
  title: string
  summary?: string
  desired_role?: string
  employment_type: EmploymentType[]
  location?: string
  salary_min?: number
  salary_max?: number
  salary_currency?: CurrencyType
  years_experience?: number
  is_active?: boolean
}

export interface Resume extends ResumeBase {
  id: number
  created_at?: string
  updated_at?: string
  pdf_file_path?: string | null
  pdf_original_name?: string | null
  pdf_size?: number | null
  pdf_uploaded_at?: string | null
}

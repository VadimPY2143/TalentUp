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
}

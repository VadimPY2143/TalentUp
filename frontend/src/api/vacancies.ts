import { apiFetch } from "./client"
import type {
  VacancyAIFillPayload,
  VacancyPayload,
  VacancyResponse,
  VacancyUpdatePayload,
} from "../types/vacancy"

interface SearchVacanciesFilters {
  search?: string
  location?: string
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  experience_years_min?: number
  experience_years_max?: number
  employment_type?: string[]
  work_format?: string[]
  page?: number
  page_size?: number
}

interface SearchVacanciesResponse {
  items: VacancyResponse[]
  total: number
}

export const searchVacancies = (filters: SearchVacanciesFilters, signal?: AbortSignal) => {
  const params = new URLSearchParams()
  if (filters.search) params.append('search', filters.search)
  if (filters.location) params.append('location', filters.location)
  if (filters.salary_min) params.append('salary_min', filters.salary_min.toString())
  if (filters.salary_max) params.append('salary_max', filters.salary_max.toString())
  if (filters.salary_currency) params.append('salary_currency', filters.salary_currency)
  if (filters.experience_years_min) params.append('experience_years_min', filters.experience_years_min.toString())
  if (filters.experience_years_max) params.append('experience_years_max', filters.experience_years_max.toString())
  if (filters.employment_type) {
    filters.employment_type.forEach(type => params.append('employment_type', type))
  }
  if (filters.work_format) {
    filters.work_format.forEach(format => params.append('work_format', format))
  }
  if (filters.page) params.append('page', filters.page.toString())
  if (filters.page_size) params.append('page_size', filters.page_size.toString())
  
  return apiFetch<SearchVacanciesResponse>(`/vacancies/search?${params.toString()}`, {
    method: "GET",
    signal,
  })
}

export const listCompanyVacancies = (companyId: number) => {
  return apiFetch<VacancyResponse[]>(`/companies/${companyId}/vacancies`, {
    method: "GET",
  })
}

export const createCompanyVacancy = (companyId: number, payload: VacancyPayload) => {
  return apiFetch<VacancyResponse>(`/companies/${companyId}/vacancies`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export const aiFillCompanyVacancy = (companyId: number, payload: VacancyAIFillPayload) => {
  return apiFetch<VacancyPayload>(`/companies/${companyId}/vacancies/ai-fill`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export const updateCompanyVacancy = (
  companyId: number,
  vacancyId: number,
  payload: VacancyUpdatePayload,
) => {
  return apiFetch<VacancyResponse>(`/companies/${companyId}/vacancies/${vacancyId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export const deleteCompanyVacancy = (companyId: number, vacancyId: number) => {
  return apiFetch<{ status: string }>(`/companies/${companyId}/vacancies/${vacancyId}`, {
    method: "DELETE",
  })
}

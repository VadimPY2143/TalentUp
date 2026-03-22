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
  employment_type?: string
}

export const searchVacancies = (filters: SearchVacanciesFilters) => {
  const params = new URLSearchParams()
  if (filters.search) params.append('search', filters.search)
  if (filters.location) params.append('location', filters.location)
  if (filters.salary_min) params.append('salary_min', filters.salary_min.toString())
  if (filters.employment_type) params.append('employment_type', filters.employment_type)
  
  return apiFetch<VacancyResponse[]>(`/vacancies/search?${params.toString()}`, {
    method: "GET",
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

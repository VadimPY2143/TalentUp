import { apiFetch } from "./client"
import type {
  VacancyAIFillPayload,
  VacancyPayload,
  VacancyResponse,
  VacancyUpdatePayload,
} from "../types/vacancy"

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

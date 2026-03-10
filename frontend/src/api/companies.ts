import { apiFetch } from "./client"
import type { CompanyPayload, CompanyResponse, CompanyUpdatePayload } from "../types/company"

export const listCompanies = () => {
  return apiFetch<CompanyResponse[]>("/companies", {
    method: "GET",
  })
}

export const createCompany = (payload: CompanyPayload) => {
  return apiFetch<CompanyResponse>("/companies", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export const updateCompany = (companyId: number, payload: CompanyUpdatePayload) => {
  return apiFetch<CompanyResponse>(`/companies/${companyId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

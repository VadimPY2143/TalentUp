import { apiFetch } from "./client"
import type { CompanyPayload, CompanyResponse, CompanyUpdatePayload } from "../types/company"

interface ApiErrorWithStatus extends Error {
  status?: number
}

const isApiErrorWithStatus = (error: unknown): error is ApiErrorWithStatus => {
  return error instanceof Error && "status" in error
}

const isMissingEndpointError = (error: unknown) => {
  if (!isApiErrorWithStatus(error)) {
    return false
  }
  return error.status === 404 || error.status === 405 || error.status === 501
}

export const listCompanies = () => {
  return apiFetch<CompanyResponse[]>("/companies", {
    method: "GET",
  })
}

export const getCompanyById = async (companyId: number) => {
  try {
    return await apiFetch<CompanyResponse>(`/companies/${companyId}`, {
      method: "GET",
    })
  } catch (error) {
    if (!isMissingEndpointError(error)) {
      throw error
    }

    const companies = await listCompanies()
    const matchedCompany = companies.find((company) => company.id === companyId)
    if (matchedCompany) {
      return matchedCompany
    }

    const notFoundError = new Error("Company not found") as ApiErrorWithStatus
    notFoundError.status = 404
    throw notFoundError
  }
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

import { apiFetch } from "./client"
import type {
  VacancyAIFillPayload,
  VacancyPayload,
  VacancyResponse,
  VacancyUpdatePayload,
} from "../types/vacancy"

interface VacancySearchParams {
  query?: string
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

interface VacancySearchResponse {
  items: VacancyResponse[]
  total: number
}

const appendParam = (
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | undefined,
) => {
  if (value === undefined || value === null || value === "") {
    return
  }
  params.set(key, String(value))
}

const appendArray = (params: URLSearchParams, key: string, values: string[] | undefined) => {
  if (!values?.length) {
    return
  }
  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => params.append(key, value))
}

const buildVacancySearchParams = (payload: VacancySearchParams) => {
  const params = new URLSearchParams()

  appendParam(params, "vacancy_name", payload.query)
  appendParam(params, "location", payload.location)
  appendParam(params, "salary_min", payload.salary_min)
  appendParam(params, "salary_max", payload.salary_max)
  appendParam(params, "salary_currency", payload.salary_currency)
  appendParam(params, "experience_years_min", payload.experience_years_min)
  appendParam(params, "experience_years_max", payload.experience_years_max)
  appendArray(params, "employment_kind", payload.employment_type)
  appendArray(params, "work_format", payload.work_format)

  if (payload.page_size !== undefined) {
    appendParam(params, "limit", payload.page_size)
  }
  if (payload.page !== undefined && payload.page_size !== undefined) {
    const offset = Math.max(0, (payload.page - 1) * payload.page_size)
    appendParam(params, "offset", offset)
  }

  return params.toString()
}

export const searchVacancies = async (
  payload: VacancySearchParams,
  signal?: AbortSignal,
): Promise<VacancySearchResponse> => {
  const query = buildVacancySearchParams(payload)
  const path = query ? `/vacancy_search?${query}` : "/vacancy_search"
  const data = await apiFetch<{ vacancies: VacancyResponse[] }>(path, { signal })
  const items = data?.vacancies ?? []
  return { total: items.length, items }
}

export const getVacancyById = (vacancyId: number) => {
  return apiFetch<VacancyResponse>(`/vacancy_search/vacancy/${vacancyId}`)
}

export const fetchRecommendedVacancies = async (
  limit: number,
  offset: number,
  filters?: Omit<VacancySearchParams, "page" | "page_size" | "query">,
  signal?: AbortSignal,
): Promise<VacancySearchResponse> => {
  const params = new URLSearchParams()
  params.set("limit", String(limit))
  params.set("offset", String(offset))

  if (filters) {
    const filterQuery = buildVacancySearchParams({
      ...filters,
      page: undefined,
      page_size: undefined,
      query: undefined,
    })
    if (filterQuery) {
      new URLSearchParams(filterQuery).forEach((value, key) => params.append(key, value))
    }
  }

  const data = await apiFetch<{ vacancies: VacancyResponse[] }>(
    `/vacancy_search/recommendations?${params.toString()}`,
    { signal },
  )
  const items = data?.vacancies ?? []
  return { total: items.length, items }
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

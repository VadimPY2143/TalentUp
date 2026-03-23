import { apiFetch, apiFetchBlob } from "./client"
import type { CandidateSearchParams, CandidateSearchResponse } from "../types/candidate"
import type { Resume } from "../types/resume"

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
  if (!values || values.length === 0) {
    return
  }
  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => params.append(key, value))
}

const buildSearchParams = (payload: CandidateSearchParams) => {
  const params = new URLSearchParams()

  appendParam(params, "resume_name", payload.query)
  appendParam(params, "location", payload.location)
  appendParam(params, "years_experience", payload.years_experience)
  appendParam(params, "salary_from", payload.salary_min)
  appendParam(params, "salary_to", payload.salary_max)
  appendParam(params, "salary_currency", payload.salary_currency)
  appendArray(params, "employment_type", payload.employment_type)

  if (payload.page_size !== undefined) {
    appendParam(params, "limit", payload.page_size)
  }
  if (payload.page !== undefined && payload.page_size !== undefined) {
    const offset = Math.max(0, (payload.page - 1) * payload.page_size)
    appendParam(params, "offset", offset)
  }

  return params.toString()
}

export const searchCandidates = async (
  payload: CandidateSearchParams,
  signal?: AbortSignal,
): Promise<CandidateSearchResponse> => {
  const query = buildSearchParams(payload)
  const path = query ? `/resume_search?${query}` : "/resume_search"
  const data = await apiFetch<{ resumes: CandidateSearchResponse["items"] }>(path, { signal })
  const items = data?.resumes ?? []
  return { total: items.length, items }
}

export const fetchRecommendedCandidates = async (
  limit: number,
  offset: number,
  filters?: Omit<CandidateSearchParams, "page" | "page_size" | "query" | "sort">,
  signal?: AbortSignal,
): Promise<CandidateSearchResponse> => {
  const params = new URLSearchParams()
  params.set("limit", String(limit))
  params.set("offset", String(offset))

  if (filters) {
    const filterQuery = buildSearchParams({
      ...filters,
      page: undefined,
      page_size: undefined,
      query: undefined,
      sort: undefined,
    })
    if (filterQuery) {
      new URLSearchParams(filterQuery).forEach((value, key) => params.append(key, value))
    }
  }

  const data = await apiFetch<{ resumes: CandidateSearchResponse["items"] }>(
    `/resume_search/recommendations?${params.toString()}`,
    { signal },
  )
  const items = data?.resumes ?? []
  return { total: items.length, items }
}

export const openCandidateResume = async (resumeId: number): Promise<void> => {
  const blob = await apiFetchBlob(`/resumes/${resumeId}/pdf`)
  const url = window.URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener,noreferrer")
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

export const saveCandidateResume = (companyId: number, resumeId: number) => {
  return apiFetch<{ status: string }>(`/companies/${companyId}/resumes/${resumeId}`, {
    method: "POST",
  })
}

export const listSavedResumesByCompany = (companyId: number) => {
  return apiFetch<Resume[]>(`/companies/${companyId}/saved-resumes`)
}

export const deleteSavedResumeByCompany = (companyId: number, resumeId: number) => {
  return apiFetch<{ status: string }>(
    `/companies/${companyId}/saved-resumes?resume_id=${resumeId}`,
    {
      method: "DELETE",
    },
  )
}

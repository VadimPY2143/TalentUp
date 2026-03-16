import { apiFetch, apiFetchBlob } from "./client"
import type {
  CandidateSearchParams,
  CandidateSearchResponse,
} from "../types/candidate"

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

const buildSearchParams = (payload: CandidateSearchParams) => {
  const params = new URLSearchParams()
  appendParam(params, "query", payload.query)
  appendParam(params, "city", payload.city)
  appendParam(params, "remote", payload.remote)
  appendParam(params, "experience_min", payload.experience_min)
  appendParam(params, "experience_max", payload.experience_max)
  appendParam(params, "salary_min", payload.salary_min)
  appendParam(params, "salary_max", payload.salary_max)
  appendParam(params, "page", payload.page)
  appendParam(params, "page_size", payload.page_size)
  appendParam(params, "sort", payload.sort)

  if (payload.skills?.length) {
    params.set("skills", payload.skills.join(","))
  }
  if (payload.employment_type?.length) {
    params.set("employment_type", payload.employment_type.join(","))
  }

  return params.toString()
}

export const searchCandidates = (
  payload: CandidateSearchParams,
  signal?: AbortSignal,
) => {
  const query = buildSearchParams(payload)
  const path = query ? `/resumes/search?${query}` : "/resumes/search"
  return apiFetch<CandidateSearchResponse>(path, { signal })
}

export const openCandidateResume = async (resumeId: number): Promise<void> => {
  const blob = await apiFetchBlob(`/resumes/${resumeId}/pdf`)
  const url = window.URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener,noreferrer")
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

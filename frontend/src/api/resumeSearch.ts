import { apiFetch } from "./client"
import type { Resume } from "../types/resume"

export interface ResumeSearchParams {
  resume_name: string
  limit?: number
  offset?: number
}

export interface ResumeSearchResponse {
  resumes: Resume[]
  total?: number
}

const appendParam = (
  params: URLSearchParams,
  key: string,
  value: string | number | undefined,
) => {
  if (value === undefined || value === null || value === "") {
    return
  }
  params.set(key, String(value))
}

const buildSearchParams = (payload: ResumeSearchParams) => {
  const params = new URLSearchParams()
  appendParam(params, "resume_name", payload.resume_name)
  appendParam(params, "limit", payload.limit)
  appendParam(params, "offset", payload.offset)
  return params.toString()
}

export const searchResumesByTitle = (
  payload: ResumeSearchParams,
  signal?: AbortSignal,
) => {
  const query = buildSearchParams(payload)
  return apiFetch<ResumeSearchResponse>(`/resume_search?${query}`, { signal })
}

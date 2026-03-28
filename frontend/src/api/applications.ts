import { apiFetch, apiFetchBlob } from "./client"
import type {
  ApplicationResume,
  ApplicationHistoryItem,
  CreateApplicationPayload,
  JobApplication,
  UpdateApplicationStatusPayload,
} from "../types/application"

export const createApplication = (payload: CreateApplicationPayload) => {
  return apiFetch<JobApplication>("/applications", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export const listMyApplications = () => {
  return apiFetch<JobApplication[]>("/applications/my")
}

export const listEmployerApplications = (vacancyId?: number) => {
  const params = new URLSearchParams()
  if (vacancyId !== undefined) {
    params.set("vacancy_id", String(vacancyId))
  }
  const query = params.toString()
  const path = query ? `/applications/employer?${query}` : "/applications/employer"
  return apiFetch<JobApplication[]>(path)
}

export const getApplicationById = (applicationId: number) => {
  return apiFetch<JobApplication>(`/applications/${applicationId}`)
}

export const getApplicationHistory = (applicationId: number) => {
  return apiFetch<ApplicationHistoryItem[]>(`/applications/${applicationId}/history`)
}

export const getApplicationResume = (applicationId: number) => {
  return apiFetch<ApplicationResume>(`/applications/${applicationId}/resume`)
}

export const openApplicationResumePdf = async (resumeId: number): Promise<void> => {
  const blob = await apiFetchBlob(`/resumes/${resumeId}/pdf`)
  const url = window.URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener,noreferrer")
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

export const updateApplicationStatus = (
  applicationId: number,
  payload: UpdateApplicationStatusPayload,
) => {
  return apiFetch<JobApplication>(`/applications/${applicationId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

import { apiFetch, apiFetchBlob } from "./client"
import type { Resume, ResumeBase } from "../types/resume"

export const listResumes = () => apiFetch<Resume[]>("/resumes")

export const createResume = (payload: ResumeBase) =>
  apiFetch<{ status: string }>("/resumes", {
    method: "POST",
    body: JSON.stringify(payload),
  })

export const updateResume = (id: number, payload: Partial<ResumeBase>) =>
  apiFetch<{ status: string }>(`/resumes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })

export const deleteResume = (id: number) =>
  apiFetch<{ status: string }>(`/resumes/${id}`, {
    method: "DELETE",
  })

export const uploadResumePdf = (id: number, file: File) => {
  const formData = new FormData()
  formData.append("file", file)

  return apiFetch<{ status: string; filename: string; size: number }>(`/resumes/${id}/pdf`, {
    method: "POST",
    body: formData,
  })
}

export const deleteResumePdf = (id: number) =>
  apiFetch<{ status: string }>(`/resumes/${id}/pdf`, {
    method: "DELETE",
  })

export const openResumePdf = async (id: number): Promise<void> => {
  const blob = await apiFetchBlob(`/resumes/${id}/pdf`)
  const objectUrl = URL.createObjectURL(blob)
  window.open(objectUrl, "_blank", "noopener,noreferrer")
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
}

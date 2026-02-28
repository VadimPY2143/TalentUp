import { apiFetch } from "./client"
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

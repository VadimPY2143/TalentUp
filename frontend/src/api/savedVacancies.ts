import { apiFetch } from "./client"
import type { VacancyResponse } from "../types/vacancy"

export interface SavedVacancy {
  id: number
  user_id: number
  vacancy_id: number
  note: string | null
  created_at: string
  updated_at: string
  vacancy: VacancyResponse
}

export interface SavedVacancyCreate {
  vacancy_id: number
  note?: string
}

export async function createSavedVacancy(payload: SavedVacancyCreate): Promise<SavedVacancy> {
  const response = await apiFetch("/saved-vacancies", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return response as SavedVacancy
}

export async function listSavedVacancies(): Promise<SavedVacancy[]> {
  const response = await apiFetch("/saved-vacancies")
  return response as SavedVacancy[]
}

export async function getSavedVacancy(id: number): Promise<SavedVacancy> {
  const response = await apiFetch(`/saved-vacancies/${id}`)
  return response as SavedVacancy
}

export async function updateSavedVacancy(
  id: number,
  payload: Partial<SavedVacancyCreate>,
): Promise<SavedVacancy> {
  const response = await apiFetch(`/saved-vacancies/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return response as SavedVacancy
}

export async function deleteSavedVacancy(id: number): Promise<{ status: string }> {
  const response = await apiFetch(`/saved-vacancies/${id}`, {
    method: "DELETE",
  })
  return response as { status: string }
}

import { apiFetch } from "./client"
import type { CityOption } from "../types/city"

export const listCities = (query?: string, limit = 10, signal?: AbortSignal) => {
  const params = new URLSearchParams()
  params.set("limit", String(limit))
  if (query?.trim()) {
    params.set("query", query.trim())
  }

  return apiFetch<CityOption[]>(`/cities?${params.toString()}`, { signal })
}

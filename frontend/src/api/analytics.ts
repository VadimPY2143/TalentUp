import { apiFetch, setApiUrlOverride } from "./client"
import type { AnalyticsDashboard, AnalyticsEventType } from "../types/analytics"

const isNetworkError = (error: unknown) =>
  error instanceof TypeError ||
  (error instanceof Error && /fetch/i.test(error.message))

export const fetchAnalyticsDashboard = async (days: number) => {
  const normalized = Number.isFinite(days) ? Math.max(1, Math.min(365, Math.trunc(days))) : 30
  try {
    return await apiFetch<AnalyticsDashboard>(`/analytics/dashboard?days=${normalized}`)
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error
    }

    setApiUrlOverride(null)
    return apiFetch<AnalyticsDashboard>(`/analytics/dashboard?days=${normalized}`)
  }
}

export const trackAnalyticsEvent = (payload: {
  event_type: AnalyticsEventType
  target_user_id?: number
  target_resume_id?: number
}) => {
  return apiFetch<{ status: string; inserted: boolean }>("/analytics/events", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}


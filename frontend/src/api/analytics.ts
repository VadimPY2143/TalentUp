import { apiFetch } from "./client"
import type { AnalyticsDashboard, AnalyticsEventType } from "../types/analytics"

export const fetchAnalyticsDashboard = (days: number) => {
  const normalized = Number.isFinite(days) ? Math.max(1, Math.min(365, Math.trunc(days))) : 30
  return apiFetch<AnalyticsDashboard>(`/analytics/dashboard?days=${normalized}`)
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


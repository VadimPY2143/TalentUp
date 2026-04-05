export type AnalyticsEventType = "profile_view" | "resume_view" | "contact_click"

export interface AnalyticsOverview {
  from_dt: string
  to_dt: string
  profile_views: number
  profile_viewers_unique: number
  resume_views: number
  resume_viewers_unique: number
  applications_sent: number
  applications_by_status: Record<string, number>
}

export interface AnalyticsTimeseriesPoint {
  day: string
  profile_views: number
  resume_views: number
  applications_sent: number
}

export interface AnalyticsFunnelStep {
  step: string
  count: number
}

export interface AnalyticsApplicationRow {
  id: number
  vacancy_id: number
  vacancy_title?: string | null
  company_id?: number | null
  status: string
  created_at: string
  updated_at: string
}

export interface AnalyticsDashboard {
  overview: AnalyticsOverview
  timeseries: AnalyticsTimeseriesPoint[]
  funnel: AnalyticsFunnelStep[]
  applications: AnalyticsApplicationRow[]
}


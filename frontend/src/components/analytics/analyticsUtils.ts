import type { AnalyticsTimeseriesPoint } from "../../types/analytics"

export const dayOptions = [
  { value: 7, label: "7 днів" },
  { value: 30, label: "30 днів" },
  { value: 90, label: "90 днів" },
] as const

export const formatNumber = (value: number) => new Intl.NumberFormat("uk-UA").format(value)

export const toPercent = (num: number, den: number, digits = 1) => {
  if (!den) return null
  const pct = (num / den) * 100
  return `${pct.toFixed(pct >= 10 ? 0 : digits)}%`
}

export const formatDate = (iso: string) => {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  return new Intl.DateTimeFormat("uk-UA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt)
}

export const formatShortDate = (iso: string) => {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short" }).format(dt)
}

export const statusLabel = (status: string) => {
  switch (status) {
    case "applied":
      return "Подано"
    case "viewed":
      return "Переглянуто"
    case "chat_started":
      return "Почато переписку"
    default:
      return "Невідомий статус"
  }
}

export const stepLabel = (step: string) => {
  switch (step) {
    case "profile_views":
      return "Перегляди профілю"
    case "resume_views":
      return "Перегляди резюме"
    case "applications_sent":
      return "Відгуки подано"
    case "applications_viewed":
      return "Переглянуто роботодавцями"
    case "applications_chat_started":
      return "Почато переписку"
    default:
      return step
  }
}

const toUtcDate = (iso: string) => {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

const weekStartKey = (iso: string) => {
  const dt = toUtcDate(iso)
  if (!dt) return iso
  const day = dt.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(dt)
  monday.setUTCDate(dt.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

export const aggregateTimeseriesByWeek = (
  points: AnalyticsTimeseriesPoint[],
): AnalyticsTimeseriesPoint[] => {
  if (points.length <= 45) {
    return points
  }

  const buckets = new Map<string, AnalyticsTimeseriesPoint>()
  for (const point of points) {
    const key = weekStartKey(point.day)
    const existing = buckets.get(key) ?? {
      day: key,
      profile_views: 0,
      resume_views: 0,
      applications_sent: 0,
    }
    existing.profile_views = (existing.profile_views ?? 0) + (point.profile_views ?? 0)
    existing.resume_views = (existing.resume_views ?? 0) + (point.resume_views ?? 0)
    existing.applications_sent = (existing.applications_sent ?? 0) + (point.applications_sent ?? 0)
    buckets.set(key, existing)
  }

  return Array.from(buckets.values()).sort((a, b) => a.day.localeCompare(b.day))
}

export const niceAxisMax = (value: number) => {
  if (value <= 0) return 4
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  if (normalized <= 1) return magnitude
  if (normalized <= 2) return 2 * magnitude
  if (normalized <= 5) return 5 * magnitude
  return 10 * magnitude
}

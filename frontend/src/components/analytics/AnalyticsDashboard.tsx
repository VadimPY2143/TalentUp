import { useEffect, useMemo, useState } from "react"

import { fetchAnalyticsDashboard } from "../../api/analytics"
import type { AnalyticsDashboard as AnalyticsDashboardData } from "../../types/analytics"

interface AnalyticsDashboardProps {
  embedded?: boolean
  hideLeadCard?: boolean
}

const dayOptions = [
  { value: 7, label: "7 днів" },
  { value: 30, label: "30 днів" },
  { value: 90, label: "90 днів" },
] as const

const formatNumber = (value: number) => new Intl.NumberFormat("uk-UA").format(value)

const toPercent = (num: number, den: number) => {
  if (!den) return "0%"
  const pct = (num / den) * 100
  return `${pct.toFixed(pct >= 10 ? 0 : 1)}%`
}

const formatDate = (iso: string) => {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  return new Intl.DateTimeFormat("uk-UA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(dt)
}

const statusLabel = (status: string) => {
  switch (status) {
    case "applied":
      return "Подано"
    case "viewed":
      return "Переглянуто"
    case "chat_started":
      return "Чат розпочато"
    default:
      return "Невідомий статус"
  }
}

const stepLabel = (step: string) => {
  switch (step) {
    case "profile_views":
      return "Перегляди профілю"
    case "resume_views":
      return "Перегляди резюме"
    case "applications_sent":
      return "Відгуки на вакансії"
    case "applications_viewed":
      return "Відгуки переглянуто"
    default:
      return step
  }
}

const buildLinePath = (values: number[], width: number, height: number, padding = 8) => {
  if (values.length === 0) return ""
  const max = Math.max(1, ...values)
  const min = 0
  const innerW = Math.max(1, width - padding * 2)
  const innerH = Math.max(1, height - padding * 2)

  const points = values.map((v, i) => {
    const x = padding + (i / Math.max(1, values.length - 1)) * innerW
    const y = padding + (1 - (v - min) / (max - min || 1)) * innerH
    return [x, y] as const
  })

  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
}

const AnalyticsDashboard = ({ embedded = false, hideLeadCard = false }: AnalyticsDashboardProps) => {
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<AnalyticsDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const dashboard = await fetchAnalyticsDashboard(days)
        if (!cancelled) setData(dashboard)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Помилка завантаження аналітики"
        if (!cancelled) setError(message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [days])

  const timeseries = data?.timeseries ?? []
  const profileSeries = useMemo(() => timeseries.map((p) => p.profile_views ?? 0), [timeseries])
  const resumeSeries = useMemo(() => timeseries.map((p) => p.resume_views ?? 0), [timeseries])
  const appSeries = useMemo(() => timeseries.map((p) => p.applications_sent ?? 0), [timeseries])

  const chart = useMemo(() => {
    const width = 760
    const height = 180
    const profilePath = buildLinePath(profileSeries, width, height)
    const resumePath = buildLinePath(resumeSeries, width, height)
    const appPath = buildLinePath(appSeries, width, height)
    return { width, height, profilePath, resumePath, appPath }
  }, [profileSeries, resumeSeries, appSeries])

  const overview = data?.overview
  const funnel = data?.funnel ?? []
  const visibleFunnel = useMemo(
    () => funnel.filter((step) => step.step !== "applications_accepted"),
    [funnel],
  )
  const apps = data?.applications ?? []

  const profileToApply = overview ? toPercent(overview.applications_sent, overview.profile_views) : "0%"
  const wrapperClass = embedded ? "" : "mx-auto max-w-[1120px] px-4 py-8"

  return (
    <div className={wrapperClass}>
      {!hideLeadCard ? (
        <div className="flex flex-col gap-4 rounded-[26px] border border-slate-200 bg-white p-6 shadow-soft md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Кабінет</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Аналітика</h1>
            <p className="mt-1 text-sm text-slate-500">
              Перегляди профілю та резюме, відгуки на вакансії і воронка за період.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Період</div>
            <select
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 outline-none focus:border-orange-500/60"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            >
              {dayOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex justify-start">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-soft">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Період аналізу</div>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-orange-500/60"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            >
              {dayOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-soft">
          Завантаження...
        </div>
      )}

      {!isLoading && !error && overview && (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Перегляди профілю</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{formatNumber(overview.profile_views)}</div>
              <div className="mt-1 text-sm text-slate-500">Унікальні: {formatNumber(overview.profile_viewers_unique)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Перегляди резюме</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{formatNumber(overview.resume_views)}</div>
              <div className="mt-1 text-sm text-slate-500">Унікальні: {formatNumber(overview.resume_viewers_unique)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Відгуки на вакансії</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{formatNumber(overview.applications_sent)}</div>
              <div className="mt-1 text-sm text-slate-500">Конверсія профіль → відгук: {profileToApply}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Динаміка</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">Перегляди та відгуки по днях</div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#243b77]" />
                    Профіль
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    Резюме
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Відгуки
                  </span>
                </div>
              </div>

              {timeseries.length === 0 ? (
                <div className="mt-4 text-sm text-slate-500">Даних за період поки немає.</div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${chart.width} ${chart.height}`}
                    className="min-w-[620px] max-w-full"
                    role="img"
                    aria-label="Графік аналітики"
                  >
                    <rect x="0" y="0" width={chart.width} height={chart.height} rx="14" fill="#f8fafc" />
                    <path d={chart.profilePath} fill="none" stroke="#243b77" strokeWidth="3" />
                    <path d={chart.resumePath} fill="none" stroke="#f97316" strokeWidth="3" />
                    <path d={chart.appPath} fill="none" stroke="#10b981" strokeWidth="3" />
                  </svg>
                  <div className="mt-2 flex justify-between text-xs text-slate-400">
                    <span>{formatDate(timeseries[0].day)}</span>
                    <span>{formatDate(timeseries[timeseries.length - 1].day)}</span>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Воронка</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">Перегляд → відгук</div>

              <div className="mt-4 space-y-3">
                {visibleFunnel.length === 0 && <div className="text-sm text-slate-500">Немає даних.</div>}
                {visibleFunnel.length > 0 && (() => {
                  const top = Math.max(1, ...visibleFunnel.map((s) => s.count))
                  return visibleFunnel.map((s) => {
                    const widthPct = Math.max(2, Math.round((s.count / top) * 100))
                    const pct = visibleFunnel[0]?.count ? toPercent(s.count, visibleFunnel[0].count) : "0%"
                    return (
                      <div key={s.step} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-800">{stepLabel(s.step)}</div>
                          <div className="text-xs text-slate-500">
                            {formatNumber(s.count)} ({pct})
                          </div>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-white">
                          <div className="h-2 rounded-full bg-[#13244d]" style={{ width: `${widthPct}%` }} />
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Мої відгуки</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">Заявки за період</div>
              </div>
              <div className="text-xs text-slate-500">
                {formatDate(overview.from_dt)} - {formatDate(overview.to_dt)}
              </div>
            </div>

            {apps.length === 0 ? (
              <div className="mt-4 text-sm text-slate-500">За цей період ви не надсилали відгуків.</div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-2 py-2">Вакансія</th>
                      <th className="px-2 py-2">Статус</th>
                      <th className="px-2 py-2">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-2 py-3">
                          <div className="font-semibold text-slate-800">
                            {row.vacancy_title ?? "Вакансія (назва недоступна)"}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-slate-700">{statusLabel(row.status)}</td>
                        <td className="px-2 py-3 text-slate-500">{formatDate(row.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default AnalyticsDashboard

import { useEffect, useMemo, useState } from "react"
import { Briefcase, Eye, MessageCircle, TrendingUp } from "lucide-react"

import { fetchAnalyticsDashboard } from "../../api/analytics"
import type { AnalyticsDashboard as AnalyticsDashboardData } from "../../types/analytics"
import AnalyticsActivityChart from "./AnalyticsActivityChart"
import AnalyticsFunnelPanel from "./AnalyticsFunnelPanel"
import {
  dayOptions,
  formatDate,
  formatNumber,
  statusLabel,
  toPercent,
} from "./analyticsUtils"

interface AnalyticsDashboardProps {
  embedded?: boolean
  hideLeadCard?: boolean
}

const periodButtonClass = (active: boolean) =>
  `rounded-xl px-4 py-2 text-sm font-semibold transition ${
    active
      ? "bg-[#13244d] text-white shadow-sm"
      : "bg-white text-slate-600 hover:bg-slate-50"
  }`

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

  const overview = data?.overview
  const timeseries = data?.timeseries ?? []
  const funnel = data?.funnel ?? []
  const apps = data?.applications ?? []

  const metrics = useMemo(() => {
    if (!overview) return []
    const chatStarted = overview.applications_by_status.chat_started ?? 0
    const viewedOrMore = (overview.applications_by_status.viewed ?? 0) + chatStarted
    const viewedRate = toPercent(viewedOrMore, overview.applications_sent)
    const chatRate = toPercent(chatStarted, overview.applications_sent)
    return [
      {
        label: "Відгуки подано",
        value: overview.applications_sent,
        hint: `За період: ${formatDate(overview.from_dt)} — ${formatDate(overview.to_dt)}`,
        icon: Briefcase,
        accent: "from-emerald-50 to-emerald-100/40",
        iconColor: "text-emerald-600",
      },
      {
        label: "Переглянуто роботодавцями",
        value: viewedOrMore,
        hint: viewedRate
          ? `Конверсія з поданих відгуків: ${viewedRate}`
          : "Ще немає переглянутих відгуків",
        icon: Eye,
        accent: "from-[#13244d]/10 to-[#243b77]/5",
        iconColor: "text-[#243b77]",
      },
      {
        label: "Почато переписку",
        value: chatStarted,
        hint: chatRate
          ? `Частка від усіх відгуків: ${chatRate}`
          : "Ще немає активних чатів",
        icon: MessageCircle,
        accent: "from-orange-50 to-orange-100/40",
        iconColor: "text-orange-600",
      },
    ]
  }, [overview])

  const wrapperClass = embedded
    ? "min-w-0"
    : "mx-auto min-w-0 max-w-[1120px] px-4 py-8"

  return (
    <div className={wrapperClass}>
      {!hideLeadCard && (
        <div className="flex flex-col gap-4 rounded-[26px] border border-slate-200 bg-white p-6 shadow-soft md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Кабінет</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Аналітика</h1>
            <p className="mt-1 text-sm text-slate-500">
              Ваша активність як шукача роботи: відгуки, перегляди профілю та резюме.
            </p>
          </div>
          <PeriodSelector days={days} onChange={setDays} />
        </div>
      )}

      {hideLeadCard && (
        <div className="sticky top-0 z-20 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-[#f5f7fa]/95 px-1 py-3 backdrop-blur-sm">
          <p className="text-sm text-slate-500">Оберіть період для оновлення даних</p>
          <PeriodSelector days={days} onChange={setDays} />
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      )}

      {!isLoading && !error && overview && (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {metrics.map((metric) => {
              const Icon = metric.icon
              return (
                <article
                  key={metric.label}
                  className={`rounded-2xl border border-slate-200 bg-gradient-to-br ${metric.accent} p-5 shadow-soft`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {metric.label}
                      </p>
                      <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                        {formatNumber(metric.value)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{metric.hint}</p>
                    </div>
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 ${metric.iconColor}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-[1.35fr,0.65fr] lg:items-stretch">
            <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-soft lg:min-h-[520px] lg:p-6">
              <div className="shrink-0">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <TrendingUp className="h-4 w-4" />
                    Динаміка
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    Динаміка активності
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Перегляди вашого профілю/резюме роботодавцями та подані вами відгуки.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex min-h-0 flex-1 flex-col">
                <AnalyticsActivityChart points={timeseries} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 shadow-soft lg:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Воронка</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Прогрес моїх відгуків</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Етапи обробки ваших відгуків: подано, переглянуто, почато переписку.
                </p>
              </div>
              <div className="mt-5">
                <AnalyticsFunnelPanel steps={funnel} />
              </div>
            </section>
          </div>

          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4 lg:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Мої відгуки</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Заявки за період</h2>
              </div>
              <p className="text-xs text-slate-500">
                {formatDate(overview.from_dt)} — {formatDate(overview.to_dt)}
              </p>
            </div>

            {apps.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500 lg:px-6">
                За цей період ви не надсилали відгуків.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-3 lg:px-6">Вакансія</th>
                      <th className="px-5 py-3 lg:px-6">Статус</th>
                      <th className="px-5 py-3 lg:px-6">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-slate-100 transition hover:bg-slate-50/80"
                      >
                        <td className="px-5 py-3.5 font-medium text-slate-800 lg:px-6">
                          {row.vacancy_title ?? "Вакансія (назва недоступна)"}
                        </td>
                        <td className="px-5 py-3.5 lg:px-6">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 lg:px-6">{formatDate(row.created_at)}</td>
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

const PeriodSelector = ({
  days,
  onChange,
}: {
  days: number
  onChange: (value: number) => void
}) => (
  <div className="inline-flex shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-1">
    {dayOptions.map((opt) => (
      <button
        key={opt.value}
        type="button"
        className={periodButtonClass(days === opt.value)}
        onClick={() => onChange(opt.value)}
      >
        {opt.label}
      </button>
    ))}
  </div>
)

export default AnalyticsDashboard

import { useMemo, useState } from "react"

import type { AnalyticsTimeseriesPoint } from "../../types/analytics"
import {
  aggregateTimeseriesByWeek,
  formatNumber,
  formatShortDate,
  niceAxisMax,
} from "./analyticsUtils"

const SERIES = [
  { key: "profile_views" as const, label: "Профіль", color: "#243b77" },
  { key: "resume_views" as const, label: "Резюме", color: "#f97316" },
  { key: "applications_sent" as const, label: "Відгуки", color: "#10b981" },
]

interface AnalyticsActivityChartProps {
  points: AnalyticsTimeseriesPoint[]
}

const ChartEmpty = ({ title, hint }: { title: string; hint: string }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center">
    <div className="text-sm font-semibold text-slate-700">{title}</div>
    <p className="mt-2 max-w-sm text-sm text-slate-500">{hint}</p>
  </div>
)

const ChartTooltip = ({
  x,
  y,
  point,
}: {
  x: number
  y: number
  point: AnalyticsTimeseriesPoint
}) => (
  <div
    className="pointer-events-none fixed z-50 min-w-[168px] -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg"
    style={{ left: x, top: y - 10 }}
  >
    <p className="text-xs font-semibold text-slate-900">{formatShortDate(point.day)}</p>
    <ul className="mt-2 space-y-1 text-xs text-slate-600">
      {SERIES.map((series) => (
        <li key={series.key} className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: series.color }} />
            {series.label}
          </span>
          <span className="font-semibold text-slate-800">{formatNumber(point[series.key] ?? 0)}</span>
        </li>
      ))}
    </ul>
  </div>
)

const AnalyticsActivityChart = ({ points }: AnalyticsActivityChartProps) => {
  const [tooltip, setTooltip] = useState<{ index: number; x: number; y: number } | null>(null)
  const chartPoints = useMemo(() => aggregateTimeseriesByWeek(points), [points])
  const isWeeklyView = chartPoints.length < points.length

  const chart = useMemo(() => {
    const values = chartPoints.flatMap((point) => [
      point.profile_views ?? 0,
      point.resume_views ?? 0,
      point.applications_sent ?? 0,
    ])
    const peak = Math.max(0, ...values)
    const axisMax = niceAxisMax(peak)
    const totals = chartPoints.reduce(
      (acc, point) => ({
        profile: acc.profile + (point.profile_views ?? 0),
        resume: acc.resume + (point.resume_views ?? 0),
        apps: acc.apps + (point.applications_sent ?? 0),
      }),
      { profile: 0, resume: 0, apps: 0 },
    )
    return { axisMax, totals, hasActivity: peak > 0 }
  }, [chartPoints])

  if (chartPoints.length === 0) {
    return (
      <ChartEmpty
        title="Ще немає активності"
        hint="Коли роботодавці переглядатимуть профіль або резюме, тут з’явиться графік."
      />
    )
  }

  if (!chart.hasActivity) {
    return (
      <ChartEmpty
        title="За період — нульова активність"
        hint="Спробуйте інший період або оновіть резюме, щоб отримати більше переглядів."
      />
    )
  }

  const chartHeight = 220
  const pointCount = chartPoints.length
  const barGroupWidth = pointCount > 45 ? 14 : pointCount > 20 ? 18 : 24
  const barWidth = Math.max(4, Math.floor((barGroupWidth - 4) / 3))
  const gap = pointCount > 45 ? 4 : pointCount > 20 ? 6 : 8
  const chartWidth = pointCount * (barGroupWidth + gap) + 48
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(chart.axisMax * ratio))
  const labelEvery = pointCount <= 10 ? 1 : pointCount <= 20 ? 2 : pointCount <= 45 ? 5 : 7

  const totalBySeries = {
    profile_views: chart.totals.profile,
    resume_views: chart.totals.resume,
    applications_sent: chart.totals.apps,
  }

  return (
    <div className="min-w-0">
      {isWeeklyView && (
        <p className="mb-3 text-xs text-slate-500">
          Для періоду понад 45 днів показуємо сумарні значення по тижнях.
        </p>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {SERIES.map((series) => (
          <span
            key={series.key}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} />
            {series.label}: {formatNumber(totalBySeries[series.key])}
          </span>
        ))}
      </div>

      <div
        className="relative w-full max-w-full overflow-x-auto pb-1"
        onMouseLeave={() => setTooltip(null)}
      >
        <div className="inline-block" style={{ width: chartWidth }}>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            width={chartWidth}
            height={chartHeight}
            className="h-[220px]"
            role="img"
            aria-label="Графік активності по днях"
          >
            {yTicks.map((tick) => {
              const y = chartHeight - 28 - (tick / chart.axisMax) * (chartHeight - 48)
              return (
                <g key={tick}>
                  <line x1={40} y1={y} x2={chartWidth - 8} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                  <text x={34} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
                    {tick}
                  </text>
                </g>
              )
            })}

            {chartPoints.map((point, index) => {
              const groupX = 44 + index * (barGroupWidth + gap)

              return (
                <g
                  key={point.day}
                  onMouseEnter={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    setTooltip({
                      index,
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                    })
                  }}
                >
                  {SERIES.map((series, seriesIndex) => {
                    const value = point[series.key] ?? 0
                    const barHeight = (value / chart.axisMax) * (chartHeight - 48)
                    const x = groupX + seriesIndex * (barWidth + 1)
                    const y = chartHeight - 28 - barHeight
                    return (
                      <rect
                        key={series.key}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={Math.max(value > 0 ? 2 : 0, barHeight)}
                        rx={3}
                        fill={series.color}
                        opacity={tooltip?.index === index ? 1 : 0.88}
                      />
                    )
                  })}
                  {index % labelEvery === 0 && (
                    <text
                      x={groupX + barGroupWidth / 2}
                      y={chartHeight - 8}
                      textAnchor="middle"
                      className="fill-slate-400 text-[9px]"
                    >
                      {formatShortDate(point.day)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {tooltip && <ChartTooltip x={tooltip.x} y={tooltip.y} point={chartPoints[tooltip.index]} />}
      </div>
    </div>
  )
}

export default AnalyticsActivityChart

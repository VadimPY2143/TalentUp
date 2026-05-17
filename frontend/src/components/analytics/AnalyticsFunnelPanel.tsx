import { useMemo } from "react"
import { ArrowDown } from "lucide-react"

import type { AnalyticsFunnelStep } from "../../types/analytics"
import { formatNumber, stepLabel, toPercent } from "./analyticsUtils"

interface AnalyticsFunnelPanelProps {
  steps: AnalyticsFunnelStep[]
}

const FUNNEL_COLORS = ["#13244d", "#1e3a6e", "#f97316", "#10b981"]

const AnalyticsFunnelPanel = ({ steps }: AnalyticsFunnelPanelProps) => {
  const visibleSteps = useMemo(() => steps, [steps])

  const maxCount = useMemo(
    () => Math.max(1, ...visibleSteps.map((step) => step.count)),
    [visibleSteps],
  )

  if (visibleSteps.length === 0) {
    return <p className="text-sm text-slate-500">Немає даних для воронки.</p>
  }

  return (
    <div className="space-y-0">
      {visibleSteps.map((step, index) => {
        const widthPct = Math.max(step.count > 0 ? 12 : 4, Math.round((step.count / maxCount) * 100))
        const previous = index > 0 ? visibleSteps[index - 1] : null
        const fromPrevious =
          previous && previous.count > 0 ? toPercent(step.count, previous.count) : null
        const color = FUNNEL_COLORS[index % FUNNEL_COLORS.length]

        return (
          <div key={step.step}>
            {index > 0 && (
              <div className="flex items-center gap-2 py-1 pl-3 text-[11px] text-slate-400">
                <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                {fromPrevious ? (
                  <span>
                    Конверсія з попереднього кроку:{" "}
                    <span className="font-semibold text-slate-600">{fromPrevious}</span>
                  </span>
                ) : (
                  <span>Немає попереднього кроку для порівняння</span>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{stepLabel(step.step)}</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">
                    {formatNumber(step.count)}
                  </p>
                </div>
                {index === 0 && step.count === 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                    Почніть з подачі відгуків
                  </span>
                )}
              </div>

              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${widthPct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default AnalyticsFunnelPanel

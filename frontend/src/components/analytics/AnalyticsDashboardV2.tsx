import { BarChart3, CalendarRange, Eye, FileText, MessageSquareText, Send, Target } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { fetchAnalyticsDashboard } from "../../api/analytics"
import type { AnalyticsDashboard as DashboardData } from "../../types/analytics"

const periods = [{ value: 7, label: "7 днів" }, { value: 30, label: "30 днів" }, { value: 90, label: "90 днів" }] as const
const num = (v: number) => new Intl.NumberFormat("uk-UA").format(v)
const pct = (a: number, b: number) => (!b ? "0%" : `${((a / b) * 100).toFixed((a / b) * 100 >= 10 ? 0 : 1)}%`)
const date = (v: string, short = false) => new Intl.DateTimeFormat("uk-UA", short ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(v))
const status = (v: string) => v === "applied" ? "Подано" : v === "viewed" ? "Переглянуто" : v === "chat_started" ? "Чат розпочато" : "Невідомо"
const tone = (v: string) => v === "applied" ? "border-sky-200 bg-sky-50 text-sky-700" : v === "viewed" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
const step = (v: string) => v === "profile_views" ? "Перегляди профілю" : v === "resume_views" ? "Перегляди резюме" : v === "applications_sent" ? "Відгуки" : "Переглянуті відгуки"

const chartModel = (rows: DashboardData["timeseries"]) => {
  const width = 840, height = 300, left = 46, right = 18, top = 20, bottom = 36
  const innerW = width - left - right, innerH = height - top - bottom
  const max = Math.max(4, ...rows.flatMap((r) => [r.profile_views, r.resume_views, r.applications_sent]))
  const scale = Math.ceil(max / 4)
  const ceiling = scale * 4
  const x = (i: number) => rows.length <= 1 ? left + innerW / 2 : left + (i / (rows.length - 1)) * innerW
  const y = (v: number) => top + innerH - (v / ceiling) * innerH
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
  const ticks = Array.from({ length: 5 }, (_, i) => ({ value: ceiling - scale * i, y: y(ceiling - scale * i) }))
  const labels = [...new Set(Array.from({ length: Math.min(rows.length, 5) }, (_, i) => Math.round((i * (rows.length - 1)) / Math.max(1, Math.min(rows.length, 5) - 1))))]
  return {
    width, height, ticks,
    profile: line(rows.map((r) => r.profile_views)),
    resume: line(rows.map((r) => r.resume_views)),
    bars: rows.map((r, i) => ({ x: x(i) - 8, y: y(r.applications_sent), h: top + innerH - y(r.applications_sent), v: r.applications_sent, d: r.day })),
    points: rows.map((r, i) => ({ x: x(i), p: y(r.profile_views), r: y(r.resume_views), d: r.day })),
    labels,
  }
}

type Props = { embedded?: boolean; hideLeadCard?: boolean }

const AnalyticsDashboardV2 = ({ embedded = false, hideLeadCard = false }: Props) => {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let off = false
    ;(async () => {
      try {
        setLoading(true); setError(null)
        const next = await fetchAnalyticsDashboard(days)
        if (!off) setData(next)
      } catch (e) {
        if (!off) setError(e instanceof Error ? e.message : "Помилка завантаження аналітики")
      } finally {
        if (!off) setLoading(false)
      }
    })()
    return () => { off = true }
  }, [days])

  const overview = data?.overview
  const timeseries = data?.timeseries ?? []
  const funnel = (data?.funnel ?? []).filter((item) => item.step !== "applications_accepted")
  const apps = data?.applications ?? []
  const chart = useMemo(() => chartModel(timeseries), [timeseries])
  const reacted = (overview?.applications_by_status.viewed ?? 0) + (overview?.applications_by_status.chat_started ?? 0)
  const peak = useMemo(() => timeseries.reduce<{ day: string; total: number } | null>((best, row) => {
    const total = row.profile_views + row.resume_views + row.applications_sent
    return !best || total > best.total ? { day: row.day, total } : best
  }, null), [timeseries])
  const wrap = embedded ? "space-y-6" : "mx-auto max-w-[1180px] px-4 py-8 md:py-10"

  return (
    <div className={wrap}>
      {!hideLeadCard && (
        <section className="rounded-[30px] border border-white/60 bg-[radial-gradient(circle_at_top_left,_rgba(255,138,0,0.16),_transparent_26%),linear-gradient(135deg,#0b1736_0%,#13244d_55%,#20356a_100%)] p-6 text-white shadow-heavy md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80"><BarChart3 className="h-3.5 w-3.5" />Аналітика пошуку роботи</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Тут видно, що реально працює: профіль, резюме чи самі відгуки.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">Стовпчики показують відгуки по днях, а лінії допомагають зрозуміти, чи росте інтерес до профілю та резюме разом із цими діями.</p>
            </div>
            <div className="w-full max-w-[330px] rounded-[26px] border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center justify-between text-white/75"><span className="text-xs font-semibold uppercase tracking-[0.18em]">Період</span><CalendarRange className="h-4 w-4" /></div>
              <select className="mt-3 w-full rounded-2xl border border-white/15 bg-[#0d1b3b]/70 px-4 py-3 text-sm text-white outline-none focus:border-orange-300" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {periods.map((item) => <option key={item.value} value={item.value} className="text-slate-900">{item.label}</option>)}
              </select>
              {overview && <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-2xl bg-white/10 px-4 py-3"><div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Відповіді</div><div className="mt-1 text-xl font-semibold">{pct(reacted, overview.applications_sent)}</div></div><div className="rounded-2xl bg-white/10 px-4 py-3"><div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Пік</div><div className="mt-1 text-base font-semibold">{peak ? date(peak.day, true) : "Немає"}</div></div></div>}
            </div>
          </div>
        </section>
      )}

      {hideLeadCard && <div className="flex justify-end"><select className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-soft outline-none focus:border-orange-400/70" value={days} onChange={(e) => setDays(Number(e.target.value))}>{periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>}
      {error && <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}
      {loading && <div className="mt-6 rounded-3xl border border-white/70 bg-white/85 px-5 py-10 text-sm text-slate-500 shadow-soft">Завантаження аналітики...</div>}

      {!loading && !error && overview && <>
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[{ t: "Перегляди профілю", v: num(overview.profile_views), n: `Унікальні: ${num(overview.profile_viewers_unique)}`, i: Eye, c: "from-[#13244d] to-[#243b77]" }, { t: "Перегляди резюме", v: num(overview.resume_views), n: `Унікальні: ${num(overview.resume_viewers_unique)}`, i: FileText, c: "from-orange-400 to-orange-500" }, { t: "Відгуки", v: num(overview.applications_sent), n: `Конверсія: ${pct(overview.applications_sent, overview.profile_views)}`, i: Send, c: "from-emerald-400 to-emerald-500" }, { t: "Реакції роботодавців", v: num(reacted), n: `Частка: ${pct(reacted, overview.applications_sent)}`, i: MessageSquareText, c: "from-fuchsia-400 to-violet-500" }].map((card) => { const Icon = card.i; return <article key={card.t} className="rounded-[26px] border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur"><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{card.t}</div><div className="mt-3 text-3xl font-semibold text-slate-900">{card.v}</div></div><div className={`rounded-2xl bg-gradient-to-br ${card.c} p-3 text-white`}><Icon className="h-5 w-5" /></div></div><div className="mt-3 text-sm text-slate-500">{card.n}</div></article>})}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_340px]">
          <article className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-medium backdrop-blur md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Динаміка</div><h3 className="mt-1 text-xl font-semibold text-slate-900">Перегляди та відгуки по днях</h3></div><div className="flex flex-wrap gap-2 text-xs text-slate-500"><span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#1d4ed8]" />Профіль</span><span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />Резюме</span><span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />Відгуки</span></div></div>
            {timeseries.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm text-slate-500">За цей період поки немає даних.</div> : <div className="mt-6 overflow-x-auto"><svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="min-w-[700px] w-full" role="img" aria-label="Графік переглядів та відгуків"><rect x="0" y="0" width={chart.width} height={chart.height} rx="26" fill="#f8fafc" />{chart.ticks.map((tick) => <g key={tick.value}><line x1="46" x2={chart.width - 18} y1={tick.y} y2={tick.y} stroke="#dbe4f0" strokeDasharray="4 8" /><text x="38" y={tick.y + 4} textAnchor="end" fill="#94a3b8" fontSize="12">{num(tick.value)}</text></g>)}{chart.bars.map((bar) => <rect key={bar.d} x={bar.x} y={bar.y} width="16" height={Math.max(3, bar.h)} rx="8" fill="#10b981" opacity={bar.v ? 0.9 : 0.25} />)}<path d={chart.profile} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" /><path d={chart.resume} fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />{chart.points.map((point) => <g key={point.d}><circle cx={point.x} cy={point.p} r="3.5" fill="#2563eb" /><circle cx={point.x} cy={point.r} r="3.5" fill="#f97316" /></g>)}{chart.labels.map((index) => <text key={index} x={chart.points[index]?.x} y={chart.height - 12} textAnchor="middle" fill="#94a3b8" fontSize="12">{timeseries[index] ? date(timeseries[index].day, true) : ""}</text>)}</svg></div>}
          </article>

          <div className="space-y-6">
            <article className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-soft"><div className="flex items-center gap-3"><div className="rounded-2xl bg-[#eef4ff] p-3 text-[#1d4ed8]"><Target className="h-5 w-5" /></div><div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Швидкі висновки</div><h3 className="mt-1 text-lg font-semibold text-slate-900">Що видно зараз</h3></div></div><div className="mt-5 space-y-3 text-sm text-slate-600"><div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"><div className="font-semibold text-slate-900">{overview.profile_views >= overview.resume_views ? "Профіль привертає більше уваги" : "Резюме працює краще"}</div><div className="mt-1">Профіль: {num(overview.profile_views)} • Резюме: {num(overview.resume_views)}</div></div><div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"><div className="font-semibold text-slate-900">Реакція роботодавців: {pct(reacted, overview.applications_sent)}</div><div className="mt-1">{num(reacted)} реакцій на {num(overview.applications_sent)} відгуків</div></div>{peak && <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"><div className="font-semibold text-slate-900">Піковий день: {date(peak.day)}</div><div className="mt-1">{num(peak.total)} сумарних дій за день</div></div>}</div></article>
            <article className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-soft"><div className="flex items-center gap-3"><div className="rounded-2xl bg-orange-50 p-3 text-orange-500"><BarChart3 className="h-5 w-5" /></div><div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Воронка</div><h3 className="mt-1 text-lg font-semibold text-slate-900">Від перегляду до відгуку</h3></div></div><div className="mt-5 space-y-3">{funnel.length === 0 ? <div className="text-sm text-slate-500">Немає даних за період.</div> : funnel.map((item) => { const top = Math.max(1, ...funnel.map((f) => f.count)); return <div key={item.step} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"><div className="flex items-start justify-between gap-3"><div className="text-sm font-semibold text-slate-900">{step(item.step)}</div><div className="text-xs text-slate-500">{num(item.count)} • {pct(item.count, funnel[0]?.count || 0)}</div></div><div className="mt-3 h-2.5 rounded-full bg-white"><div className="h-2.5 rounded-full bg-gradient-to-r from-[#13244d] via-[#243b77] to-orange-400" style={{ width: `${Math.max(6, Math.round((item.count / top) * 100))}%` }} /></div></div>})}</div></article>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-medium backdrop-blur md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Мої відгуки</div><h3 className="mt-1 text-xl font-semibold text-slate-900">Подані заявки та їхній статус</h3></div><div className="flex flex-wrap gap-2 text-xs font-semibold">{[{ key: "applied", value: overview.applications_sent }, { key: "viewed", value: overview.applications_by_status.viewed ?? 0 }, { key: "chat_started", value: overview.applications_by_status.chat_started ?? 0 }].map((item) => <span key={item.key} className={`inline-flex items-center rounded-full border px-3 py-1.5 ${tone(item.key)}`}>{status(item.key)}: {num(item.value)}</span>)}</div></div>
          {apps.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm text-slate-500">За цей період ви ще не подавали відгуків.</div> : <div className="mt-6 overflow-x-auto"><table className="min-w-full border-separate border-spacing-y-3 text-left text-sm"><thead><tr className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"><th className="px-3 pb-1">Вакансія</th><th className="px-3 pb-1">Статус</th><th className="px-3 pb-1">Дата</th></tr></thead><tbody>{apps.map((row) => <tr key={row.id} className="bg-slate-50/85"><td className="rounded-l-2xl px-3 py-4"><div className="font-semibold text-slate-900">{row.vacancy_title ?? "Вакансія (назва недоступна)"}</div></td><td className="px-3 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone(row.status)}`}>{status(row.status)}</span></td><td className="rounded-r-2xl px-3 py-4 text-slate-500">{date(row.created_at)}</td></tr>)}</tbody></table></div>}
        </section>
      </>}
    </div>
  )
}

export default AnalyticsDashboardV2

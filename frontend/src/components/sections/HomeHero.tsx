import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import type { UserRole } from "../../types/auth"

interface HomeHeroProps {
  isAuthenticated: boolean
  role: UserRole | null
}

const pulseItems = [
  { label: "Нові вакансії сьогодні", value: "42" },
  { label: "Нові резюме сьогодні", value: "67" },
  { label: "Середня конверсія відгуку", value: "14%" },
]

const funnelStages = [
  { label: "Подано", value: 100, colorClass: "bg-sky-500" },
  { label: "Переглянуто", value: 63, colorClass: "bg-indigo-500" },
  { label: "Інтерв'ю", value: 29, colorClass: "bg-orange-500" },
  { label: "Офер", value: 11, colorClass: "bg-emerald-500" },
]

const HomeHero = ({ isAuthenticated, role }: HomeHeroProps) => {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")

  const searchPath = role === "employer" ? "/candidates" : "/jobs"
  const searchButtonLabel = role === "employer" ? "Шукати кандидатів" : "Шукати вакансії"

  const aiSummaryTo = !isAuthenticated ? "/register?role=employer" : role === "employer" ? "/candidates" : "/dashboard"
  const chatTo = isAuthenticated ? "/messages" : "/login"
  const applicationStatusesTo = isAuthenticated ? "/dashboard" : "/login"

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedQuery = query.trim()
    const params = normalizedQuery ? `?query=${encodeURIComponent(normalizedQuery)}` : ""
    navigate(`${searchPath}${params}`)
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] pb-7 pt-7 text-white sm:pb-12 sm:pt-10 md:pb-16 md:pt-14">
      <div className="pointer-events-none absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-8 top-0 h-44 w-44 rounded-full bg-orange-400/20 blur-3xl" />

      <div className="relative mx-auto max-w-[1120px] px-3 sm:px-4">
        <div>
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/65 sm:text-xs sm:tracking-[0.32em]">TalentUp</p>
            <h1 className="mt-2 text-[1.95rem] font-semibold leading-tight sm:mt-3 sm:text-4xl md:text-5xl">
              Робота та найм в одному місці
            </h1>
            <p className="mx-auto mt-2.5 max-w-2xl text-sm text-white/80 sm:mt-4 sm:text-base">
              Шукайте вакансії, знаходьте кандидатів, відстежуйте відгуки та спілкуйтеся в чаті без перемикання між
              сервісами.
            </p>
          </div>

          <form className="mt-4 flex flex-col gap-2 sm:mt-7 sm:gap-3 md:mt-8 md:flex-row" onSubmit={handleSubmit}>
            <input
              className="h-12 w-full rounded-2xl border border-white/20 bg-white/95 px-4 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-400/70 md:flex-1"
              placeholder="Посада, навички, компанія або локація"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              className="h-12 rounded-2xl bg-orange-500 px-6 text-sm font-semibold text-white transition hover:bg-orange-600"
              type="submit"
            >
              {searchButtonLabel}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-white/80 sm:mt-4 sm:gap-2">
            <Link className="max-w-full rounded-full border border-white/25 bg-white/10 px-3 py-1 transition hover:bg-white/20" to={aiSummaryTo}>
              Короткий опис ШІ
            </Link>
            <Link
              className="max-w-full rounded-full border border-white/25 bg-white/10 px-3 py-1 [overflow-wrap:anywhere] transition hover:bg-white/20"
              to={chatTo}
            >
              Чат роботодавець-працівник
            </Link>
            <Link className="max-w-full rounded-full border border-white/25 bg-white/10 px-3 py-1 transition hover:bg-white/20" to={applicationStatusesTo}>
              Статуси відгуків
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 sm:mt-7 sm:gap-3">
            {!isAuthenticated && (
              <>
                <Link className="inline-flex h-11 items-center rounded-2xl bg-orange-500 px-5 text-sm font-semibold text-white transition hover:bg-orange-600 sm:h-12 sm:px-6" to="/register">
                  Я шукаю роботу
                </Link>
                <Link className="inline-flex h-11 items-center rounded-2xl border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/15 sm:h-12 sm:px-6" to="/register?role=employer">
                  Я роботодавець
                </Link>
              </>
            )}
            {isAuthenticated && role === "worker" && (
              <>
                <Link className="inline-flex h-11 items-center rounded-2xl bg-orange-500 px-5 text-sm font-semibold text-white transition hover:bg-orange-600 sm:h-12 sm:px-6" to="/jobs">
                  До пошуку вакансій
                </Link>
                <Link className="inline-flex h-11 items-center rounded-2xl border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/15 sm:h-12 sm:px-6" to="/dashboard">
                  Мій кабінет
                </Link>
              </>
            )}
            {isAuthenticated && role === "employer" && (
              <>
                <Link className="inline-flex h-11 items-center rounded-2xl bg-orange-500 px-5 text-sm font-semibold text-white transition hover:bg-orange-600 sm:h-12 sm:px-6" to="/candidates">
                  До бази кандидатів
                </Link>
                <Link className="inline-flex h-11 items-center rounded-2xl border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/15 sm:h-12 sm:px-6" to="/dashboard">
                  Керувати вакансіями
                </Link>
              </>
            )}
          </div>
        </div>

        <aside className="mt-6 rounded-3xl border border-white/20 bg-white/10 p-4 shadow-medium backdrop-blur-md sm:mt-8 sm:p-5 md:p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-white/65 sm:tracking-[0.25em]">Market pulse</p>
          <h2 className="mt-2 text-lg font-semibold text-white sm:text-xl">Операційна панель найму</h2>

          <div className="mt-3 grid gap-2.5 sm:mt-4 sm:gap-3 md:grid-cols-3">
            {pulseItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-white/15 bg-[#0b1736]/55 px-3 py-2.5 sm:px-4 sm:py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/65 sm:text-[11px]">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-white/15 bg-[#0b1736]/55 p-3 sm:mt-4 sm:p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/65 sm:text-[11px]">Pipeline</p>
            <div className="mt-2.5 space-y-2.5 sm:mt-3">
              {funnelStages.map((stage) => (
                <div key={stage.label}>
                  <div className="flex items-center justify-between text-xs text-white/80">
                    <span>{stage.label}</span>
                    <span>{stage.value}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${stage.colorClass}`} style={{ width: `${stage.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default HomeHero

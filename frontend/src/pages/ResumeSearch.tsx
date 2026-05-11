import { useMemo, useState, type FormEvent } from "react"
import Navbar from "../components/layout/Navbar"
import { searchResumesByTitle } from "../api/resumeSearch"
import type { Resume } from "../types/resume"

const PAGE_SIZE = 12

const formatSalary = (resume: Resume) => {
  const min = resume.salary_min ?? undefined
  const max = resume.salary_max ?? undefined
  const currency = resume.salary_currency ?? "UAH"

  if (min && max) {
    return `${min}-${max} ${currency}`
  }
  if (min) {
    return `від ${min} ${currency}`
  }
  if (max) {
    return `до ${max} ${currency}`
  }
  return "Зарплата не вказана"
}

const formatExperience = (resume: Resume) => {
  if (resume.years_experience === null || resume.years_experience === undefined) {
    return "Досвід не вказано"
  }
  return `${resume.years_experience} років досвіду`
}

const formatEmployment = (resume: Resume) => {
  if (!resume.employment_type?.length) {
    return "Формат не вказано"
  }
  return resume.employment_type.join(", ")
}

const formatLocation = (resume: Resume) => {
  if (resume.location) {
    return resume.location
  }
  return "Локація не вказана"
}

const ResumeSearch = () => {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Resume[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const canSearch = query.trim().length >= 2

  const statsLabel = useMemo(() => {
    if (!hasSearched) {
      return "Введіть назву резюме та натисніть «Пошук»"
    }
    if (total === 0) {
      return "Нічого не знайдено"
    }
    return `Знайдено: ${total}`
  }, [hasSearched, total])

  const runSearch = async (nextOffset = 0, append = false) => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setTotal(0)
      setHasMore(false)
      setHasSearched(true)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await searchResumesByTitle({
        resume_name: term,
        limit: PAGE_SIZE,
        offset: nextOffset,
      })

      const incoming = data.resumes ?? []
      const responseTotal = typeof data.total === "number"
        ? data.total
        : nextOffset + incoming.length
      const loadedCount = nextOffset + incoming.length
      setResults((prev) => (append ? [...prev, ...incoming] : incoming))
      setTotal(responseTotal)
      setOffset(nextOffset)
      setHasMore(responseTotal > loadedCount)
      setHasSearched(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося виконати пошук"
      setError(message)
      setHasSearched(true)
      if (!append) {
        setResults([])
        setTotal(0)
        setHasMore(false)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    runSearch(0, false)
  }

  const handleLoadMore = () => {
    runSearch(offset + PAGE_SIZE, true)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-[1120px] px-4 py-10">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-medium md:p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Пошук працівників</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-slate-900 md:text-3xl">
            Знайдіть резюме за назвою
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Введіть назву резюме або позицію. Пошук нечутливий до регістру та працює по часткових
            співпадіннях.
          </p>

          <form className="mt-5 flex flex-col gap-3 md:flex-row" onSubmit={handleSubmit}>
            <div className="relative flex-1">
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-400/70"
                placeholder="Наприклад: Frontend Developer"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button
              className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={!canSearch || isLoading}
            >
              {isLoading ? "Пошук..." : "Пошук"}
            </button>
          </form>

          <div className="mt-3 text-sm text-slate-500">{statsLabel}</div>
          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        </section>

        <section className="mt-8">
          <div className="grid gap-5 md:grid-cols-2">
            {results.map((resume) => (
              <article
                key={resume.id}
                className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-soft"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{resume.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {resume.desired_role || "Бажана роль не вказана"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      resume.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {resume.is_active ? "Активне" : "Неактивне"}
                  </span>
                </div>

                {resume.summary && (
                  <p className="mt-3 text-sm text-slate-600">{resume.summary}</p>
                )}

                <div className="mt-4 space-y-1 text-sm text-slate-600">
                  <div>Локація: {formatLocation(resume)}</div>
                  <div>Формат: {formatEmployment(resume)}</div>
                  <div>Зарплата: {formatSalary(resume)}</div>
                  <div>Досвід: {formatExperience(resume)}</div>
                </div>
              </article>
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                className="rounded-2xl border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? "Завантаження..." : "Показати ще"}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default ResumeSearch

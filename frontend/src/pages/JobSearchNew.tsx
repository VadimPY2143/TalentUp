import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import Navbar from "../components/layout/Navbar"
import VacancyModal from "../components/VacancyModal"
import { fetchRecommendedVacancies, searchVacancies } from "../api/vacancies"
import type { VacancyResponse } from "../types/vacancy"
import { useAuth } from "../auth/useAuth"

interface FilterState {
  location: string
  yearsExperienceMin: string
  yearsExperienceMax: string
  salaryMin: string
  salaryMax: string
  salaryCurrency: string
  employmentTypes: string[]
  workFormats: string[]
}

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isLoading: boolean
}

interface FiltersPanelProps {
  filters: FilterState
  onToggleEmployment: (value: string) => void
  onToggleWorkFormat: (value: string) => void
  onUpdateField: (field: keyof FilterState, value: string | boolean) => void
  onClear: () => void
}

interface ResultsHeaderProps {
  total: number
  isLoading: boolean
  isRecommendationMode: boolean
}

interface VacancyCardProps {
  vacancy: VacancyResponse
  onViewDetails: () => void
  onApply: () => void
}

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

const PAGE_SIZE = 6

const employmentTypeOptions = [
  { value: "Full-time", label: "Full-time" },
  { value: "Part-time", label: "Part-time" },
]

const workFormatOptions = [
  { value: "Remote", label: "Remote" },
  { value: "Office", label: "Office" },
  { value: "Hybrid", label: "Hybrid" },
]

const currencyOptions = ["UAH", "USD", "EUR"] as const

const initialFilters: FilterState = {
  location: "",
  yearsExperienceMin: "",
  yearsExperienceMax: "",
  salaryMin: "",
  salaryMax: "",
  salaryCurrency: "",
  employmentTypes: [],
  workFormats: [],
}

const parseNumber = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  const numberValue = Number(trimmed)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

const formatSalary = (vacancy: VacancyResponse) => {
  const min = vacancy.salary_min ?? undefined
  const max = vacancy.salary_max ?? undefined
  const currency = vacancy.salary_currency ?? "UAH"

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

const formatExperience = (min?: number | null, max?: number | null) => {
  if (min === null || min === undefined) {
    if (max === null || max === undefined) {
      return "Досвід не вказано"
    }
    return `до ${max} років`
  }
  if (max === null || max === undefined) {
    return `від ${min} років`
  }
  if (min === max) {
    return `${min} років`
  }
  return `${min}-${max} років`
}

const formatLocation = (vacancy: VacancyResponse) => {
  if (vacancy.location) {
    return vacancy.location
  }
  return "Локація не вказана"
}

const normalizeBadgeList = (
  value: string[] | string | null | undefined,
  allowedValues: readonly string[],
): string[] => {
  if (!value) {
    return []
  }
  const allowedMap = new Map(allowedValues.map((item) => [item.toLowerCase(), item]))
  const normalized = new Set<string>()

  const addFromText = (text: string) => {
    const parts = text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

    for (const part of parts) {
      const exact = allowedMap.get(part.toLowerCase())
      if (exact) {
        normalized.add(exact)
      }
    }

    const lowered = text.toLowerCase()
    for (const allowedValue of allowedValues) {
      if (lowered.includes(allowedValue.toLowerCase())) {
        normalized.add(allowedValue)
      }
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim()) {
        addFromText(item)
      }
    }
    addFromText(value.join(""))
  } else {
    addFromText(value)
  }

  return Array.from(normalized)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  })
}

const SearchBar = ({ value, onChange, onSubmit, isLoading }: SearchBarProps) => (
  <form className="mt-5 flex flex-col gap-3 md:flex-row" onSubmit={onSubmit}>
    <div className="relative flex-1">
      <input
        className="w-full rounded-2xl border border-white/25 bg-white/95 px-5 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-400/70"
        placeholder="Посада, компанія, навички (наприклад: Frontend Developer, React, Київ)"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
    <button
      className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
      type="submit"
      disabled={isLoading}
    >
      {isLoading ? "Пошук..." : "Пошук вакансій"}
    </button>
  </form>
)

const FiltersPanel = ({
  filters,
  onToggleEmployment,
  onToggleWorkFormat,
  onUpdateField,
  onClear,
}: FiltersPanelProps) => (
  <aside className="h-full rounded-[26px] border border-slate-200 bg-white p-5 shadow-medium">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Фільтри</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">Налаштування пошуку</h2>
      </div>
      <button
        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400"
        type="button"
        onClick={onClear}
      >
        Очистити
      </button>
    </div>

    <div className="mt-5 space-y-4 text-sm text-slate-700">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Локація
        </label>
        <input
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-400/70"
          placeholder="Київ, Львів, Ukraine (Remote)"
          value={filters.location}
          onChange={(event) => onUpdateField("location", event.target.value)}
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Досвід (роки)
        </label>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-400/70"
            placeholder="Від"
            type="number"
            value={filters.yearsExperienceMin}
            onChange={(event) => onUpdateField("yearsExperienceMin", event.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-400/70"
            placeholder="До"
            type="number"
            value={filters.yearsExperienceMax}
            onChange={(event) => onUpdateField("yearsExperienceMax", event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Зарплата
        </label>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-400/70"
            placeholder="Від"
            type="number"
            value={filters.salaryMin}
            onChange={(event) => onUpdateField("salaryMin", event.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-400/70"
            placeholder="До"
            type="number"
            value={filters.salaryMax}
            onChange={(event) => onUpdateField("salaryMax", event.target.value)}
          />
        </div>
        <select
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-orange-400/70"
          value={filters.salaryCurrency}
          onChange={(event) => onUpdateField("salaryCurrency", event.target.value)}
        >
          <option value="">Будь-яка валюта</option>
          {currencyOptions.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Тип зайнятості
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {employmentTypeOptions.map((option) => {
            const active = filters.employmentTypes.includes(option.value)
            return (
              <button
                key={option.value}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-orange-400 bg-orange-100 text-orange-700"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
                type="button"
                onClick={() => onToggleEmployment(option.value)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Формат роботи
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {workFormatOptions.map((option) => {
            const active = filters.workFormats.includes(option.value)
            return (
              <button
                key={option.value}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-blue-400 bg-blue-100 text-blue-700"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
                type="button"
                onClick={() => onToggleWorkFormat(option.value)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  </aside>
)

const ResultsHeader = ({
  total,
  isLoading,
  isRecommendationMode,
}: ResultsHeaderProps) => (
  <div className="flex flex-col gap-4 rounded-[26px] border border-slate-200 bg-white p-5 shadow-medium sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
        {isRecommendationMode ? "Рекомендації" : "Результати"}
      </p>
      <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
        {isRecommendationMode ? "Рекомендовані вакансії" : `Знайдено ${total} вакансій`}
      </h2>
      {isLoading && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
          Завантаження результатів...
        </div>
      )}
    </div>
  </div>
)

const VacancyCard = ({
  vacancy,
  onViewDetails,
  onApply,
}: VacancyCardProps) => {
  const employment = normalizeBadgeList(
    [...(vacancy.employment_type ?? []), ...(vacancy.work_format ?? [])],
    employmentTypeOptions.map((option) => option.value),
  )
  const workFormats = normalizeBadgeList(
    [...(vacancy.work_format ?? []), ...(vacancy.employment_type ?? [])],
    workFormatOptions.map((option) => option.value),
  )

  return (
    <article className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-orange-300">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-900">{vacancy.title}</h3>
            <p className="mt-1 text-sm text-slate-600">Компанія</p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {formatExperience(vacancy.experience_years_min, vacancy.experience_years_max)}
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-600 line-clamp-3">
          {vacancy.description}
        </p>

        {vacancy.responsibilities && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Обов'язки</p>
            <p className="mt-1 text-sm text-slate-600 line-clamp-2">{vacancy.responsibilities}</p>
          </div>
        )}

        {vacancy.requirements && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Вимоги</p>
            <p className="mt-1 text-sm text-slate-600 line-clamp-2">{vacancy.requirements}</p>
          </div>
        )}

        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Локація</span>
            <span className="font-semibold text-slate-800">{formatLocation(vacancy)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Зарплата</span>
            <span className="font-semibold text-slate-800">{formatSalary(vacancy)}</span>
          </div>
        </div>

        {employment.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            {employment.map((type) => (
              <span key={type} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-orange-700">
                {type}
              </span>
            ))}
          </div>
        )}

        {workFormats.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            {workFormats.map((format) => (
              <span key={format} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
                {format}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="flex-1 rounded-lg bg-[#1f2f5e] px-4 py-2.5 text-xs font-semibold text-white shadow-soft transition hover:bg-[#1b294f]"
          type="button"
          onClick={onViewDetails}
        >
          Детальніше
        </button>
        <button
          className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
          type="button"
          onClick={onApply}
        >
          Відгукнутися
        </button>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Опубліковано: {formatDate(vacancy.created_at)}
      </div>
    </article>
  )
}

const Pagination = ({ page, totalPages, onPageChange }: PaginationProps) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
    <div className="flex items-center justify-between gap-3">
      <button
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
      >
        Попередня
      </button>
      <div className="text-xs font-semibold text-slate-600">
        Сторінка {page} з {totalPages}
      </div>
      <button
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
      >
        Наступна
      </button>
    </div>
  </div>
)

const JobSearchNew = () => {
  const { isAuthenticated, role } = useAuth()
  const [searchInput, setSearchInput] = useState("")
  const [query, setQuery] = useState("")
  const [searchTrigger, setSearchTrigger] = useState(0)
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [vacancies, setVacancies] = useState<VacancyResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedVacancy, setSelectedVacancy] = useState<VacancyResponse | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasQuery = query.trim().length >= 2

  const searchParams = useMemo(
    () => ({
      query: query || undefined,
      location: filters.location.trim() || undefined,
      experience_years_min: parseNumber(filters.yearsExperienceMin),
      experience_years_max: parseNumber(filters.yearsExperienceMax),
      salary_min: parseNumber(filters.salaryMin),
      salary_max: parseNumber(filters.salaryMax),
      salary_currency: filters.salaryCurrency || undefined,
      employment_type: filters.employmentTypes.length ? filters.employmentTypes : undefined,
      work_format: filters.workFormats.length ? filters.workFormats : undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    [filters, page, query],
  )

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  useEffect(() => {
    if (!isAuthenticated) {
      setVacancies([])
      setTotal(0)
      setError("Увійдіть у акаунт, щоб шукати вакансії.")
      setIsLoading(false)
      return
    }

    if (role !== "worker") {
      setVacancies([])
      setTotal(0)
      setError("Пошук вакансій доступний лише для шукачів роботи.")
      setIsLoading(false)
      return
    }

    let mounted = true
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = hasQuery
          ? await searchVacancies(searchParams, controller.signal)
          : await fetchRecommendedVacancies(
              PAGE_SIZE,
              (page - 1) * PAGE_SIZE,
              {
                location: searchParams.location,
                experience_years_min: searchParams.experience_years_min,
                experience_years_max: searchParams.experience_years_max,
                salary_min: searchParams.salary_min,
                salary_max: searchParams.salary_max,
                salary_currency: searchParams.salary_currency,
                employment_type: searchParams.employment_type,
                work_format: searchParams.work_format,
              },
              controller.signal,
            )
        if (!mounted) {
          return
        }
        setVacancies(response?.items ?? [])
        setTotal(response?.total ?? 0)
      } catch (err) {
        if (!mounted) {
          return
        }
        if (err instanceof DOMException && err.name === "AbortError") {
          return
        }
        const message = err instanceof Error ? err.message : "Помилка завантаження результатів"
        setError(message)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }, 200)

    return () => {
      mounted = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [hasQuery, isAuthenticated, page, role, searchParams, searchTrigger])

  const updateFilters = (field: keyof FilterState, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(1)
  }

  const toggleEmploymentType = (value: string) => {
    setFilters((prev) => {
      const exists = prev.employmentTypes.includes(value)
      const next = exists
        ? prev.employmentTypes.filter((item) => item !== value)
        : [...prev.employmentTypes, value]
      return { ...prev, employmentTypes: next }
    })
    setPage(1)
  }

  const toggleWorkFormat = (value: string) => {
    setFilters((prev) => {
      const exists = prev.workFormats.includes(value)
      const next = exists
        ? prev.workFormats.filter((item) => item !== value)
        : [...prev.workFormats, value]
      return { ...prev, workFormats: next }
    })
    setPage(1)
  }

  const clearFilters = () => {
    setFilters(initialFilters)
    setPage(1)
  }

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setQuery(searchInput.trim())
    setPage(1)
    setSearchTrigger((prev) => prev + 1)
  }

  const handleViewDetails = (vacancy: VacancyResponse) => {
    setActionError(null)
    setSelectedVacancy(vacancy)
  }

  const handleApply = (vacancyId: number) => {
    setActionError(null)
    // TODO: Implement application functionality
    console.log("Apply to vacancy:", vacancyId)
    setSelectedVacancy(null) // Close modal after applying
  }

  const handleModalClose = () => {
    setSelectedVacancy(null)
  }

  const showEmptyState = !isLoading && !error && vacancies.length === 0

  return (
    <div className="min-h-screen bg-[#e9edf4]">
      <Navbar />

      <div className="mx-auto max-w-[1240px] px-4 pb-12 pt-8">
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-6 text-white shadow-medium md:p-8">
          <div className="pointer-events-none absolute -right-12 top-2 h-44 w-44 rounded-full bg-orange-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />

          <div className="relative">
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">
              База вакансій
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold md:text-3xl">
              Пошук вакансій
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-white/70">
              Знайдіть ідеальну роботу за ключовими словами, локацією та умовами праці.
            </p>
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              onSubmit={handleSearchSubmit}
              isLoading={isLoading}
            />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px,1fr]">
          <FiltersPanel
            filters={filters}
            onToggleEmployment={toggleEmploymentType}
            onToggleWorkFormat={toggleWorkFormat}
            onUpdateField={updateFilters}
            onClear={clearFilters}
          />

          <div className="space-y-4">
            <ResultsHeader
              total={total}
              isLoading={isLoading}
              isRecommendationMode={!hasQuery}
            />

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {actionError && (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                {actionError}
              </div>
            )}
            {showEmptyState && (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-soft">
                Нічого не знайдено. Спробуйте змінити фільтри або уточнити запит.
              </div>
            )}

            {vacancies.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {vacancies.map((vacancy) => (
                  <VacancyCard
                    key={vacancy.id}
                    vacancy={vacancy}
                    onViewDetails={() => handleViewDetails(vacancy)}
                    onApply={() => handleApply(vacancy.id)}
                  />
                ))}
              </div>
            )}

            {totalPages > 1 && !error && (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}
          </div>
        </div>
      </div>

      <VacancyModal
        vacancy={selectedVacancy}
        onClose={handleModalClose}
        onApply={() => selectedVacancy && handleApply(selectedVacancy.id)}
      />
    </div>
  )
}

export default JobSearchNew

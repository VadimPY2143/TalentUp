import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import { useSearchParams } from "react-router-dom"
import CityAutocomplete from "../components/CityAutocomplete"
import AISparkleIcon from "../components/icons/AISparkleIcon"
import Navbar from "../components/layout/Navbar"
import { useChatWidget } from "../chat/ChatWidgetContext"
import ResumeModal from "../components/ResumeModal"
import {
  fetchCandidateResumeSummary,
  fetchRecommendedCandidates,
  listSavedResumesByCompany,
  openCandidateResume,
  saveCandidateResume,
  searchCandidates,
} from "../api/candidates"
import { trackAnalyticsEvent } from "../api/analytics"
import { listCompanies } from "../api/companies"
import { listCompanyVacancies } from "../api/vacancies"
import { redirectToPaymentOnInsufficientCredits } from "../payments/insufficientCredits"
import type { ChatResumeResponse } from "../types/chat"
import type { CityOption } from "../types/city"
import type { CandidateSearchItem, CandidateSort } from "../types/candidate"
import type { VacancyResponse } from "../types/vacancy"

interface FilterState {
  cityId: number | null
  location: string
  yearsExperience: string
  salaryMin: string
  salaryMax: string
  salaryCurrency: string
  employmentTypes: string[]
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
  onUpdateField: (field: keyof FilterState, value: string | boolean) => void
  onCitySelect: (option: CityOption | null) => void
  onClear: () => void
}

interface ResultsHeaderProps {
  total: number
  sort: CandidateSort
  onSortChange: (value: CandidateSort) => void
  isLoading: boolean
  isRecommendationMode: boolean
}

interface CandidateCardProps {
  candidate: CandidateSearchItem
  isSaved: boolean
  isSaving: boolean
  isSummaryLoading: boolean
  onToggleSave: () => void
  onViewResume: (candidate: CandidateSearchItem) => void
  onViewSummary: () => void
  onStartChat: () => void
}

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

const PAGE_SIZE = 4

const employmentTypeOptions = [
  { value: "Remote", label: "Remote" },
  { value: "Office", label: "Office" },
  { value: "Hybrid", label: "Hybrid" },
]
const currencyOptions = ["UAH", "USD", "EUR"] as const

const sortOptions: Array<{ value: CandidateSort; label: string }> = [
  { value: "relevance", label: "За відповідністю" },
  { value: "date", label: "За датою додавання" },
  { value: "experience", label: "За досвідом" },
]

const initialFilters: FilterState = {
  cityId: null,
  location: "",
  yearsExperience: "",
  salaryMin: "",
  salaryMax: "",
  salaryCurrency: "",
  employmentTypes: [],
}

const parseNumber = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  const numberValue = Number(trimmed)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

const normalizeEmploymentTypes = (value: string[] | null | undefined): string[] => {
  if (!value?.length) {
    return []
  }

  const normalized = new Set<string>()
  for (const item of value) {
    const token = item.trim().toLowerCase().replace(/[\s_-]/g, "")
    if (token === "remote") {
      normalized.add("Remote")
    } else if (token === "hybrid") {
      normalized.add("Hybrid")
    } else if (token === "office" || token === "onsite" || token === "offline") {
      normalized.add("Office")
    }
  }

  return Array.from(normalized)
}

const formatSalary = (candidate: CandidateSearchItem) => {
  const min = candidate.salary_min ?? undefined
  const max = candidate.salary_max ?? undefined
  const currency = candidate.salary_currency ?? "UAH"

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

const formatExperience = (years?: number | null) => {
  if (years === null || years === undefined) {
    return "Досвід не вказано"
  }
  return `${years} років досвіду`
}

const formatLocation = (candidate: CandidateSearchItem) => {
  if (candidate.location) {
    return candidate.location
  }
  return "Локація не вказана"
}

const SearchBar = ({ value, onChange, onSubmit, isLoading }: SearchBarProps) => (
  <form className="mt-5 flex flex-col gap-3 md:flex-row" onSubmit={onSubmit}>
    <div className="relative flex-1">
      <input
        className="w-full rounded-2xl border border-white/25 bg-white/95 px-5 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-400/70"
        placeholder="Посада, навички, технології (наприклад: UX дизайнер, React, Node.js)"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
    <button
      className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
      type="submit"
      disabled={isLoading}
    >
      {isLoading ? "Пошук..." : "Пошук кандидатів"}
    </button>
  </form>
)

const FiltersPanel = ({
  filters,
  onToggleEmployment,
  onUpdateField,
  onCitySelect,
  onClear,
}: FiltersPanelProps) => (
  <aside className="h-fit self-start rounded-[26px] border border-slate-200 bg-white p-5 shadow-medium">
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

    <div className="mt-4 space-y-3 text-sm text-slate-700">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Локація
        </label>
        <CityAutocomplete
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-400/70"
          placeholder="Оберіть місто"
          value={filters.location}
          onChange={(value) => onUpdateField("location", value)}
          onOptionSelect={onCitySelect}
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Досвід (роки)
        </label>
        <select
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-orange-400/70"
          value={filters.yearsExperience}
          onChange={(event) => onUpdateField("yearsExperience", event.target.value)}
        >
          <option value="">Будь-який</option>
          <option value="0">До 1 року</option>
          <option value="1">1 рік</option>
          <option value="2">2 роки</option>
          <option value="3">3 роки</option>
          <option value="4">4 роки</option>
          <option value="5">5 років</option>
          <option value="6">6 років</option>
          <option value="7">7 років</option>
          <option value="8">8 років</option>
          <option value="9">9 років</option>
          <option value="10">10+ років</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Зарплата
        </label>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-400/70"
            placeholder="Від"
            type="number"
            value={filters.salaryMin}
            onChange={(event) => onUpdateField("salaryMin", event.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-400/70"
            placeholder="До"
            type="number"
            value={filters.salaryMax}
            onChange={(event) => onUpdateField("salaryMax", event.target.value)}
          />
        </div>
        <select
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-orange-400/70"
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
          Формат роботи
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
    </div>
  </aside>
)

const ResultsHeader = ({
  total,
  sort,
  onSortChange,
  isLoading,
  isRecommendationMode,
}: ResultsHeaderProps) => (
  <div className="flex flex-col gap-4 rounded-[26px] border border-slate-200 bg-white p-5 shadow-medium sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
        {isRecommendationMode ? "Рекомендації" : "Результати"}
      </p>
      <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
        {isRecommendationMode ? "Рекомендовані резюме" : `Знайдено ${total} резюме`}
      </h2>
      {isLoading && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
          Завантаження результатів...
        </div>
      )}
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Сортування
      </span>
      <select
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-orange-400/70"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as CandidateSort)}
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  </div>
)

const CandidateCard = ({
  candidate,
  isSaved,
  isSaving,
  isSummaryLoading,
  onToggleSave,
  onViewResume,
  onViewSummary,
  onStartChat,
}: CandidateCardProps) => {
  const title = candidate.title || candidate.desired_role || "Резюме"
  const role = candidate.desired_role || "Позиція не вказана"
  const employment = normalizeEmploymentTypes(candidate.employment_type)
  const summaryLength = candidate.summary?.trim().length ?? 0
  const showAiSummary = summaryLength >= 500

  return (
    <article className="flex h-[430px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-orange-300">
      <div className="min-h-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="line-clamp-2 text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 line-clamp-1 text-sm text-slate-600">{role}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {showAiSummary && (
              <button
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#1f2f5e] px-3 py-1.5 text-[11px] font-semibold text-white shadow-soft transition hover:bg-[#1b294f] disabled:cursor-not-allowed disabled:opacity-70"
                type="button"
                onClick={onViewSummary}
                disabled={isSummaryLoading}
              >
                {isSummaryLoading ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
                    Loading
                  </>
                ) : (
                  <>
                    <AISparkleIcon className="h-5 w-5 text-cyan-200" />
                    AI Summary
                  </>
                )}
              </button>
            )}
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {formatExperience(candidate.years_experience)}
            </div>
          </div>
        </div>

        {candidate.summary && (
          <p className="mt-3 line-clamp-6 text-sm text-slate-600">{candidate.summary}</p>
        )}

        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Локація</span>
            <span className="font-semibold text-slate-800">{formatLocation(candidate)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Очікування</span>
            <span className="font-semibold text-slate-800">{formatSalary(candidate)}</span>
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
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="flex-1 rounded-lg bg-[#1f2f5e] px-4 py-2.5 text-xs font-semibold text-white shadow-soft transition hover:bg-[#1b294f] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={() => onViewResume(candidate)}
        >
          Відкрити резюме
        </button>
        <button
          className="flex-1 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
          type="button"
          onClick={onStartChat}
        >
          Написати кандидату
        </button>
        <button
          className={`flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700 ${
            isSaved
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
              : ""
          }`}
          type="button"
          onClick={onToggleSave}
          disabled={isSaved || isSaving}
        >
          {isSaving ? "Збереження..." : isSaved ? "Збережено" : "Зберегти кандидата"}
        </button>
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

const CandidateSearch = () => {
  const { open: openChatWidget } = useChatWidget()
  const [urlSearchParams] = useSearchParams()
  const queryFromParams = (urlSearchParams.get("query") ?? "").trim()
  const [searchInput, setSearchInput] = useState(queryFromParams)
  const [query, setQuery] = useState(queryFromParams)
  const [searchTrigger, setSearchTrigger] = useState(0)
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [sort, setSort] = useState<CandidateSort>("relevance")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [candidates, setCandidates] = useState<CandidateSearchItem[]>([])
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isVacanciesLoading, setIsVacanciesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [vacancies, setVacancies] = useState<VacancyResponse[]>([])
  const [chatVacancyId, setChatVacancyId] = useState<string>("")
  const [chatModal, setChatModal] = useState<{
    candidateResumeId: number
    candidateTitle: string
  } | null>(null)
  const [summaryModal, setSummaryModal] = useState<{
    candidateId: number
    title: string
    summary: string
    strengths: string[]
    cached: boolean
  } | null>(null)
  const [summaryLoadingId, setSummaryLoadingId] = useState<number | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [openedResume, setOpenedResume] = useState<ChatResumeResponse | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasQuery = query.trim().length >= 2

  const searchParams = useMemo(
    () => ({
      query: query || undefined,
      city_id: filters.cityId ?? undefined,
      location: filters.location.trim() || undefined,
      years_experience: parseNumber(filters.yearsExperience),
      salary_min: parseNumber(filters.salaryMin),
      salary_max: parseNumber(filters.salaryMax),
      salary_currency: filters.salaryCurrency || undefined,
      employment_type: filters.employmentTypes.length ? filters.employmentTypes : undefined,
      page,
      page_size: PAGE_SIZE,
      sort,
    }),
    [filters, page, query, sort],
  )

  useEffect(() => {
    if (!summaryModal && !chatModal) {
      return
    }

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [chatModal, summaryModal])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  useEffect(() => {
    setSearchInput(queryFromParams)
    setQuery(queryFromParams)
    setPage(1)
    setSearchTrigger((prev) => prev + 1)
  }, [queryFromParams])

  useEffect(() => {
    let mounted = true

    const loadPrimaryCompany = async () => {
      try {
        const companies = await listCompanies()
        if (!mounted) {
          return
        }
        setCompanyId(companies[0]?.id ?? null)
      } catch {
        if (mounted) {
          setCompanyId(null)
        }
      }
    }

    loadPrimaryCompany()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!companyId) {
      setSavedIds(new Set())
      return
    }

    let mounted = true
    const loadSavedResumes = async () => {
      try {
        const savedResumes = await listSavedResumesByCompany(companyId)
        if (!mounted) {
          return
        }
        setSavedIds(new Set(savedResumes.map((resume) => resume.id)))
      } catch {
        if (mounted) {
          setSavedIds(new Set())
        }
      }
    }

    loadSavedResumes()
    return () => {
      mounted = false
    }
  }, [companyId])

  useEffect(() => {
    if (!companyId) {
      setVacancies([])
      setChatVacancyId("")
      return
    }

    let mounted = true
    const loadVacancies = async () => {
      setIsVacanciesLoading(true)
      try {
        const companyVacancies = await listCompanyVacancies(companyId)
        if (!mounted) {
          return
        }
        setVacancies(companyVacancies)
        setChatVacancyId(companyVacancies[0] ? String(companyVacancies[0].id) : "")
      } catch {
        if (mounted) {
          setVacancies([])
          setChatVacancyId("")
        }
      } finally {
        if (mounted) {
          setIsVacanciesLoading(false)
        }
      }
    }

    void loadVacancies()
    return () => {
      mounted = false
    }
  }, [companyId])

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = hasQuery
          ? await searchCandidates(searchParams, controller.signal)
          : await fetchRecommendedCandidates(
              PAGE_SIZE,
              (page - 1) * PAGE_SIZE,
              {
                location: searchParams.location,
                city_id: searchParams.city_id,
                years_experience: searchParams.years_experience,
                salary_min: searchParams.salary_min,
                salary_max: searchParams.salary_max,
                salary_currency: searchParams.salary_currency,
                employment_type: searchParams.employment_type,
              },
              controller.signal,
            )
        if (!mounted) {
          return
        }
        setCandidates(response?.items ?? [])
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
  }, [searchParams, searchTrigger])

  const updateFilters = (field: keyof FilterState, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(1)
  }

  const handleCitySelect = (option: CityOption | null) => {
    setFilters((prev) => ({
      ...prev,
      cityId: option?.id ?? null,
      location: option?.name_uk ?? prev.location,
    }))
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

  const toggleSave = async (candidateId: number) => {
    if (savedIds.has(candidateId) || savingIds.has(candidateId)) {
      return
    }
    if (!companyId) {
      setActionError("Спочатку створіть компанію в кабінеті роботодавця")
      return
    }

    setActionError(null)
    setSavingIds((prev) => new Set(prev).add(candidateId))
    try {
      await saveCandidateResume(companyId, candidateId)
      setSavedIds((prev) => new Set(prev).add(candidateId))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося зберегти кандидата"
      setActionError(message)
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(candidateId)
        return next
      })
    }
  }

  const handleViewResume = async (candidate: CandidateSearchItem) => {
    const resume: ChatResumeResponse = {
      id: candidate.id,
      user_id: candidate.user_id ?? 0,
      title: candidate.title || candidate.desired_role || "Резюме",
      summary: candidate.summary ?? null,
      desired_role: candidate.desired_role ?? null,
      employment_type: candidate.employment_type ?? null,
      location: candidate.location ?? null,
      salary_min: candidate.salary_min ?? null,
      salary_max: candidate.salary_max ?? null,
      salary_currency: candidate.salary_currency ?? null,
      years_experience: candidate.years_experience ?? null,
      is_active: Boolean(candidate.is_active),
      pdf_file_path: candidate.pdf_file_path ?? null,
      pdf_original_name: candidate.pdf_original_name ?? null,
      pdf_size: candidate.pdf_size ?? null,
      pdf_uploaded_at: candidate.pdf_uploaded_at ?? null,
      created_at: candidate.created_at ?? candidate.updated_at ?? new Date().toISOString(),
      updated_at: candidate.updated_at ?? candidate.created_at ?? new Date().toISOString(),
    }
    setOpenedResume(resume)
    if (candidate.id > 0) {
      try {
        await trackAnalyticsEvent({ event_type: "resume_view", target_resume_id: candidate.id })
      } catch {
        // Analytics must not block resume modal UX.
      }
    }
  }

  const handleOpenResumePdf = async () => {
    if (!openedResume?.pdf_file_path) {
      return
    }
    setActionError(null)
    try {
      await openCandidateResume(openedResume.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося відкрити резюме"
      setActionError(message)
    }
  }

  const handleViewSummary = async (candidate: CandidateSearchItem) => {
    setSummaryError(null)
    setSummaryLoading(true)
    setSummaryLoadingId(candidate.id)
    try {
      const data = await fetchCandidateResumeSummary(candidate.id)
      setSummaryModal({
        candidateId: candidate.id,
        title: candidate.title || candidate.desired_role || "Резюме",
        summary: data?.summary ?? "",
        strengths: data?.strengths ?? [],
        cached: Boolean(data?.cached),
      })
    } catch (err) {
      const returnTo = `${window.location.pathname}${window.location.search}`
      if (
        redirectToPaymentOnInsufficientCredits({
          error: err,
          navigate,
          feature: "resume_summary",
          returnTo,
        })
      ) {
        return
      }
      const message = err instanceof Error ? err.message : "Не вдалося отримати вижимку"
      setSummaryError(message)
    } finally {
      setSummaryLoading(false)
      setSummaryLoadingId(null)
    }
  }

  const handleStartChat = (candidate: CandidateSearchItem) => {
    if (!candidate.id || candidate.id <= 0) {
      setActionError("Для цього резюме недоступний ідентифікатор резюме")
      return
    }
    if (isVacanciesLoading) {
      setActionError("Зачекайте, завантажуються вакансії")
      return
    }
    if (!vacancies.length) {
      setActionError("Щоб почати чат, спочатку створіть хоча б одну вакансію")
      return
    }
    setActionError(null)
    setChatVacancyId(String(vacancies[0].id))
    setChatModal({
      candidateResumeId: candidate.id,
      candidateTitle: candidate.title || candidate.desired_role || "Кандидат",
    })
  }

  const handleConfirmStartChat = () => {
    if (!chatModal || !chatVacancyId) {
      return
    }
    setChatModal(null)
    openChatWidget({ resumeId: chatModal.candidateResumeId, vacancyId: Number(chatVacancyId) })
  }

  const showEmptyState = !isLoading && !error && candidates.length === 0

  return (
    <div className="min-h-screen bg-[#e9edf4]">
      <Navbar />

      <div className="mx-auto max-w-[1240px] px-4 pb-12 pt-8">
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-6 text-white shadow-medium md:p-8">
          <div className="pointer-events-none absolute -right-12 top-2 h-44 w-44 rounded-full bg-orange-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />

          <div className="relative">
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">
              База резюме
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold md:text-3xl">
              Пошук кандидатів за резюме
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-white/70">
              Знайдіть релевантних кандидатів за ключовими словами, навичками та очікуваннями.
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
            onUpdateField={updateFilters}
            onCitySelect={handleCitySelect}
            onClear={clearFilters}
          />

          <div className="space-y-4">
            <ResultsHeader
              total={total}
              sort={sort}
              onSortChange={setSort}
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
            {summaryError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {summaryError}
              </div>
            )}
            {showEmptyState && (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-soft">
                Нічого не знайдено. Спробуйте змінити фільтри або уточнити запит.
              </div>
            )}

            {candidates.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {candidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    isSaved={savedIds.has(candidate.id)}
                    isSaving={savingIds.has(candidate.id)}
                    isSummaryLoading={summaryLoadingId === candidate.id}
                    onToggleSave={() => toggleSave(candidate.id)}
                    onViewResume={handleViewResume}
                    onViewSummary={() => handleViewSummary(candidate)}
                    onStartChat={() => handleStartChat(candidate)}
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
      {chatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-sm px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-strong">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Новий діалог
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {chatModal.candidateTitle}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Оберіть вакансію, від імені якої буде відкрито переписку.
                </p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
                type="button"
                onClick={() => setChatModal(null)}
              >
                Закрити
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Вакансія
              </label>
              <select
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-orange-400/70"
                value={chatVacancyId}
                onChange={(event) => setChatVacancyId(event.target.value)}
              >
                {vacancies.map((vacancy) => (
                  <option key={vacancy.id} value={vacancy.id}>
                    {vacancy.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                type="button"
                onClick={() => setChatModal(null)}
              >
                Скасувати
              </button>
              <button
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={handleConfirmStartChat}
                disabled={!chatVacancyId}
              >
                Почати чат
              </button>
            </div>
          </div>
        </div>
      )}
      {summaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-sm px-4 py-6">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-strong">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Вижимка резюме
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {summaryModal.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {summaryModal.cached ? "Відповідь з кешу" : "Згенеровано AI"}
                </p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
                type="button"
                onClick={() => setSummaryModal(null)}
              >
                Закрити
              </button>
            </div>

            {summaryLoading ? (
              <div className="mt-4 text-sm text-slate-500">Генеруємо...</div>
            ) : (
              <>
                <p className="mt-4 text-sm text-slate-700">{summaryModal.summary}</p>
                {summaryModal.strengths && summaryModal.strengths.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ключові навички</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {summaryModal.strengths.map((strength, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700"
                        >
                          {strength}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <ResumeModal
        resume={openedResume}
        onClose={() => setOpenedResume(null)}
        onOpenPdf={() => void handleOpenResumePdf()}
      />
    </div>
  )
}

export default CandidateSearch

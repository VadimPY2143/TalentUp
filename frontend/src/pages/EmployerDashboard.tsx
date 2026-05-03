import { useEffect, useRef, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import CityAutocomplete from "../components/CityAutocomplete"
import AISparkleIcon from "../components/icons/AISparkleIcon"
import Navbar from "../components/layout/Navbar"
import {
  getCandidateMatchingJob,
  getLatestCandidateMatchingJob,
  startCandidateMatching,
} from "../api/candidateMatching"
import {
  getApplicationResume,
  listEmployerApplications,
  openApplicationResumePdf,
  updateApplicationStatus,
} from "../api/applications"
import { deleteSavedResumeByCompany, listSavedResumesByCompany } from "../api/candidates"
import { createCompany, listCompanies, updateCompany } from "../api/companies"
import {
  aiFillCompanyVacancy,
  createCompanyVacancy,
  deleteCompanyVacancy,
  listCompanyVacancies,
  updateCompanyVacancy,
} from "../api/vacancies"
import { redirectToPaymentOnInsufficientCredits } from "../payments/insufficientCredits"
import type { CityOption } from "../types/city"
import type { CompanyPayload, CompanyResponse } from "../types/company"
import type { ApplicationResume, ApplicationStatus, JobApplication } from "../types/application"
import type {
  CandidateMatchJobResponse,
  CandidateMatchJobStatus,
  CandidateMatchResultItem,
} from "../types/candidateMatching"
import type { Resume } from "../types/resume"
import type { VacancyPayload, VacancyResponse } from "../types/vacancy"

interface CompanyFormState {
  name: string
  legal_name: string
  description: string
  industry: string
  company_size: string
  website: string
  email: string
  phone: string
  country: string
  city: string
  address: string
  founded_year: string
}

interface VacancyFormState {
  title: string
  description: string
  responsibilities: string
  requirements: string
  city_id: number | null
  location: string
  salary_min: string
  salary_max: string
  salary_currency: string
  experience_years_min: string
  experience_years_max: string
  employment_type: string[]
  work_format: string[]
  is_active: boolean
}

const emptyCompanyForm: CompanyFormState = {
  name: "",
  legal_name: "",
  description: "",
  industry: "",
  company_size: "",
  website: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  address: "",
  founded_year: "",
}

const emptyVacancyForm: VacancyFormState = {
  title: "",
  description: "",
  responsibilities: "",
  requirements: "",
  city_id: null,
  location: "",
  salary_min: "",
  salary_max: "",
  salary_currency: "UAH",
  experience_years_min: "",
  experience_years_max: "",
  employment_type: [],
  work_format: [],
  is_active: true,
}

const currencyOptions = ["UAH", "USD"] as const
const employmentTypeOptions = ["Full-time", "Part-time"] as const
const workFormatOptions = ["Remote", "Hybrid", "Office"] as const
const VACANCIES_PER_PAGE = 3

const toText = (value: string) => {
  const normalized = value.trim()
  return normalized ? normalized : undefined
}

const toCompanyPayload = (form: CompanyFormState): CompanyPayload => ({
  name: form.name.trim(),
  legal_name: toText(form.legal_name),
  description: toText(form.description),
  industry: toText(form.industry),
  company_size: toText(form.company_size),
  website: toText(form.website),
  email: toText(form.email),
  phone: toText(form.phone),
  country: toText(form.country),
  city: toText(form.city),
  address: toText(form.address),
  founded_year: form.founded_year ? Number(form.founded_year) : undefined,
})

const toVacancyPayload = (form: VacancyFormState): VacancyPayload => ({
  title: form.title.trim(),
  description: form.description.trim(),
  responsibilities: toText(form.responsibilities),
  requirements: toText(form.requirements),
  city_id: form.city_id ?? undefined,
  location: toText(form.location),
  salary_min: form.salary_min ? Number(form.salary_min) : undefined,
  salary_max: form.salary_max ? Number(form.salary_max) : undefined,
  salary_currency: form.salary_currency,
  experience_years_min: form.experience_years_min ? Number(form.experience_years_min) : undefined,
  experience_years_max: form.experience_years_max ? Number(form.experience_years_max) : undefined,
  employment_type: form.employment_type.length ? form.employment_type : undefined,
  work_format: form.work_format.length ? form.work_format : undefined,
  is_active: form.is_active,
})

const companyToForm = (company: CompanyResponse): CompanyFormState => ({
  name: company.name ?? "",
  legal_name: company.legal_name ?? "",
  description: company.description ?? "",
  industry: company.industry ?? "",
  company_size: company.company_size ?? "",
  website: company.website ?? "",
  email: company.email ?? "",
  phone: company.phone ?? "",
  country: company.country ?? "",
  city: company.city ?? "",
  address: company.address ?? "",
  founded_year: company.founded_year ? String(company.founded_year) : "",
})

const vacancyToForm = (vacancy: VacancyResponse): VacancyFormState => ({
  title: vacancy.title ?? "",
  description: vacancy.description ?? "",
  responsibilities: vacancy.responsibilities ?? "",
  requirements: vacancy.requirements ?? "",
  city_id: vacancy.city_id ?? null,
  location: vacancy.location ?? "",
  salary_min: vacancy.salary_min ? String(vacancy.salary_min) : "",
  salary_max: vacancy.salary_max ? String(vacancy.salary_max) : "",
  salary_currency: vacancy.salary_currency ?? "UAH",
  experience_years_min: vacancy.experience_years_min ? String(vacancy.experience_years_min) : "",
  experience_years_max: vacancy.experience_years_max ? String(vacancy.experience_years_max) : "",
  employment_type: vacancy.employment_type ?? [],
  work_format: vacancy.work_format ?? [],
  is_active: vacancy.is_active ?? true,
})

const normalizeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "")

const normalizeEmploymentTypes = (values?: string[] | null): string[] => {
  if (!values?.length) {
    return []
  }

  const mapped: string[] = []
  for (const value of values) {
    const token = normalizeToken(value)
    if (token === "fulltime") {
      mapped.push("Full-time")
    } else if (token === "parttime") {
      mapped.push("Part-time")
    }
  }

  return Array.from(new Set(mapped))
}

const normalizeWorkFormats = (values?: string[] | null): string[] => {
  if (!values?.length) {
    return []
  }

  const mapped: string[] = []
  for (const value of values) {
    const token = normalizeToken(value)
    if (token === "remote") {
      mapped.push("Remote")
    } else if (token === "hybrid") {
      mapped.push("Hybrid")
    } else if (token === "office" || token === "offline" || token === "onsite") {
      mapped.push("Office")
    }
  }

  return Array.from(new Set(mapped))
}

const toDateInputValue = (value?: string) => {
  if (!value) {
    return ""
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }
  return parsed.toISOString().slice(0, 10)
}

const aiVacancyToForm = (vacancy: VacancyPayload): VacancyFormState => {
  const employment = Array.from(
    new Set([
      ...normalizeEmploymentTypes(vacancy.employment_type),
      ...normalizeEmploymentTypes(vacancy.work_format),
    ]),
  )
  const workFormat = Array.from(
    new Set([
      ...normalizeWorkFormats(vacancy.work_format),
      ...normalizeWorkFormats(vacancy.employment_type),
    ]),
  )

  const normalizedCurrency = (vacancy.salary_currency ?? "").toUpperCase()

  return {
    title: vacancy.title ?? "",
    description: vacancy.description ?? "",
    responsibilities: vacancy.responsibilities ?? "",
    requirements: vacancy.requirements ?? "",
    city_id: vacancy.city_id ?? null,
    location: vacancy.location ?? "",
    salary_min: vacancy.salary_min ? String(vacancy.salary_min) : "",
    salary_max: vacancy.salary_max ? String(vacancy.salary_max) : "",
    salary_currency: currencyOptions.includes(normalizedCurrency as "UAH" | "USD")
      ? normalizedCurrency
      : "UAH",
    experience_years_min: vacancy.experience_years_min ? String(vacancy.experience_years_min) : "",
    experience_years_max: vacancy.experience_years_max ? String(vacancy.experience_years_max) : "",
    employment_type: employment,
    work_format: workFormat,
    is_active: vacancy.is_active ?? true,
  }
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "-"
  }
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "-"
  }
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

const applicationStatusLabel: Record<ApplicationStatus, string> = {
  applied: "Подано",
  viewed: "Переглянуто",
  chat_started: "Почато переписку",
}

const applicationStatusClassName: Record<ApplicationStatus, string> = {
  applied: "border-sky-200 bg-sky-50 text-sky-700",
  viewed: "border-indigo-200 bg-indigo-50 text-indigo-700",
  chat_started: "border-violet-200 bg-violet-50 text-violet-700",
}

const candidateMatchStatusLabel: Record<CandidateMatchJobStatus, string> = {
  pending: "У черзі",
  running: "Обробка",
  done: "Готово",
  failed: "Помилка",
}

const candidateMatchStatusClassName: Record<CandidateMatchJobStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  running: "border-sky-200 bg-sky-50 text-sky-700",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
}

const hasValue = (value: unknown): boolean => {
  if (typeof value === "number") {
    return true
  }
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value)
}

const getCompanyProfileCompleteness = (company: CompanyResponse): number => {
  const fields: Array<unknown> = [
    company.name,
    company.legal_name,
    company.description,
    company.industry,
    company.company_size,
    company.website,
    company.email,
    company.phone,
    company.country,
    company.city,
    company.address,
    company.founded_year,
  ]
  const filled = fields.filter(hasValue).length
  return Math.round((filled / fields.length) * 100)
}

const getWebsiteUrl = (website?: string | null): string | null => {
  if (!website) {
    return null
  }
  return /^https?:\/\//i.test(website) ? website : `https://${website}`
}

const formatResumeSalary = (resume: Resume): string => {
  const currency = resume.salary_currency ?? "UAH"
  if (resume.salary_min && resume.salary_max) {
    return `${resume.salary_min}-${resume.salary_max} ${currency}`
  }
  if (resume.salary_min) {
    return `від ${resume.salary_min} ${currency}`
  }
  if (resume.salary_max) {
    return `до ${resume.salary_max} ${currency}`
  }
  return "Зарплата не вказана"
}

const formatApplicationResumeSalary = (resume: ApplicationResume): string => {
  const currency = resume.salary_currency ?? "UAH"
  if (resume.salary_min && resume.salary_max) {
    return `${resume.salary_min}-${resume.salary_max} ${currency}`
  }
  if (resume.salary_min) {
    return `від ${resume.salary_min} ${currency}`
  }
  if (resume.salary_max) {
    return `до ${resume.salary_max} ${currency}`
  }
  return "Зарплата не вказана"
}

const mapSavedResumeToApplicationResume = (resume: Resume): ApplicationResume => ({
  id: resume.id,
  user_id: 0,
  title: resume.title,
  summary: resume.summary ?? null,
  desired_role: resume.desired_role ?? null,
  employment_type: resume.employment_type ?? null,
  location: resume.location ?? null,
  salary_min: resume.salary_min ?? null,
  salary_max: resume.salary_max ?? null,
  salary_currency: resume.salary_currency ?? null,
  years_experience: resume.years_experience ?? null,
  is_active: Boolean(resume.is_active),
  pdf_file_path: resume.pdf_file_path ?? null,
  pdf_original_name: resume.pdf_original_name ?? null,
  pdf_size: resume.pdf_size ?? null,
  pdf_uploaded_at: resume.pdf_uploaded_at ?? null,
  created_at: resume.created_at ?? new Date().toISOString(),
  updated_at: resume.updated_at ?? new Date().toISOString(),
})

const EmployerDashboard = () => {
  const navigate = useNavigate()
  const [company, setCompany] = useState<CompanyResponse | null>(null)
  const [extraCompaniesCount, setExtraCompaniesCount] = useState(0)
  const [showCompanyEditor, setShowCompanyEditor] = useState(false)
  const [companyForm, setCompanyForm] = useState<CompanyFormState>(emptyCompanyForm)
  const [isCompanyLoading, setIsCompanyLoading] = useState(true)
  const [isCompanySaving, setIsCompanySaving] = useState(false)
  const [companyError, setCompanyError] = useState<string | null>(null)
  const [companySuccess, setCompanySuccess] = useState<string | null>(null)

  const [vacancies, setVacancies] = useState<VacancyResponse[]>([])
  const [vacancyPage, setVacancyPage] = useState(1)
  const [editingVacancyId, setEditingVacancyId] = useState<number | null>(null)
  const [vacancyForm, setVacancyForm] = useState<VacancyFormState>(emptyVacancyForm)
  const [rightPanelView, setRightPanelView] = useState<"vacancies" | "saved" | "applications">("vacancies")
  const [isVacancyLoading, setIsVacancyLoading] = useState(false)
  const [isVacancySaving, setIsVacancySaving] = useState(false)
  const [vacancyError, setVacancyError] = useState<string | null>(null)
  const [vacancySuccess, setVacancySuccess] = useState<string | null>(null)
  const [savedResumes, setSavedResumes] = useState<Resume[]>([])
  const [isSavedResumesLoading, setIsSavedResumesLoading] = useState(false)
  const [savedResumesError, setSavedResumesError] = useState<string | null>(null)
  const [deletingSavedResumeId, setDeletingSavedResumeId] = useState<number | null>(null)
  const [employerApplications, setEmployerApplications] = useState<JobApplication[]>([])
  const [isEmployerApplicationsLoading, setIsEmployerApplicationsLoading] = useState(false)
  const [employerApplicationsError, setEmployerApplicationsError] = useState<string | null>(null)
  const [applicationsVacancyFilter, setApplicationsVacancyFilter] = useState<number | null>(null)
  const [showCandidateMatchPanel, setShowCandidateMatchPanel] = useState(false)
  const [candidateSectionsView, setCandidateSectionsView] = useState<"ai" | "all">("all")
  const [matchRequestedLimit, setMatchRequestedLimit] = useState(10)
  const [isCandidateMatchingStarting, setIsCandidateMatchingStarting] = useState(false)
  const [isCandidateMatchingLoading, setIsCandidateMatchingLoading] = useState(false)
  const [candidateMatchingError, setCandidateMatchingError] = useState<string | null>(null)
  const [candidateMatchingJob, setCandidateMatchingJob] = useState<CandidateMatchJobResponse | null>(null)
  const [matchedResumeOpeningId, setMatchedResumeOpeningId] = useState<number | null>(null)
  const [matchedChatStartingId, setMatchedChatStartingId] = useState<number | null>(null)
  const [expandedApplicationId, setExpandedApplicationId] = useState<number | null>(null)
  const [applicationResumeLoadingId, setApplicationResumeLoadingId] = useState<number | null>(null)
  const [applicationStatusUpdatingId, setApplicationStatusUpdatingId] = useState<number | null>(null)
  const [selectedApplicationResume, setSelectedApplicationResume] = useState<{
    resume: ApplicationResume
    vacancyTitle: string
    candidateLabel: string
  } | null>(null)
  const [applicationResumeError, setApplicationResumeError] = useState<string | null>(null)
  const [aiDescription, setAiDescription] = useState("")
  const [isAIFilling, setIsAIFilling] = useState(false)
  const [showAIPromptEditor, setShowAIPromptEditor] = useState(false)
  const [syncedTopPanelsHeight, setSyncedTopPanelsHeight] = useState<number | null>(null)
  const companyProfilePanelRef = useRef<HTMLElement | null>(null)
  const aiTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const candidateMatchingPollingRef = useRef(false)

  const openPaymentsPage = (feature?: string) => {
    const params = new URLSearchParams()
    params.set("return_to", "/dashboard")
    if (feature) {
      params.set("feature", feature)
    }
    navigate(`/payment?${params.toString()}`)
  }

  useEffect(() => {
    if (!selectedApplicationResume) {
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedApplicationResume])

  useEffect(() => {
    if (typeof window === "undefined" || typeof ResizeObserver === "undefined") {
      return
    }

    const panel = companyProfilePanelRef.current
    if (!panel) {
      return
    }

    const syncPanelsHeight = () => {
      if (window.innerWidth < 1024) {
        setSyncedTopPanelsHeight(null)
        return
      }

      const height = Math.ceil(panel.getBoundingClientRect().height)
      setSyncedTopPanelsHeight((prev) => (prev === height ? prev : height))
    }

    syncPanelsHeight()

    const observer = new ResizeObserver(() => {
      syncPanelsHeight()
    })
    observer.observe(panel)
    window.addEventListener("resize", syncPanelsHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", syncPanelsHeight)
    }
  }, [])

  const loadCompany = async () => {
    try {
      setIsCompanyLoading(true)
      const companies = await listCompanies()
      if (companies.length === 0) {
        setCompany(null)
        setExtraCompaniesCount(0)
        setCompanyForm(emptyCompanyForm)
        setShowCompanyEditor(true)
      } else {
        const mainCompany = companies[0]
        setCompany(mainCompany)
        setCompanyForm(companyToForm(mainCompany))
        setExtraCompaniesCount(Math.max(0, companies.length - 1))
        setShowCompanyEditor(false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося завантажити компанію"
      setCompanyError(message)
    } finally {
      setIsCompanyLoading(false)
    }
  }

  const loadVacancies = async (companyId: number) => {
    try {
      setIsVacancyLoading(true)
      const data = await listCompanyVacancies(companyId)
      setVacancies(data)
      setVacancyPage(1)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося завантажити вакансії"
      setVacancyError(message)
    } finally {
      setIsVacancyLoading(false)
    }
  }

  const loadSavedResumes = async (companyId: number) => {
    try {
      setIsSavedResumesLoading(true)
      setSavedResumesError(null)
      const data = await listSavedResumesByCompany(companyId)
      setSavedResumes(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося завантажити збережені резюме"
      setSavedResumesError(message)
    } finally {
      setIsSavedResumesLoading(false)
    }
  }

  const loadEmployerApplications = async (vacancyId?: number) => {
    try {
      setIsEmployerApplicationsLoading(true)
      setEmployerApplicationsError(null)
      const data = await listEmployerApplications(vacancyId)
      setEmployerApplications(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося завантажити відгуки"
      setEmployerApplicationsError(message)
    } finally {
      setIsEmployerApplicationsLoading(false)
    }
  }

  const loadLatestCandidateMatching = async (vacancyId: number) => {
    try {
      setIsCandidateMatchingLoading(true)
      setCandidateMatchingError(null)
      const job = await getLatestCandidateMatchingJob(vacancyId)
      setCandidateMatchingJob(job)
    } catch (err) {
      const returnTo = `${window.location.pathname}${window.location.search}`
      if (
        redirectToPaymentOnInsufficientCredits({
          error: err,
          navigate,
          feature: "candidate_matching",
          returnTo,
        })
      ) {
        return
      }
      const statusCode = (err as { status?: number } | null)?.status
      if (statusCode === 404) {
        setCandidateMatchingJob(null)
        setCandidateMatchingError(null)
      } else {
        const message = err instanceof Error ? err.message : "Не вдалося завантажити AI матчинг"
        setCandidateMatchingError(message)
      }
    } finally {
      setIsCandidateMatchingLoading(false)
    }
  }

  const handleStartCandidateMatching = async () => {
    if (!applicationsVacancyFilter) {
      setCandidateMatchingError("Оберіть вакансію у фільтрі, щоб запустити матчинг")
      return
    }
    if (candidateMatchingJob?.status === "pending" || candidateMatchingJob?.status === "running") {
      setCandidateMatchingError("Матчинг уже виконується. Дочекайтеся завершення поточного запуску.")
      return
    }

    try {
      setShowCandidateMatchPanel(true)
      setCandidateSectionsView("ai")
      setCandidateMatchingError(null)
      setIsCandidateMatchingStarting(true)
      const run = await startCandidateMatching(applicationsVacancyFilter, {
        requested_limit: matchRequestedLimit,
      })
      const job = await getCandidateMatchingJob(applicationsVacancyFilter, run.job_id)
      setCandidateMatchingJob(job)
    } catch (err) {
      const returnTo = `${window.location.pathname}${window.location.search}`
      if (
        redirectToPaymentOnInsufficientCredits({
          error: err,
          navigate,
          feature: "candidate_matching",
          returnTo,
        })
      ) {
        return
      }
      const message = err instanceof Error ? err.message : "Не вдалося запустити AI матчинг"
      setCandidateMatchingError(message)
    } finally {
      setIsCandidateMatchingStarting(false)
    }
  }

  const handleOpenMatchedResume = async (item: CandidateMatchResultItem) => {
    try {
      setApplicationResumeError(null)
      setMatchedResumeOpeningId(item.application_id)
      const resume = await getApplicationResume(item.application_id)
      const vacancyTitle =
        vacancies.find((vacancy) => vacancy.id === candidateMatchingJob?.vacancy_id)?.title
        ?? `Вакансія #${candidateMatchingJob?.vacancy_id ?? "?"}`

      setSelectedApplicationResume({
        resume,
        vacancyTitle,
        candidateLabel: `Кандидат: ${item.candidate_name}`,
      })

      const appInList = employerApplications.find((application) => application.id === item.application_id)
      if (appInList && appInList.status === "applied") {
        try {
          const updated = await updateApplicationStatus(item.application_id, { status: "viewed" })
          setEmployerApplications((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)))
        } catch {
          // Keep resume modal visible even if status update failed.
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося відкрити резюме кандидата"
      setApplicationResumeError(message)
    } finally {
      setMatchedResumeOpeningId(null)
    }
  }

  const handleWriteToMatchedCandidate = async (item: CandidateMatchResultItem) => {
    try {
      setMatchedChatStartingId(item.application_id)
      const appInList = employerApplications.find((application) => application.id === item.application_id)
      if (appInList && appInList.status !== "chat_started") {
        try {
          const updated = await updateApplicationStatus(item.application_id, { status: "chat_started" })
          setEmployerApplications((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)))
        } catch {
          // Do not block navigation if status update failed.
        }
      }
      const targetVacancyId = candidateMatchingJob?.vacancy_id ?? applicationsVacancyFilter
      if (!targetVacancyId) {
        throw new Error("Не вдалося визначити вакансію для чату")
      }
      const params = new URLSearchParams({
        resumeId: String(item.resume_id),
        vacancyId: String(targetVacancyId),
      })
      navigate(`/messages?${params.toString()}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося відкрити чат із кандидатом"
      setApplicationResumeError(message)
    } finally {
      setMatchedChatStartingId(null)
    }
  }

  const handleDeleteSavedResume = async (resumeId: number) => {
    if (!company) {
      return
    }

    try {
      setDeletingSavedResumeId(resumeId)
      setSavedResumesError(null)
      await deleteSavedResumeByCompany(company.id, resumeId)
      setSavedResumes((prev) => prev.filter((resume) => resume.id !== resumeId))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося видалити збережене резюме"
      setSavedResumesError(message)
    } finally {
      setDeletingSavedResumeId(null)
    }
  }

  const handleOpenSavedResume = (resume: Resume) => {
    setApplicationResumeError(null)
    setSelectedApplicationResume({
      resume: mapSavedResumeToApplicationResume(resume),
      vacancyTitle: "Збережений кандидат",
      candidateLabel: resume.title || "Кандидат",
    })
  }

  const handleStartChatWithSavedResume = (resume: Resume) => {
    if (!resume.id) {
      setSavedResumesError("Для цього кандидата недоступний ідентифікатор резюме")
      return
    }
    const vacancyId = applicationsVacancyFilter ?? vacancies[0]?.id
    if (!vacancyId) {
      setSavedResumesError("Щоб почати переписку, спочатку створіть хоча б одну вакансію")
      return
    }
    setSavedResumesError(null)
    const params = new URLSearchParams({
      resumeId: String(resume.id),
      vacancyId: String(vacancyId),
    })
    navigate(`/messages?${params.toString()}`)
  }

  const handleOpenApplicationResume = async (application: JobApplication) => {
    setApplicationResumeError(null)
    try {
      setApplicationResumeLoadingId(application.id)
      const resume = await getApplicationResume(application.id)
      setSelectedApplicationResume({
        resume,
        vacancyTitle: application.vacancy?.title ?? `Вакансія #${application.vacancy_id}`,
        candidateLabel: `Кандидат: ${application.candidate_name || "Невідомий кандидат"}`,
      })

      if (application.status === "applied") {
        try {
          const updated = await updateApplicationStatus(application.id, { status: "viewed" })
          setEmployerApplications((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        } catch {
          // Keep resume modal open even if auto-status update fails.
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося відкрити повне резюме"
      setApplicationResumeError(message)
    } finally {
      setApplicationResumeLoadingId(null)
    }
  }

  const handleWriteToCandidate = async (application: JobApplication) => {
    if (!application.resume_id) {
      setApplicationResumeError("Для цього відгуку не знайдено резюме")
      return
    }
    if (application.status === "applied" || application.status === "viewed") {
      try {
        setApplicationStatusUpdatingId(application.id)
        const updated = await updateApplicationStatus(application.id, { status: "chat_started" })
        setEmployerApplications((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      } catch {
        // Do not block navigation to chat if status update fails.
      } finally {
        setApplicationStatusUpdatingId(null)
      }
    }
    const params = new URLSearchParams({
      resumeId: String(application.resume_id),
      vacancyId: String(application.vacancy_id),
    })
    navigate(`/messages?${params.toString()}`)
  }

  const handleOpenApplicationResumePdf = async (resumeId?: number | null) => {
    if (!resumeId) {
      setApplicationResumeError("PDF для цього резюме недоступний")
      return
    }

    setApplicationResumeError(null)
    try {
      await openApplicationResumePdf(resumeId)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося відкрити PDF резюме"
      setApplicationResumeError(message)
    }
  }

  useEffect(() => {
    loadCompany()
  }, [])

  useEffect(() => {
    if (!company) {
      setVacancies([])
      setSavedResumes([])
      setEmployerApplications([])
      setApplicationsVacancyFilter(null)
      setShowCandidateMatchPanel(false)
      setCandidateSectionsView("all")
      setCandidateMatchingJob(null)
      setCandidateMatchingError(null)
      setExpandedApplicationId(null)
      setSelectedApplicationResume(null)
      setApplicationResumeError(null)
      setEditingVacancyId(null)
      setVacancyForm(emptyVacancyForm)
      return
    }
    loadVacancies(company.id)
    loadSavedResumes(company.id)
  }, [company?.id])

  useEffect(() => {
    if (showAIPromptEditor) {
      aiTextareaRef.current?.focus()
    }
  }, [showAIPromptEditor])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(vacancies.length / VACANCIES_PER_PAGE))
    if (vacancyPage > totalPages) {
      setVacancyPage(totalPages)
    }
  }, [vacancies.length, vacancyPage])

  useEffect(() => {
    if (!company) {
      return
    }
    if (
      applicationsVacancyFilter !== null
      && !vacancies.some((vacancy) => vacancy.id === applicationsVacancyFilter)
    ) {
      setApplicationsVacancyFilter(null)
    }
  }, [company, applicationsVacancyFilter, vacancies])

  useEffect(() => {
    if (!company) {
      return
    }
    void loadEmployerApplications(applicationsVacancyFilter ?? undefined)
  }, [company, applicationsVacancyFilter])

  useEffect(() => {
    if (!company || rightPanelView !== "applications") {
      return
    }
    if (!applicationsVacancyFilter) {
      setCandidateMatchingJob(null)
      setCandidateMatchingError(null)
      return
    }
    void loadLatestCandidateMatching(applicationsVacancyFilter)
  }, [company, rightPanelView, applicationsVacancyFilter])

  useEffect(() => {
    if (!applicationsVacancyFilter || !candidateMatchingJob) {
      return
    }
    if (
      candidateMatchingJob.status !== "pending"
      && candidateMatchingJob.status !== "running"
    ) {
      return
    }

    const interval = window.setInterval(async () => {
      if (candidateMatchingPollingRef.current) {
        return
      }
      candidateMatchingPollingRef.current = true
      try {
        const refreshed = await getCandidateMatchingJob(applicationsVacancyFilter, candidateMatchingJob.job_id)
        setCandidateMatchingJob(refreshed)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Не вдалося оновити статус AI матчингу"
        setCandidateMatchingError(message)
      } finally {
        candidateMatchingPollingRef.current = false
      }
    }, 2500)

    return () => {
      window.clearInterval(interval)
    }
  }, [applicationsVacancyFilter, candidateMatchingJob])

  const setCompanyField = (key: keyof CompanyFormState, value: string) => {
    setCompanyForm((prev) => ({ ...prev, [key]: value }))
  }

  const setVacancyField = (key: keyof VacancyFormState, value: string | boolean | number | null) => {
    setVacancyForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleVacancyOption = (
    key: "employment_type" | "work_format",
    option: string,
  ) => {
    setVacancyForm((prev) => {
      const exists = prev[key].includes(option)
      const next = exists
        ? prev[key].filter((item) => item !== option)
        : [...prev[key], option]
      return { ...prev, [key]: next }
    })
  }

  const startCreateVacancy = () => {
    setEditingVacancyId(null)
    setVacancyForm(emptyVacancyForm)
    setAiDescription("")
    setShowAIPromptEditor(false)
    setVacancyError(null)
    setVacancySuccess(null)
  }

  const startEditVacancy = (vacancy: VacancyResponse) => {
    setEditingVacancyId(vacancy.id)
    setVacancyForm(vacancyToForm(vacancy))
    setAiDescription("")
    setShowAIPromptEditor(false)
    setVacancyError(null)
    setVacancySuccess(null)
  }

  const handleAIFillVacancy = async () => {
    setVacancyError(null)
    setVacancySuccess(null)

    if (!company) {
      setVacancyError("Спочатку створіть компанію")
      return
    }

    if (!aiDescription.trim()) {
      setVacancyError("Додайте опис вакансії для AI")
      return
    }

    try {
      setIsAIFilling(true)
      const generated = await aiFillCompanyVacancy(company.id, {
        description: aiDescription.trim(),
      })
      setVacancyForm(aiVacancyToForm(generated))
      setVacancySuccess("Форму заповнено через AI. Перевірте поля перед збереженням.")
      setShowAIPromptEditor(false)
      setEditingVacancyId(null)
    } catch (err) {
      const returnTo = `${window.location.pathname}${window.location.search}`
      if (
        redirectToPaymentOnInsufficientCredits({
          error: err,
          navigate,
          feature: "vacancy_ai_fill",
          returnTo,
        })
      ) {
        return
      }
      const message = err instanceof Error ? err.message : "AI не зміг заповнити вакансію"
      setVacancyError(message)
    } finally {
      setIsAIFilling(false)
    }
  }

  const handleCompanySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCompanyError(null)
    setCompanySuccess(null)

    if (!companyForm.name.trim()) {
      setCompanyError("Вкажіть назву компанії")
      return
    }

    if (companyForm.founded_year && Number.isNaN(Number(companyForm.founded_year))) {
      setCompanyError("Рік заснування має бути числом")
      return
    }

    try {
      setIsCompanySaving(true)
      const payload = toCompanyPayload(companyForm)
      if (company) {
        const updated = await updateCompany(company.id, payload)
        setCompany(updated)
        setCompanyForm(companyToForm(updated))
        setCompanySuccess("Профіль компанії оновлено")
        setShowCompanyEditor(false)
      } else {
        const created = await createCompany(payload)
        setCompany(created)
        setCompanyForm(companyToForm(created))
        setCompanySuccess("Компанію створено")
        setShowCompanyEditor(false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Помилка збереження компанії"
      setCompanyError(message)
    } finally {
      setIsCompanySaving(false)
    }
  }

  const handleVacancySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setVacancyError(null)
    setVacancySuccess(null)

    if (!company) {
      setVacancyError("Спочатку створіть компанію")
      return
    }
    if (!vacancyForm.title.trim()) {
      setVacancyError("Вкажіть назву вакансії")
      return
    }
    if (!vacancyForm.description.trim()) {
      setVacancyError("Додайте опис вакансії")
      return
    }

    try {
      setIsVacancySaving(true)
      const payload = toVacancyPayload(vacancyForm)
      if (editingVacancyId) {
        const updated = await updateCompanyVacancy(company.id, editingVacancyId, payload)
        setVacancies((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        setVacancySuccess("Вакансію оновлено")
      } else {
        const created = await createCompanyVacancy(company.id, payload)
        setVacancies((prev) => [created, ...prev])
        setVacancyPage(1)
        setEditingVacancyId(created.id)
        setVacancySuccess("Вакансію створено")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Помилка збереження вакансії"
      setVacancyError(message)
    } finally {
      setIsVacancySaving(false)
    }
  }

  const handleDeleteVacancy = async (vacancyId: number) => {
    if (!company) {
      return
    }
    try {
      setIsVacancySaving(true)
      await deleteCompanyVacancy(company.id, vacancyId)
      setVacancies((prev) => prev.filter((item) => item.id !== vacancyId))
      if (editingVacancyId === vacancyId) {
        startCreateVacancy()
      }
      setVacancySuccess("Вакансію видалено")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Помилка видалення вакансії"
      setVacancyError(message)
    } finally {
      setIsVacancySaving(false)
    }
  }

  const companyProfileCompleteness = company ? getCompanyProfileCompleteness(company) : 0
  const companyWebsiteUrl = getWebsiteUrl(company?.website)
  const totalVacancyPages = Math.max(1, Math.ceil(vacancies.length / VACANCIES_PER_PAGE))
  const vacancyPageStart = (vacancyPage - 1) * VACANCIES_PER_PAGE
  const paginatedVacancies = vacancies.slice(vacancyPageStart, vacancyPageStart + VACANCIES_PER_PAGE)

  const candidatesInSelectionCount = applicationsVacancyFilter ? employerApplications.length : 0

  const renderApplicationCard = (application: JobApplication) => {
    const isExpanded = expandedApplicationId === application.id
    const sortedHistory = [...(application.history ?? [])].sort(
      (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
    )

    return (
      <article
        key={application.id}
        className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-soft"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">
              {application.vacancy?.title ?? `Вакансія #${application.vacancy_id}`}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {`Кандидат: ${application.candidate_name || "Невідомий кандидат"}`}
            </p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>Резюме: {application.resume_title ?? "Без назви"}</span>
              <span>Подано: {formatDateTime(application.created_at)}</span>
            </div>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${applicationStatusClassName[application.status]}`}
          >
            {applicationStatusLabel[application.status]}
          </span>
        </div>

        {application.cover_letter && (
          <p className="mt-3 text-sm text-slate-600">
            {application.cover_letter}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="shrink-0 rounded-xl bg-[#1f2f5e] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1b294f] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={() => void handleWriteToCandidate(application)}
            disabled={!application.resume_id || applicationStatusUpdatingId === application.id}
          >
            {applicationStatusUpdatingId === application.id ? "Оновлення..." : "Написати кандидату"}
          </button>
          <button
            className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={() => void handleOpenApplicationResume(application)}
            disabled={applicationResumeLoadingId === application.id}
          >
            {applicationResumeLoadingId === application.id ? "Відкриваємо..." : "Відкрити резюме"}
          </button>
          <button
            className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
            type="button"
            onClick={() => setExpandedApplicationId(isExpanded ? null : application.id)}
          >
            {isExpanded ? "Сховати історію" : "Історія статусів"}
          </button>
        </div>

        {isExpanded && (
          <ol className="mt-4 space-y-3 border-l border-slate-200 pl-4">
            {sortedHistory.map((item) => (
              <li key={item.id} className="relative">
                <span className="absolute -left-[22px] mt-1.5 h-2.5 w-2.5 rounded-full bg-slate-500" />
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${applicationStatusClassName[item.status]}`}
                    >
                      {applicationStatusLabel[item.status]}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDateTime(item.changed_at)}
                    </span>
                  </div>
                  {item.comment && (
                    <p className="mt-2 text-sm text-slate-600">
                      {item.comment}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </article>
    )
  }

  return (
    <div className="min-h-screen bg-[#edf2f8]">
      <Navbar />

      <div className="mx-auto max-w-[1280px] px-4 pb-12 pt-8">
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-7 text-white shadow-medium md:p-10">
          <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-orange-400/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-8 bottom-0 h-44 w-44 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.35em] text-white/65">Employer workspace</p>
            <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">Компанія та вакансії</h1>
            <p className="mt-3 max-w-3xl text-sm text-white/80 md:text-base">
              Одна компанія, багато вакансій. Спершу налаштуйте профіль компанії, далі керуйте наймом.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white/85">
                Компанія: <span className="font-semibold text-white">{company ? company.name : "не створена"}</span>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white/85">
                Вакансій: <span className="font-semibold text-white">{vacancies.length}</span>
              </div>
            </div>

            {extraCompaniesCount > 0 && (
              <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm text-amber-100">
                У БД знайдено ще {extraCompaniesCount} компаній. Для mode 1:many використовується перша.
              </div>
            )}
          </div>
        </section>

        <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(380px,0.92fr),minmax(560px,1.08fr)]">
          <section ref={companyProfilePanelRef} className="rounded-[24px] border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/60 p-4 shadow-soft sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-slate-900 md:text-2xl">
                {company ? "Профіль компанії" : "Створити компанію"}
              </h2>
              <div className="flex items-center gap-2">
                {company && (
                  <button
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400"
                    type="button"
                    onClick={() => setShowCompanyEditor((prev) => !prev)}
                  >
                    {showCompanyEditor ? "Сховати редагування" : "Редагувати профіль"}
                  </button>
                )}
                <button
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400"
                  type="button"
                  onClick={loadCompany}
                  disabled={isCompanyLoading}
                >
                  Оновити
                </button>
              </div>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {company
                ? "Можна лише редагувати поточну компанію."
                : "Після створення компанії відкриється керування вакансіями."}
            </p>

            {company && !showCompanyEditor && (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-slate-900">{company.name}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {[company.industry, company.city, company.country].filter(Boolean).join(" · ") || "Без додаткових даних"}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        company.is_verified
                          ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      {company.is_verified ? "Верифіковано" : "Не верифіковано"}
                    </span>
                  </div>

                  {company.description && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {company.description}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 lg:grid-cols-[0.72fr,1.28fr]">
                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Відкриті вакансії</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{vacancies.length}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Заповненість профілю</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{companyProfileCompleteness}%</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Рік заснування</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {company.founded_year ? company.founded_year : "—"}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Контакти та дані компанії
                  </div>
                  <div className="mt-2.5 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-1 xl:grid-cols-2">
                    <div className="break-words">
                      <span className="text-slate-500">Email:</span>{" "}
                      {company.email ?? "Не вказано"}
                    </div>
                    <div className="break-words">
                      <span className="text-slate-500">Телефон:</span>{" "}
                      {company.phone ?? "Не вказано"}
                    </div>
                    <div className="break-words xl:col-span-2">
                      <span className="text-slate-500">Вебсайт:</span>{" "}
                      {companyWebsiteUrl ? (
                        <a
                          className="font-medium text-[#1f4a9a] hover:underline"
                          href={companyWebsiteUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {company.website}
                        </a>
                      ) : (
                        "Не вказано"
                      )}
                    </div>
                    <div className="break-words xl:col-span-2">
                      <span className="text-slate-500">Адреса:</span>{" "}
                      {[company.country, company.city, company.address].filter(Boolean).join(", ") || "Не вказано"}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Оновлено: {formatDate(company.updated_at)}
                </div>
                </div>
              </div>
            )}

            {(!company || showCompanyEditor) && (
              <form className="mt-4 space-y-4" onSubmit={handleCompanySubmit}>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                placeholder="Назва компанії *"
                value={companyForm.name}
                onChange={(event) => setCompanyField("name", event.target.value)}
                disabled={isCompanyLoading}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Юридична назва"
                  value={companyForm.legal_name}
                  onChange={(event) => setCompanyField("legal_name", event.target.value)}
                  disabled={isCompanyLoading}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Індустрія"
                  value={companyForm.industry}
                  onChange={(event) => setCompanyField("industry", event.target.value)}
                  disabled={isCompanyLoading}
                />
              </div>

              <textarea
                className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                placeholder="Короткий опис компанії"
                value={companyForm.description}
                onChange={(event) => setCompanyField("description", event.target.value)}
                disabled={isCompanyLoading}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Розмір компанії (напр. 11-50)"
                  value={companyForm.company_size}
                  onChange={(event) => setCompanyField("company_size", event.target.value)}
                  disabled={isCompanyLoading}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Рік заснування"
                  type="number"
                  value={companyForm.founded_year}
                  onChange={(event) => setCompanyField("founded_year", event.target.value)}
                  disabled={isCompanyLoading}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Вебсайт"
                  value={companyForm.website}
                  onChange={(event) => setCompanyField("website", event.target.value)}
                  disabled={isCompanyLoading}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Email для кандидатів"
                  value={companyForm.email}
                  onChange={(event) => setCompanyField("email", event.target.value)}
                  disabled={isCompanyLoading}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Телефон"
                  value={companyForm.phone}
                  onChange={(event) => setCompanyField("phone", event.target.value)}
                  disabled={isCompanyLoading}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Країна"
                  value={companyForm.country}
                  onChange={(event) => setCompanyField("country", event.target.value)}
                  disabled={isCompanyLoading}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Місто"
                  value={companyForm.city}
                  onChange={(event) => setCompanyField("city", event.target.value)}
                  disabled={isCompanyLoading}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Адреса"
                  value={companyForm.address}
                  onChange={(event) => setCompanyField("address", event.target.value)}
                  disabled={isCompanyLoading}
                />
              </div>

              {companyError && (
                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {companyError}
                </div>
              )}
              {companySuccess && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                  {companySuccess}
                </div>
              )}

              <button
                className="w-full rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={isCompanySaving || isCompanyLoading}
              >
                {company ? "Зберегти компанію" : "Створити компанію"}
              </button>
              </form>
            )}
          </section>

          <section
            className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-soft sm:p-5 lg:flex lg:flex-col"
            style={syncedTopPanelsHeight ? { height: syncedTopPanelsHeight } : undefined}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-slate-900 md:text-2xl">
                {rightPanelView === "vacancies"
                  ? "Вакансії компанії"
                  : rightPanelView === "saved"
                    ? "Збережені кандидати"
                    : "Відгуки кандидатів"}
              </h2>
              <button
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => {
                  if (!company) {
                    return
                  }
                  if (rightPanelView === "vacancies") {
                    void loadVacancies(company.id)
                    return
                  }
                  if (rightPanelView === "saved") {
                    void loadSavedResumes(company.id)
                    return
                  }
                  void loadEmployerApplications(applicationsVacancyFilter ?? undefined)
                  if (applicationsVacancyFilter) {
                    void loadLatestCandidateMatching(applicationsVacancyFilter)
                  }
                }}
                disabled={
                  !company
                  || (rightPanelView === "vacancies"
                    ? isVacancyLoading
                    : rightPanelView === "saved"
                      ? isSavedResumesLoading
                      : isEmployerApplicationsLoading)
                }
              >
                Оновити
              </button>
            </div>

            <div className="mt-3 inline-flex max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  rightPanelView === "vacancies" ? "bg-white text-slate-900 shadow-soft" : "text-slate-600 hover:text-slate-800"
                }`}
                type="button"
                onClick={() => setRightPanelView("vacancies")}
              >
                Вакансії
              </button>
              <button
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  rightPanelView === "saved" ? "bg-white text-slate-900 shadow-soft" : "text-slate-600 hover:text-slate-800"
                }`}
                type="button"
                onClick={() => setRightPanelView("saved")}
              >
                Збережені кандидати
              </button>
              <button
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  rightPanelView === "applications"
                    ? "bg-white text-slate-900 shadow-soft"
                    : "text-slate-600 hover:text-slate-800"
                }`}
                type="button"
                onClick={() => setRightPanelView("applications")}
              >
                Відгуки
              </button>
            </div>

            <div className="mt-2 min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            <p className="text-sm text-slate-500">
              {company
                ? `Компанія: ${company.name}`
                : "Створіть компанію, щоб керувати вакансіями та збереженими кандидатами"}
            </p>

            {rightPanelView === "vacancies" ? (
              !company ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                  Вакансії стануть доступні після створення компанії.
                </div>
              ) : isVacancyLoading ? (
                <div className="mt-4 text-sm text-slate-500">Завантаження вакансій...</div>
              ) : vacancies.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                  Поки що вакансій немає. Створіть першу вакансію.
                </div>
              ) : (
                <div className="mt-4">
                  <div className="space-y-3">
                    {paginatedVacancies.map((vacancy) => (
                      <article
                        key={vacancy.id}
                        className={`relative rounded-2xl border p-5 transition ${
                          vacancy.id === editingVacancyId
                            ? "border-orange-400/60 bg-orange-50/70"
                            : vacancy.is_active
                              ? "border-slate-200 bg-slate-50 hover:bg-slate-100"
                              : "border-slate-300 bg-slate-100 hover:bg-slate-100"
                        }`}
                      >
                        <div className="pr-36">
                          <div className="flex items-center gap-2">
                            <h3 className={`text-base font-semibold ${vacancy.is_active ? "text-slate-900" : "text-slate-700"}`}>
                              {vacancy.title}
                            </h3>
                            {!vacancy.is_active && (
                              <span className="rounded-full border border-slate-400 bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                Неактивна
                              </span>
                            )}
                          </div>
                          <p className={`mt-1 text-sm ${vacancy.is_active ? "text-slate-600" : "text-slate-500"}`}>
                            {[vacancy.location, vacancy.salary_currency].filter(Boolean).join(" · ") || "Без деталей"}
                          </p>
                          <p className={`mt-2 text-xs ${vacancy.is_active ? "text-slate-500" : "text-slate-400"}`}>
                            Оновлено: {formatDate(vacancy.updated_at)}
                          </p>
                        </div>
                        <div className="absolute right-4 top-4 flex items-center gap-1.5">
                          <button
                            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-orange-500/70"
                            type="button"
                            onClick={() => startEditVacancy(vacancy)}
                          >
                            Редагувати
                          </button>
                          <button
                            className="rounded-xl border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                            type="button"
                            onClick={() => handleDeleteVacancy(vacancy.id)}
                            disabled={isVacancySaving}
                          >
                            Видалити
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>

                  {totalVacancyPages > 1 && (
                    <div className="mt-3 pt-1">
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          onClick={() => setVacancyPage((prev) => Math.max(1, prev - 1))}
                          disabled={vacancyPage === 1}
                        >
                          Попередня
                        </button>
                        <div className="text-xs font-semibold text-slate-600">
                          Сторінка {vacancyPage} з {totalVacancyPages}
                        </div>
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          onClick={() => setVacancyPage((prev) => Math.min(totalVacancyPages, prev + 1))}
                          disabled={vacancyPage === totalVacancyPages}
                        >
                          Наступна
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : rightPanelView === "saved" ? (
              <>
                {savedResumesError && (
                  <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
                    {savedResumesError}
                  </div>
                )}

                {!company ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                    Розділ активується після створення компанії.
                  </div>
                ) : isSavedResumesLoading ? (
                  <div className="mt-4 text-sm text-slate-500">Завантаження збережених резюме...</div>
                ) : savedResumes.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                    У вас поки немає збережених резюме.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {savedResumes.map((resume) => (
                      <article key={resume.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-slate-900">{resume.title}</h3>
                            <p className="mt-1 text-sm text-slate-600">{resume.desired_role || "Роль не вказана"}</p>
                          </div>
                          <button
                            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            onClick={() => handleDeleteSavedResume(resume.id)}
                            disabled={deletingSavedResumeId === resume.id}
                          >
                            {deletingSavedResumeId === resume.id ? "Видалення..." : "Видалити"}
                          </button>
                        </div>
                        {resume.summary && (
                          <p className="mt-2 line-clamp-3 text-sm text-slate-600">{resume.summary}</p>
                        )}
                        <div className="mt-3 space-y-1 text-xs text-slate-500">
                          <div>Локація: {resume.location || "Не вказана"}</div>
                          <div>Зарплата: {formatResumeSalary(resume)}</div>
                          <div>
                            Досвід: {resume.years_experience !== undefined && resume.years_experience !== null
                              ? `${resume.years_experience} років`
                              : "Не вказано"}
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
                          <button
                            className="shrink-0 rounded-xl bg-[#1f2f5e] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1b294f]"
                            type="button"
                            onClick={() => handleStartChatWithSavedResume(resume)}
                          >
                            Розпочати переписку
                          </button>
                          <button
                            className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                            type="button"
                            onClick={() => handleOpenSavedResume(resume)}
                          >
                            Переглянути резюме
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {employerApplicationsError && (
                  <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
                    {employerApplicationsError}
                  </div>
                )}
                {applicationResumeError && (
                  <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
                    {applicationResumeError}
                  </div>
                )}

                {!company ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                    Розділ активується після створення компанії.
                  </div>
                ) : (
                  <>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Вакансія для відбору
                      </label>
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-orange-500/60"
                        value={applicationsVacancyFilter ?? ""}
                        onChange={(event) => {
                          const raw = event.target.value
                          setApplicationsVacancyFilter(raw ? Number(raw) : null)
                          setCandidateSectionsView("all")
                          setExpandedApplicationId(null)
                          setCandidateMatchingError(null)
                          setCandidateMatchingJob(null)
                        }}
                      >
                        <option value="">Усі вакансії</option>
                        {vacancies.map((vacancy) => (
                          <option key={vacancy.id} value={vacancy.id}>
                            {vacancy.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <button
                        className={`rounded-xl border bg-gradient-to-r from-[#0f1f46] via-[#172c62] to-[#2c3f82] px-3 py-2 text-xs font-semibold leading-none text-white transition ${
                          showCandidateMatchPanel
                            ? "border-[#35579f] shadow-sm"
                            : "border-[#28467f] hover:brightness-110"
                        }`}
                        type="button"
                        onClick={() => setShowCandidateMatchPanel((prev) => !prev)}
                      >
                        <span className="inline-flex translate-y-[1px] items-center gap-1.5 whitespace-nowrap">
                          <AISparkleIcon className="h-5 w-5 text-cyan-200" />
                          AI Candidate Match
                        </span>
                      </button>
                      {candidateMatchingJob && (
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            candidateMatchStatusClassName[candidateMatchingJob.status]
                          }`}
                        >
                          {candidateMatchStatusLabel[candidateMatchingJob.status]}
                        </span>
                      )}
                    </div>

                    {showCandidateMatchPanel && (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-[#2c4f98]/20 bg-gradient-to-r from-[#f5f8ff] via-white to-[#f8fbff] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#35579f]">AI Candidate Match</p>
                          <h3 className="mt-1 text-base font-semibold text-slate-900">Автоматичний рейтинг кандидатів</h3>
                          <p className="mt-1 text-sm text-slate-600">
                            ШІ аналізує відгуки, оцінює релевантність і формує рейтинг кандидатів для швидкого найму.
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr,auto,auto,auto]">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Кількість кандидатів у AI-топі
                          </label>
                          <input
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500/60"
                            type="number"
                            min={1}
                            max={100}
                            value={matchRequestedLimit}
                            onChange={(event) => setMatchRequestedLimit(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
                            placeholder="Наприклад: 10"
                          />
                        </div>
                        <button
                          className="rounded-xl bg-[#1f2f5e] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1a2750] disabled:cursor-not-allowed disabled:opacity-60"
                          type="button"
                          onClick={() => void handleStartCandidateMatching()}
                          disabled={
                            !applicationsVacancyFilter
                            || isCandidateMatchingStarting
                            || candidateMatchingJob?.status === "pending"
                            || candidateMatchingJob?.status === "running"
                          }
                        >
                          {(candidateMatchingJob?.status === "pending" || candidateMatchingJob?.status === "running")
                            ? "У процесі..."
                            : isCandidateMatchingStarting
                              ? "Запуск..."
                              : "Згенерувати матч"}
                        </button>
                        <button
                          className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100"
                          type="button"
                          onClick={() => openPaymentsPage("candidate_matching")}
                        >
                          Buy credits
                        </button>
                        <button
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                          type="button"
                          onClick={() => {
                            if (applicationsVacancyFilter) {
                              void loadLatestCandidateMatching(applicationsVacancyFilter)
                            }
                          }}
                          disabled={!applicationsVacancyFilter || isCandidateMatchingLoading}
                        >
                          {isCandidateMatchingLoading ? "Оновлення..." : "Оновити матч"}
                        </button>
                      </div>

                      {!applicationsVacancyFilter && (
                        <p className="mt-2 text-xs text-amber-700">Оберіть конкретну вакансію у фільтрі кандидатів, щоб запустити матчинг.</p>
                      )}
                      {candidateMatchingError && (
                        <div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {candidateMatchingError}
                        </div>
                      )}
                      {candidateMatchingJob?.error && (
                        <div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {candidateMatchingJob.error}
                        </div>
                      )}

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">Кандидатів у відборі</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {candidatesInSelectionCount}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">Оновлено</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {candidateMatchingJob ? formatDateTime(candidateMatchingJob.updated_at) : "—"}
                          </div>
                        </div>
                      </div>
                      </div>
                    )}

                    {showCandidateMatchPanel && (candidateMatchingJob?.status === "pending" || candidateMatchingJob?.status === "running") && (
                      <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-sky-800">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" />
                          AI аналізує кандидатів і формує рейтинг
                        </div>
                        <p className="mt-1 text-xs text-sky-700">
                          ШІ обробляє профілі та рахує релевантність. Результат оновиться автоматично.
                        </p>
                        <div className="mt-3 space-y-2">
                          <div className="h-2 overflow-hidden rounded-full bg-white">
                            <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white">
                            <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-indigo-400 via-blue-500 to-sky-500" />
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white">
                            <div className="h-full w-4/5 animate-pulse rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-500" />
                          </div>
                        </div>
                      </div>
                    )}

                    {showCandidateMatchPanel && candidateMatchingJob?.status === "done" && (
                      <div className="mt-4 flex w-full rounded-xl border border-slate-200 bg-slate-50 p-1">
                        <button
                          className={`flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition ${
                            candidateSectionsView === "ai"
                              ? "bg-white text-slate-900 shadow-soft"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                          type="button"
                          onClick={() => setCandidateSectionsView("ai")}
                        >
                          AI-рекомендації кандидатів
                        </button>
                        <button
                          className={`flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition ${
                            candidateSectionsView === "all"
                              ? "bg-white text-slate-900 shadow-soft"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                          type="button"
                          onClick={() => setCandidateSectionsView("all")}
                        >
                          Всі кандидати
                        </button>
                      </div>
                    )}

                    {showCandidateMatchPanel && candidateMatchingJob?.status === "done" && candidateSectionsView === "ai" && (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold text-slate-900">AI-рекомендації кандидатів</h4>
                          <span className="text-xs text-slate-500">
                            Топ {candidateMatchingJob.result.length} кандидатів
                          </span>
                        </div>

                        {candidateMatchingJob.result.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                            Підходящих кандидатів не знайдено.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {candidateMatchingJob.result.map((item) => (
                              <article
                                key={`match-${candidateMatchingJob.job_id}-${item.application_id}`}
                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"
                              >
                                <div className="flex flex-wrap items-start gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded-full border border-[#2c4f98]/30 bg-[#eef3ff] px-2.5 py-1 text-xs font-semibold text-[#1f3f86]">
                                        #{item.rank}
                                      </span>
                                      <h5 className="truncate text-sm font-semibold text-slate-900">
                                        {item.candidate_name}
                                      </h5>
                                    </div>
                                    <p className="mt-1 text-sm text-slate-600">
                                      {item.title}
                                      {item.desired_role ? ` · ${item.desired_role}` : ""}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {[item.location, item.years_experience != null ? `${item.years_experience} р.` : null]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </p>
                                    <div className="mt-2">
                                      <div className="text-xs text-slate-500">Score</div>
                                      <div className="text-2xl font-semibold text-slate-900">{item.score_total}</div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-[#1f3f86] via-[#345fb8] to-[#4a7de3]"
                                    style={{ width: `${Math.max(0, Math.min(100, item.score_total))}%` }}
                                  />
                                </div>

                                <p className="mt-3 text-sm text-slate-700">{item.summary}</p>

                                <div className="mt-4 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
                                  <button
                                    className="shrink-0 rounded-xl bg-[#1f2f5e] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1b294f] disabled:cursor-not-allowed disabled:opacity-60"
                                    type="button"
                                    onClick={() => void handleWriteToMatchedCandidate(item)}
                                    disabled={matchedChatStartingId === item.application_id}
                                  >
                                    {matchedChatStartingId === item.application_id ? "Відкриття..." : "Написати кандидату"}
                                  </button>
                                  <button
                                    className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                                    type="button"
                                    onClick={() => void handleOpenMatchedResume(item)}
                                    disabled={matchedResumeOpeningId === item.application_id}
                                  >
                                    {matchedResumeOpeningId === item.application_id ? "Відкриваємо..." : "Відкрити резюме"}
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {isEmployerApplicationsLoading ? (
                      <div className="mt-4 text-sm text-slate-500">Завантаження відгуків...</div>
                    ) : employerApplications.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                        По обраній вакансії поки немає відгуків.
                      </div>
                    ) : showCandidateMatchPanel && candidateMatchingJob?.status === "done" && candidateSectionsView === "ai" ? null : (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-900">Всі кандидати</h4>
                          <span className="text-xs text-slate-500">
                            Показано {employerApplications.length} з {employerApplications.length}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {employerApplications.map((application) => renderApplicationCard(application))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            </div>
          </section>
        </div>

        {company && (
          <section className="mt-6 rounded-[26px] border border-slate-200 bg-white p-6 shadow-medium">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold text-slate-900">
              {editingVacancyId ? "Редагувати вакансію" : "Нова вакансія"}
            </h2>
            <div className="flex items-center gap-2">
              <button
                className={`rounded-xl border bg-gradient-to-r from-[#0f1f46] via-[#172c62] to-[#2c3f82] px-3 py-2 text-xs font-semibold leading-none text-white transition ${
                  showAIPromptEditor
                    ? "border-[#35579f] shadow-sm"
                    : "border-[#28467f] hover:brightness-110"
                }`}
                type="button"
                onClick={() => {
                  setVacancyError(null)
                  setVacancySuccess(null)
                  setShowAIPromptEditor((prev) => !prev)
                }}
                disabled={!company || isVacancySaving || isAIFilling}
              >
                <span className="inline-flex translate-y-[1px] items-center gap-1.5 whitespace-nowrap">
                  <AISparkleIcon className="h-5 w-5 text-cyan-200" />
                  AI допомога
                </span>
              </button>
              <button
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100"
                type="button"
                onClick={() => openPaymentsPage("vacancy_ai_fill")}
              >
                Buy credits
              </button>
              <button
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-500"
                type="button"
                onClick={startCreateVacancy}
                disabled={!company}
              >
                Очистити
              </button>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleVacancySubmit}>
            {showAIPromptEditor && (
              <div className="relative overflow-hidden rounded-2xl border border-[#243b77]/35 bg-gradient-to-r from-[#0d1b3f] via-[#14295b] to-[#263b78] p-4 text-white shadow-medium">
                <div className="pointer-events-none absolute -right-10 -top-8 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
                <div className="pointer-events-none absolute -left-8 -bottom-10 h-24 w-24 rounded-full bg-orange-300/20 blur-2xl" />

                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                      AI Copilot
                    </p>
                    <p className="mt-1 text-xs text-white/80">
                      Опиши вакансію вільним текстом. AI підставить чернетку в поля нижче.
                    </p>
                  </div>
                  <button
                    className="rounded-lg border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                    type="button"
                    onClick={() => {
                      setShowAIPromptEditor(false)
                      setAiDescription("")
                    }}
                    disabled={isAIFilling}
                  >
                    Закрити
                  </button>
                </div>

                <textarea
                  ref={aiTextareaRef}
                  className="mt-3 min-h-[96px] w-full rounded-xl border border-white/30 bg-white/95 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                  placeholder="Наприклад: шукаємо Python Developer (FastAPI), 3+ роки, remote або hybrid, зарплата 2500-3500 USD, англійська B2..."
                  value={aiDescription}
                  onChange={(event) => setAiDescription(event.target.value)}
                  disabled={!company || isAIFilling}
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold leading-none text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    onClick={handleAIFillVacancy}
                    disabled={!company || isAIFilling || isVacancySaving}
                  >
                    {isAIFilling ? (
                      <span className="inline-flex translate-y-[1px] items-center gap-2 whitespace-nowrap">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/40 border-t-white" />
                        Генерація...
                      </span>
                    ) : (
                      <span className="inline-flex translate-y-[1px] items-center gap-2 whitespace-nowrap">
                        <AISparkleIcon className="h-5 w-5 text-yellow-100" />
                        Згенерувати чернетку
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
              placeholder="Назва вакансії *"
              value={vacancyForm.title}
              onChange={(event) => setVacancyField("title", event.target.value)}
              disabled={!company}
            />

            <textarea
              className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
              placeholder="Опис вакансії *"
              value={vacancyForm.description}
              onChange={(event) => setVacancyField("description", event.target.value)}
              disabled={!company}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <textarea
                className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                placeholder="Обов'язки"
                value={vacancyForm.responsibilities}
                onChange={(event) => setVacancyField("responsibilities", event.target.value)}
                disabled={!company}
              />
              <textarea
                className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                placeholder="Вимоги"
                value={vacancyForm.requirements}
                onChange={(event) => setVacancyField("requirements", event.target.value)}
                disabled={!company}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Умови роботи
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Тип зайнятості
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {employmentTypeOptions.map((option) => {
                      const active = vacancyForm.employment_type.includes(option)
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? "border-orange-400 bg-orange-100 text-orange-700"
                              : "border-slate-300 bg-slate-50 text-slate-700"
                          }`}
                          onClick={() => toggleVacancyOption("employment_type", option)}
                          disabled={!company}
                        >
                          {option}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Формат роботи
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {workFormatOptions.map((option) => {
                      const active = vacancyForm.work_format.includes(option)
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? "border-orange-400 bg-orange-100 text-orange-700"
                              : "border-slate-300 bg-slate-50 text-slate-700"
                          }`}
                          onClick={() => toggleVacancyOption("work_format", option)}
                          disabled={!company}
                        >
                          {option}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <CityAutocomplete
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Оберіть місто"
                  value={vacancyForm.location}
                  onChange={(value) => setVacancyField("location", value)}
                  onOptionSelect={(option: CityOption | null) => {
                    setVacancyField("city_id", option?.id ?? null)
                    if (option) {
                      setVacancyField("location", option.name_uk)
                    }
                  }}
                  disabled={!company}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                    placeholder="Досвід від (роки)"
                    type="number"
                    value={vacancyForm.experience_years_min}
                    onChange={(event) => setVacancyField("experience_years_min", event.target.value)}
                    disabled={!company}
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                    placeholder="Досвід до (роки)"
                    type="number"
                    value={vacancyForm.experience_years_max}
                    onChange={(event) => setVacancyField("experience_years_max", event.target.value)}
                    disabled={!company}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Компенсація
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr,1fr,140px]">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Зарплата від"
                  type="number"
                  value={vacancyForm.salary_min}
                  onChange={(event) => setVacancyField("salary_min", event.target.value)}
                  disabled={!company}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Зарплата до"
                  type="number"
                  value={vacancyForm.salary_max}
                  onChange={(event) => setVacancyField("salary_max", event.target.value)}
                  disabled={!company}
                />
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-orange-500/60"
                  value={vacancyForm.salary_currency}
                  onChange={(event) => setVacancyField("salary_currency", event.target.value)}
                  disabled={!company}
                >
                  {currencyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={vacancyForm.is_active}
                onChange={(event) => setVacancyField("is_active", event.target.checked)}
                disabled={!company}
              />
              Активна вакансія
            </label>

            {vacancyError && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
                {vacancyError}
              </div>
            )}
            {vacancySuccess && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                {vacancySuccess}
              </div>
            )}

            <button
              className="w-full rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={!company || isVacancySaving}
            >
              {editingVacancyId ? "Зберегти вакансію" : "Створити вакансію"}
            </button>
          </form>
          </section>
        )}

        {selectedApplicationResume && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-strong">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Повне резюме</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">
                    {selectedApplicationResume.resume.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedApplicationResume.vacancyTitle} · {selectedApplicationResume.candidateLabel}
                  </p>
                </div>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400"
                  type="button"
                  onClick={() => setSelectedApplicationResume(null)}
                >
                  Закрити
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-slate-700">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Бажана роль</span>
                  <div className="mt-1 font-medium text-slate-900">
                    {selectedApplicationResume.resume.desired_role || "Не вказано"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Локація</span>
                  <div className="mt-1 font-medium text-slate-900">
                    {selectedApplicationResume.resume.location || "Не вказано"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Досвід</span>
                  <div className="mt-1 font-medium text-slate-900">
                    {selectedApplicationResume.resume.years_experience !== null
                      && selectedApplicationResume.resume.years_experience !== undefined
                      ? `${selectedApplicationResume.resume.years_experience} років`
                      : "Не вказано"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Зарплата</span>
                  <div className="mt-1 font-medium text-slate-900">
                    {formatApplicationResumeSalary(selectedApplicationResume.resume)}
                  </div>
                </div>
              </div>

              {selectedApplicationResume.resume.employment_type?.length ? (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Тип зайнятості</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedApplicationResume.resume.employment_type.map((item) => (
                      <span
                        key={`${selectedApplicationResume.resume.id}-${item}`}
                        className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedApplicationResume.resume.summary && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Про кандидата</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {selectedApplicationResume.resume.summary}
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                  type="button"
                  onClick={() => setSelectedApplicationResume(null)}
                >
                  Закрити
                </button>
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={() => void handleOpenApplicationResumePdf(selectedApplicationResume.resume.id)}
                  disabled={!selectedApplicationResume.resume.pdf_file_path}
                >
                  Відкрити PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EmployerDashboard

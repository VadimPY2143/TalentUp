import { useEffect, useRef, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import AISparkleIcon from "../components/icons/AISparkleIcon"
import Navbar from "../components/layout/Navbar"
import { getApplicationResume, listEmployerApplications, openApplicationResumePdf } from "../api/applications"
import { deleteSavedResumeByCompany, listSavedResumesByCompany } from "../api/candidates"
import { createCompany, listCompanies, updateCompany } from "../api/companies"
import {
  aiFillCompanyVacancy,
  createCompanyVacancy,
  deleteCompanyVacancy,
  listCompanyVacancies,
  updateCompanyVacancy,
} from "../api/vacancies"
import type { CompanyPayload, CompanyResponse } from "../types/company"
import type { ApplicationResume, ApplicationStatus, JobApplication } from "../types/application"
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
  location: string
  salary_min: string
  salary_max: string
  salary_currency: string
  experience_years_min: string
  experience_years_max: string
  employment_type: string[]
  work_format: string[]
  expires_at: string
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
  location: "",
  salary_min: "",
  salary_max: "",
  salary_currency: "UAH",
  experience_years_min: "",
  experience_years_max: "",
  employment_type: [],
  work_format: [],
  expires_at: "",
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
  location: toText(form.location),
  salary_min: form.salary_min ? Number(form.salary_min) : undefined,
  salary_max: form.salary_max ? Number(form.salary_max) : undefined,
  salary_currency: form.salary_currency,
  experience_years_min: form.experience_years_min ? Number(form.experience_years_min) : undefined,
  experience_years_max: form.experience_years_max ? Number(form.experience_years_max) : undefined,
  employment_type: form.employment_type.length ? form.employment_type : undefined,
  work_format: form.work_format.length ? form.work_format : undefined,
  expires_at: form.expires_at ? `${form.expires_at}T00:00:00` : undefined,
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
  location: vacancy.location ?? "",
  salary_min: vacancy.salary_min ? String(vacancy.salary_min) : "",
  salary_max: vacancy.salary_max ? String(vacancy.salary_max) : "",
  salary_currency: vacancy.salary_currency ?? "UAH",
  experience_years_min: vacancy.experience_years_min ? String(vacancy.experience_years_min) : "",
  experience_years_max: vacancy.experience_years_max ? String(vacancy.experience_years_max) : "",
  employment_type: vacancy.employment_type ?? [],
  work_format: vacancy.work_format ?? [],
  expires_at: vacancy.expires_at ? vacancy.expires_at.slice(0, 10) : "",
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
    expires_at: toDateInputValue(vacancy.expires_at),
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
  accepted: "Прийнято",
  rejected: "Відхилено",
}

const applicationStatusClassName: Record<ApplicationStatus, string> = {
  applied: "border-sky-200 bg-sky-50 text-sky-700",
  viewed: "border-indigo-200 bg-indigo-50 text-indigo-700",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
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
  const [expandedApplicationId, setExpandedApplicationId] = useState<number | null>(null)
  const [applicationResumeLoadingId, setApplicationResumeLoadingId] = useState<number | null>(null)
  const [selectedApplicationResume, setSelectedApplicationResume] = useState<{
    resume: ApplicationResume
    vacancyTitle: string
    candidateId: number
  } | null>(null)
  const [applicationResumeError, setApplicationResumeError] = useState<string | null>(null)
  const [aiDescription, setAiDescription] = useState("")
  const [isAIFilling, setIsAIFilling] = useState(false)
  const [showAIPromptEditor, setShowAIPromptEditor] = useState(false)
  const aiTextareaRef = useRef<HTMLTextAreaElement | null>(null)

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

  const handleOpenApplicationResume = async (application: JobApplication) => {
    setApplicationResumeError(null)
    try {
      setApplicationResumeLoadingId(application.id)
      const resume = await getApplicationResume(application.id)
      setSelectedApplicationResume({
        resume,
        vacancyTitle: application.vacancy?.title ?? `Вакансія #${application.vacancy_id}`,
        candidateId: application.user_id,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося відкрити повне резюме"
      setApplicationResumeError(message)
    } finally {
      setApplicationResumeLoadingId(null)
    }
  }

  const handleWriteToCandidate = (application: JobApplication) => {
    if (!application.resume_id) {
      setApplicationResumeError("Для цього відгуку не знайдено резюме")
      return
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

  const setCompanyField = (key: keyof CompanyFormState, value: string) => {
    setCompanyForm((prev) => ({ ...prev, [key]: value }))
  }

  const setVacancyField = (key: keyof VacancyFormState, value: string | boolean) => {
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

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.12fr,0.88fr]">
          <section className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-medium">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">
                {company ? "Профіль компанії" : "Створити компанію"}
              </h2>
              <div className="flex items-center gap-2">
                {company && (
                  <button
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-500"
                    type="button"
                    onClick={() => setShowCompanyEditor((prev) => !prev)}
                  >
                    {showCompanyEditor ? "Сховати редагування" : "Редагувати профіль"}
                  </button>
                )}
                <button
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-500"
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
              <div className="mt-4 flex flex-1 flex-col gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Відкриті вакансії</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{vacancies.length}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Заповненість профілю</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{companyProfileCompleteness}%</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Рік заснування</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {company.founded_year ? company.founded_year : "—"}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Контакти та дані компанії
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    <div>
                      <span className="text-slate-500">Email:</span>{" "}
                      {company.email ?? "Не вказано"}
                    </div>
                    <div>
                      <span className="text-slate-500">Телефон:</span>{" "}
                      {company.phone ?? "Не вказано"}
                    </div>
                    <div className="sm:col-span-2">
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
                    <div className="sm:col-span-2">
                      <span className="text-slate-500">Адреса:</span>{" "}
                      {[company.country, company.city, company.address].filter(Boolean).join(", ") || "Не вказано"}
                    </div>
                  </div>
                </div>
                <div className="mt-auto text-xs text-slate-500">
                  Оновлено: {formatDate(company.updated_at)}
                </div>
              </div>
            )}

            {(!company || showCompanyEditor) && (
              <form className="mt-6 space-y-4" onSubmit={handleCompanySubmit}>
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

          <section className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-medium">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">
                {rightPanelView === "vacancies"
                  ? "Вакансії компанії"
                  : rightPanelView === "saved"
                    ? "Збережені кандидати"
                    : "Відгуки кандидатів"}
              </h2>
              <button
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
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

            <div className="mt-3 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
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

            <p className="mt-2 text-sm text-slate-500">
              {company
                ? `Компанія: ${company.name}`
                : "Створіть компанію, щоб керувати вакансіями та збереженими кандидатами"}
            </p>

            {rightPanelView === "vacancies" ? (
              !company ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                  Вакансії стануть доступні після створення компанії.
                </div>
              ) : isVacancyLoading ? (
                <div className="mt-6 text-sm text-slate-500">Завантаження вакансій...</div>
              ) : vacancies.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                  Поки що вакансій немає. Створіть першу вакансію.
                </div>
              ) : (
                <div className="mt-4 flex flex-1 flex-col">
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
                    <div className="mt-auto pt-3">
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
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Розділ активується після створення компанії.
                  </div>
                ) : isSavedResumesLoading ? (
                  <div className="mt-6 text-sm text-slate-500">Завантаження збережених резюме...</div>
                ) : savedResumes.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    У вас поки немає збережених резюме.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-1">
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
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Розділ активується після створення компанії.
                  </div>
                ) : (
                  <>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Фільтр по вакансії
                      </label>
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-orange-500/60"
                        value={applicationsVacancyFilter ?? ""}
                        onChange={(event) => {
                          const raw = event.target.value
                          setApplicationsVacancyFilter(raw ? Number(raw) : null)
                          setExpandedApplicationId(null)
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

                    {isEmployerApplicationsLoading ? (
                      <div className="mt-6 text-sm text-slate-500">Завантаження відгуків...</div>
                    ) : employerApplications.length === 0 ? (
                      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                        По обраній вакансії поки немає відгуків.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {employerApplications.map((application) => {
                          const isExpanded = expandedApplicationId === application.id
                          const sortedHistory = [...(application.history ?? [])].sort(
                            (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
                          )
                          return (
                            <article
                              key={application.id}
                              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <h3 className="text-base font-semibold text-slate-900">
                                    {application.vacancy?.title ?? `Вакансія #${application.vacancy_id}`}
                                  </h3>
                                  <p className="mt-1 text-sm text-slate-600">
                                    Кандидат #{application.user_id}
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
                                  className="rounded-xl bg-[#1f2f5e] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1b294f] disabled:cursor-not-allowed disabled:opacity-60"
                                  type="button"
                                  onClick={() => handleWriteToCandidate(application)}
                                  disabled={!application.resume_id}
                                >
                                  Написати кандидату
                                </button>
                                <button
                                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                                  type="button"
                                  onClick={() => void handleOpenApplicationResume(application)}
                                  disabled={applicationResumeLoadingId === application.id}
                                >
                                  {applicationResumeLoadingId === application.id ? "Відкриваємо..." : "Відкрити резюме"}
                                </button>
                                <button
                                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
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
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
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
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Локація"
                  value={vacancyForm.location}
                  onChange={(event) => setVacancyField("location", event.target.value)}
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

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Дата закриття вакансії
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                type="date"
                value={vacancyForm.expires_at}
                onChange={(event) => setVacancyField("expires_at", event.target.value)}
                disabled={!company}
              />
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
                    {selectedApplicationResume.vacancyTitle} · Кандидат #{selectedApplicationResume.candidateId}
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

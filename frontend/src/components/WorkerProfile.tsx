import { useEffect, useState, useDeferredValue, useMemo, useRef, type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"
import CityAutocomplete from "./CityAutocomplete"
import VacancyModal from "./VacancyModal"
import {
  Star,
  Settings,
  LogOut,
  User,
  MapPin,
  Phone,
  GraduationCap,
  Calendar,
  Globe,
  FileText,
  Save,
  ChevronRight,
  FileStack,
  Send,
  Bell,
  BarChart3,
  Home,
  Trash2,
  ExternalLink,
  X,
} from "lucide-react"
import { useAuth } from "../auth/useAuth"
import {
  getUserProfile,
  updateUserProfile,
  createUserProfile,
  type UserProfile,
  type UserProfileUpdate,
} from "../api/userProfile"
import { searchLanguages } from "../api/profile"
import type { LanguageOption, UserLanguage, UserLink } from "../types/profile"
import {
  createResume,
  deleteResume,
  deleteResumePdf,
  listResumes,
  openResumePdf,
  updateResume,
  uploadResumePdf,
} from "../api/resumes"
import { listMyApplications, createApplication } from "../api/applications"
import { listSavedVacancies, deleteSavedVacancy } from "../api/savedVacancies"
import type { CityOption } from "../types/city"
import type { CurrencyType, EmploymentType, Resume } from "../types/resume"
import type { ApplicationStatus, JobApplication } from "../types/application"
import type { SavedVacancy } from "../api/savedVacancies"
import type { VacancyResponse } from "../types/vacancy"
import Navbar from "./layout/Navbar"
import AnalyticsDashboard from "./analytics/AnalyticsDashboardV2"
import VacancySubscriptionsPanel from "./worker/VacancySubscriptionsPanel"
import PasswordSettingsPanel from "./worker/PasswordSettingsPanel"

interface WorkerProfileProps {
  userEmail?: string
  userName?: string
}

type Section = "overview" | "resumes" | "applications" | "saved" | "notifications" | "analytics" | "settings" | "profile"

interface CreateResumeFormState {
  title: string
  desired_role: string
  summary: string
  city_id: number | null
  location: string
  employment_type: EmploymentType[]
  salary_min: string
  salary_max: string
  salary_currency: CurrencyType
  years_experience: string
  is_active: boolean
}

const createResumeInitialForm: CreateResumeFormState = {
  title: "",
  desired_role: "",
  summary: "",
  city_id: null,
  location: "",
  employment_type: ["Remote"],
  salary_min: "",
  salary_max: "",
  salary_currency: "UAH",
  years_experience: "",
  is_active: true,
}

const employmentTypeOptions: EmploymentType[] = ["Remote", "Office", "Hybrid"]

interface ApplyModalProps {
  vacancy: any | null
  resumes: Resume[]
  selectedResumeId: number | null
  coverLetter: string
  isSubmitting: boolean
  onResumeChange: (resumeId: number) => void
  onCoverLetterChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}

const ApplyModal = ({
  vacancy,
  resumes,
  selectedResumeId,
  coverLetter,
  isSubmitting,
  onResumeChange,
  onCoverLetterChange,
  onClose,
  onSubmit,
}: ApplyModalProps) => {
  if (!vacancy) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-strong">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Application</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">Відгук на вакансію</h2>
            <p className="mt-1 text-sm text-slate-600">{vacancy.title}</p>
          </div>
          <button
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400"
            type="button"
            onClick={onClose}
          >
            Закрити
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Оберіть резюме</label>
            <select
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-orange-400/70"
              value={selectedResumeId ?? ""}
              onChange={(event) => onResumeChange(Number(event.target.value))}
            >
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.title} {resume.is_active ? "• активне" : "• неактивне"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Супровідний лист (опціонально)
            </label>
            <textarea
              className="mt-2 min-h-[110px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-400/70"
              placeholder="Коротко розкажіть, чому ви підходите на цю вакансію"
              value={coverLetter}
              onChange={(event) => onCoverLetterChange(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            className="flex-1 rounded-xl bg-[#1f2f5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b294f] disabled:cursor-not-allowed disabled:opacity-70"
            type="button"
            disabled={isSubmitting || !selectedResumeId}
            onClick={onSubmit}
          >
            {isSubmitting ? "Надсилаємо..." : "Надіслати відгук"}
          </button>
          <button
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Скасувати
          </button>
        </div>
      </div>
    </div>
  )
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

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—"
  }
  return new Date(value).toLocaleString("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
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
  return "Не вказано"
}

const resumeToForm = (resume: Resume): CreateResumeFormState => ({
  title: resume.title ?? "",
  desired_role: resume.desired_role ?? "",
  summary: resume.summary ?? "",
  city_id: resume.city_id ?? null,
  location: resume.location ?? "",
  employment_type: resume.employment_type?.length ? [...resume.employment_type] : ["Remote"],
  salary_min: resume.salary_min !== undefined && resume.salary_min !== null ? String(resume.salary_min) : "",
  salary_max: resume.salary_max !== undefined && resume.salary_max !== null ? String(resume.salary_max) : "",
  salary_currency: (resume.salary_currency as CurrencyType) ?? "UAH",
  years_experience: resume.years_experience !== undefined && resume.years_experience !== null
    ? String(resume.years_experience)
    : "",
  is_active: Boolean(resume.is_active),
})

const WorkerProfile = ({ userEmail, userName }: WorkerProfileProps) => {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState<Section>("overview")
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<UserProfileUpdate>({})
  const [resumes, setResumes] = useState<Resume[]>([])
  const [resumesLoading, setResumesLoading] = useState(false)
  const [resumesError, setResumesError] = useState<string | null>(null)
  const [showCreateResumeForm, setShowCreateResumeForm] = useState(false)
  const [createResumeForm, setCreateResumeForm] = useState<CreateResumeFormState>(createResumeInitialForm)
  const [createResumeLoading, setCreateResumeLoading] = useState(false)
  const [createResumeFile, setCreateResumeFile] = useState<File | null>(null)
  const [editingResumeId, setEditingResumeId] = useState<number | null>(null)
  const [editResumeForm, setEditResumeForm] = useState<CreateResumeFormState>(createResumeInitialForm)
  const [editResumeFile, setEditResumeFile] = useState<File | null>(null)
  const [editResumeLoading, setEditResumeLoading] = useState(false)
  const [deletingResumeId, setDeletingResumeId] = useState<number | null>(null)
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [applicationsError, setApplicationsError] = useState<string | null>(null)
  const [savedVacancies, setSavedVacancies] = useState<SavedVacancy[]>([])
  const [savedVacanciesLoading, setSavedVacanciesLoading] = useState(false)
  const [savedVacanciesError, setSavedVacanciesError] = useState<string | null>(null)
  const [selectedVacancy, setSelectedVacancy] = useState<VacancyResponse | null>(null)
  const [applyVacancy, setApplyVacancy] = useState<VacancyResponse | null>(null)
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null)
  const [coverLetter, setCoverLetter] = useState("")
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false)
  const [languageQuery, setLanguageQuery] = useState("")
  const [languageSuggestions, setLanguageSuggestions] = useState<LanguageOption[]>([])
  const [showLanguageSuggestions, setShowLanguageSuggestions] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption | null>(null)
  const [selectedProficiency, setSelectedProficiency] = useState<string>("")
  const deferredLanguageQuery = useDeferredValue(languageQuery)
  const languageSuggestionBoxRef = useRef<HTMLDivElement | null>(null)
  const [linkTitle, setLinkTitle] = useState("")
  const [linkUrl, setLinkUrl] = useState("")

  const proficiencyLevels = [
    { value: "A1", label: "A1 - Початковий" },
    { value: "A2", label: "A2 - Елементарний" },
    { value: "B1", label: "B1 - Середній" },
    { value: "B2", label: "B2 - Вищий середній" },
    { value: "C1", label: "C1 - Просунутий" },
    { value: "C2", label: "C2 - Рідна" },
  ]

  useEffect(() => {
    void loadProfile()
    void loadResumes()
    void loadApplications()
    void loadSavedVacancies()
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadLanguageSuggestions = async () => {
      try {
        const options = await searchLanguages(deferredLanguageQuery, 10)
        if (!cancelled) {
          setLanguageSuggestions(options)
        }
      } catch {
        if (!cancelled) {
          setLanguageSuggestions([])
        }
      }
    }

    if (!showLanguageSuggestions) {
      return () => {
        cancelled = true
      }
    }

    void loadLanguageSuggestions()
    return () => {
      cancelled = true
    }
  }, [deferredLanguageQuery, showLanguageSuggestions])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageSuggestionBoxRef.current && !languageSuggestionBoxRef.current.contains(event.target as Node)) {
        setShowLanguageSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const loadProfile = async () => {
    try {
      setProfileLoading(true)
      const data = await getUserProfile()
      setProfile(data)
      setFormData({
        city: data.city,
        education: data.education,
        bio: data.bio,
        birth_date: data.birth_date,
        phone: data.phone,
        languages: data.languages,
        links: data.links,
        user_languages: data.user_languages?.map((ul) => ({
          name: ul.language_name,
          proficiency_level: ul.proficiency_level,
        })),
        user_links: data.user_links?.map((ul) => ({
          title: ul.title,
          url: ul.url,
        })),
      })
      setProfileError(null)
    } catch (err) {
      // Якщо профіль не знайдено (404), створюємо порожній без помилки
      const errorMsg = err instanceof Error ? err.message.toLowerCase() : ""
      const isNotFound = errorMsg.includes("404") || errorMsg.includes("not found") || errorMsg.includes("не знайдено") || errorMsg.includes("failed to fetch")
      if (isNotFound) {
        try {
          const newProfile = await createUserProfile({})
          setProfile(newProfile)
          setFormData({})
          setProfileError(null)
        } catch {
          // Якщо не вдалося створити, просто показуємо порожню форму
          setProfile({
            id: 0,
            user_id: 0,
            city: null,
            education: null,
            bio: null,
            birth_date: null,
            phone: null,
            languages: null,
            links: null,
            created_at: "",
            updated_at: "",
          })
          setFormData({})
          setProfileError(null)
        }
      } else {
        // Інші помилки теж не показуємо
        setProfileError(null)
      }
    } finally {
      setProfileLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setProfileLoading(true)
      const updated = await updateUserProfile(formData)
      setProfile(updated)
      setIsEditing(false)
      setProfileError(null)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Помилка збереження")
    } finally {
      setProfileLoading(false)
    }
  }

  const loadResumes = async () => {
    try {
      setResumesLoading(true)
      setResumesError(null)
      const data = await listResumes()
      setResumes(data)
    } catch (err) {
      setResumesError(err instanceof Error ? err.message : "Не вдалося завантажити резюме")
    } finally {
      setResumesLoading(false)
    }
  }

  const loadApplications = async () => {
    try {
      setApplicationsLoading(true)
      setApplicationsError(null)
      const data = await listMyApplications()
      setApplications(data)
    } catch (err) {
      setApplicationsError(err instanceof Error ? err.message : "Не вдалося завантажити відгуки")
    } finally {
      setApplicationsLoading(false)
    }
  }

  const loadSavedVacancies = async () => {
    try {
      setSavedVacanciesLoading(true)
      setSavedVacanciesError(null)
      const data = await listSavedVacancies()
      setSavedVacancies(data)
    } catch (err) {
      setSavedVacanciesError(err instanceof Error ? err.message : "Не вдалося завантажити збережені вакансії")
    } finally {
      setSavedVacanciesLoading(false)
    }
  }

  const handleRemoveSavedVacancy = async (savedVacancyId: number) => {
    const confirmed = window.confirm("Видалити цю вакансію зі збережених?")
    if (!confirmed) {
      return
    }
    try {
      await deleteSavedVacancy(savedVacancyId)
      await loadSavedVacancies()
    } catch (err) {
      setSavedVacanciesError(err instanceof Error ? err.message : "Не вдалося видалити вакансію")
    }
  }

  const handleViewVacancy = (savedVacancy: SavedVacancy) => {
    if (savedVacancy.vacancy) {
      setSelectedVacancy(savedVacancy.vacancy)
    }
  }

  const openApplyModal = (vacancy: VacancyResponse) => {
    if (resumes.length === 0) {
      alert("Спочатку створіть хоча б одне резюме.")
      return
    }

    const availableResumes = resumes.filter((resume) => resume.is_active)
    if (availableResumes.length === 0) {
      alert("Потрібно мати активне резюме, щоб відгукнутися.")
      return
    }

    const preferredResume = availableResumes[0]
    setSelectedResumeId(preferredResume?.id ?? null)
    setCoverLetter("")
    setApplyVacancy(vacancy)
    setSelectedVacancy(null)
  }

  const closeApplyModal = () => {
    if (isSubmittingApplication) {
      return
    }
    setApplyVacancy(null)
    setCoverLetter("")
    setSelectedResumeId(null)
  }

  const submitApplication = async () => {
    if (!applyVacancy || !selectedResumeId) {
      return
    }

    try {
      setIsSubmittingApplication(true)
      await createApplication({
        vacancy_id: applyVacancy.id,
        resume_id: selectedResumeId,
        cover_letter: coverLetter || undefined,
      })
      await loadApplications()
      closeApplyModal()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не вдалося подати відгук")
    } finally {
      setIsSubmittingApplication(false)
    }
  }

  const handleOpenResumePdf = async (resumeId: number) => {
    try {
      await openResumePdf(resumeId)
    } catch (err) {
      setResumesError(err instanceof Error ? err.message : "Не вдалося відкрити PDF")
    }
  }

  const handleToggleEmploymentType = (value: EmploymentType) => {
    setCreateResumeForm((prev) => {
      const exists = prev.employment_type.includes(value)
      const next = exists
        ? prev.employment_type.filter((item) => item !== value)
        : [...prev.employment_type, value]
      return { ...prev, employment_type: next }
    })
  }

  const handleToggleEditEmploymentType = (value: EmploymentType) => {
    setEditResumeForm((prev) => {
      const exists = prev.employment_type.includes(value)
      const next = exists
        ? prev.employment_type.filter((item) => item !== value)
        : [...prev.employment_type, value]
      return { ...prev, employment_type: next }
    })
  }

  const handleCreateResume = async () => {
    if (!createResumeForm.title.trim()) {
      setResumesError("Назва резюме обов'язкова")
      return
    }
    if (createResumeForm.employment_type.length === 0) {
      setResumesError("Оберіть хоча б один формат роботи")
      return
    }

    try {
      setCreateResumeLoading(true)
      setResumesError(null)
      const created = await createResume({
        title: createResumeForm.title.trim(),
        desired_role: createResumeForm.desired_role.trim() || undefined,
        summary: createResumeForm.summary.trim() || undefined,
        city_id: createResumeForm.city_id ?? undefined,
        location: createResumeForm.location.trim() || undefined,
        employment_type: createResumeForm.employment_type,
        salary_min: createResumeForm.salary_min ? Number(createResumeForm.salary_min) : undefined,
        salary_max: createResumeForm.salary_max ? Number(createResumeForm.salary_max) : undefined,
        salary_currency: createResumeForm.salary_currency,
        years_experience: createResumeForm.years_experience
          ? Number(createResumeForm.years_experience)
          : undefined,
        is_active: createResumeForm.is_active,
      })

      if (createResumeFile && created.id) {
        try {
          await uploadResumePdf(created.id, createResumeFile)
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Невідома помилка"
          setResumesError(`Резюме створено, але PDF не завантажено: ${msg}`)
        }
      }

      setCreateResumeForm(createResumeInitialForm)
      setCreateResumeFile(null)
      setShowCreateResumeForm(false)
      await loadResumes()
    } catch (err) {
      setResumesError(err instanceof Error ? err.message : "Не вдалося створити резюме")
    } finally {
      setCreateResumeLoading(false)
    }
  }

  const handleStartEditResume = (resume: Resume) => {
    setEditingResumeId(resume.id)
    setEditResumeForm(resumeToForm(resume))
    setEditResumeFile(null)
    setResumesError(null)
  }

  const handleCancelEditResume = () => {
    setEditingResumeId(null)
    setEditResumeForm(createResumeInitialForm)
    setEditResumeFile(null)
  }

  const handleSaveEditedResume = async () => {
    if (!editingResumeId) {
      return
    }
    if (!editResumeForm.title.trim()) {
      setResumesError("Назва резюме обов'язкова")
      return
    }
    if (editResumeForm.employment_type.length === 0) {
      setResumesError("Оберіть хоча б один формат роботи")
      return
    }

    try {
      setEditResumeLoading(true)
      setResumesError(null)
      await updateResume(editingResumeId, {
        title: editResumeForm.title.trim(),
        desired_role: editResumeForm.desired_role.trim() || undefined,
        summary: editResumeForm.summary.trim() || undefined,
        city_id: editResumeForm.city_id ?? undefined,
        location: editResumeForm.location.trim() || undefined,
        employment_type: editResumeForm.employment_type,
        salary_min: editResumeForm.salary_min ? Number(editResumeForm.salary_min) : undefined,
        salary_max: editResumeForm.salary_max ? Number(editResumeForm.salary_max) : undefined,
        salary_currency: editResumeForm.salary_currency,
        years_experience: editResumeForm.years_experience
          ? Number(editResumeForm.years_experience)
          : undefined,
        is_active: editResumeForm.is_active,
      })

      if (editResumeFile) {
        await uploadResumePdf(editingResumeId, editResumeFile)
      }

      handleCancelEditResume()
      await loadResumes()
    } catch (err) {
      setResumesError(err instanceof Error ? err.message : "Не вдалося оновити резюме")
    } finally {
      setEditResumeLoading(false)
    }
  }

  const handleRemoveResume = async (resumeId: number) => {
    const confirmed = window.confirm("Видалити це резюме?")
    if (!confirmed) {
      return
    }
    try {
      setDeletingResumeId(resumeId)
      setResumesError(null)
      await deleteResume(resumeId)
      if (editingResumeId === resumeId) {
        handleCancelEditResume()
      }
      await loadResumes()
    } catch (err) {
      setResumesError(err instanceof Error ? err.message : "Не вдалося видалити резюме")
    } finally {
      setDeletingResumeId(null)
    }
  }

  const handleRemoveResumePdf = async (resumeId: number) => {
    try {
      setResumesError(null)
      await deleteResumePdf(resumeId)
      await loadResumes()
    } catch (err) {
      setResumesError(err instanceof Error ? err.message : "Не вдалося видалити PDF")
    }
  }

  const handleLogout = () => {
    logout()
    navigate("/")
  }

  const handleMenuItemClick = (section: Section) => {
    setActiveSection(section)
  }

  const visibleLanguageSuggestions = useMemo(() => {
    const selected = new Set(
      (formData.user_languages || []).map((item) => item.name.toLowerCase())
    )
    return languageSuggestions.filter((item) => !selected.has(item.name.toLowerCase()))
  }, [formData.user_languages, languageSuggestions])

  const addLanguage = () => {
    if (!selectedLanguage || !selectedProficiency) {
      return
    }

    setFormData((prev) => {
      const currentLanguages = prev.user_languages || []
      const exists = currentLanguages.some(
        (item) => item.name.toLowerCase() === selectedLanguage.name.toLowerCase()
      )
      if (exists) {
        return prev
      }
      return {
        ...prev,
        user_languages: [
          ...currentLanguages,
          { name: selectedLanguage.name, proficiency_level: selectedProficiency },
        ],
      }
    })
    setSelectedLanguage(null)
    setSelectedProficiency("")
    setLanguageQuery("")
    setShowLanguageSuggestions(false)
  }

  const removeLanguage = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      user_languages: (prev.user_languages || []).filter((item) => item.name !== name),
    }))
  }

  const addLink = () => {
    const title = linkTitle.trim()
    const url = linkUrl.trim()
    if (!title || !url) {
      return
    }

    setFormData((prev) => {
      const currentLinks = prev.user_links || []
      const exists = currentLinks.some((item) => item.url === url)
      if (exists) {
        return prev
      }
      return {
        ...prev,
        user_links: [...currentLinks, { title, url }],
      }
    })
    setLinkTitle("")
    setLinkUrl("")
  }

  const removeLink = (url: string) => {
    setFormData((prev) => ({
      ...prev,
      user_links: (prev.user_links || []).filter((item) => item.url !== url),
    }))
  }

  const handleLanguageKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      const firstSuggestion = visibleLanguageSuggestions.find(
        (item) => item.name.toLowerCase() === languageQuery.trim().toLowerCase(),
      )
      if (firstSuggestion) {
        setSelectedLanguage(firstSuggestion)
        setLanguageQuery("")
        setShowLanguageSuggestions(false)
      }
    }
  }

  const menuItems = [
    { id: "overview", label: "Огляд", icon: BarChart3 },
    { id: "resumes", label: "Мої резюме", icon: FileStack },
    { id: "applications", label: "Мої відгуки", icon: Send },
    { id: "saved", label: "Обрані вакансії", icon: Star },
    { id: "notifications", label: "Сповіщення", icon: Bell },
    { id: "analytics", label: "Аналітика", icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      <Navbar />

      <div className="mx-auto flex max-w-7xl gap-6 p-6">
        {/* Sidebar */}
        <aside className="w-72 shrink-0">
          {/* User Card */}
          <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] text-white shadow-lg">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-lg font-bold">
                  {(userName || "U")[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold">{userName || "Користувач"}</h3>
                  <p className="text-xs text-white/60">Шукаю роботу</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-4 rounded-2xl bg-white shadow-medium overflow-hidden">
            <button
              onClick={() => navigate("/")}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-slate-600 transition hover:bg-slate-50 border-l-4 border-transparent"
            >
              <Home className="h-5 w-5" />
              <span className="text-sm font-medium">На головну</span>
              <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
            </button>
            <div className="border-t border-slate-100" />
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleMenuItemClick(item.id as Section)}
                className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50 ${
                  activeSection === item.id
                    ? "border-l-4 border-orange-500 bg-orange-50/50"
                    : "border-l-4 border-transparent"
                }`}
              >
                <item.icon className={`h-5 w-5 ${activeSection === item.id ? "text-orange-500" : "text-slate-500"}`} />
                <span className={`text-sm font-medium ${activeSection === item.id ? "text-slate-900" : "text-slate-600"}`}>
                  {item.label}
                </span>
                <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
              </button>
            ))}
            <div className="border-t border-slate-100" />
            <button
              onClick={() => setActiveSection("profile")}
              className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50 ${
                activeSection === "profile"
                  ? "border-l-4 border-orange-500 bg-orange-50/50"
                  : "border-l-4 border-transparent"
              }`}
            >
              <User className={`h-5 w-5 ${activeSection === "profile" ? "text-orange-500" : "text-slate-500"}`} />
              <span className={`text-sm font-medium ${activeSection === "profile" ? "text-slate-900" : "text-slate-600"}`}>
                Мій профіль
              </span>
              <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
            </button>
            <button
              onClick={() => setActiveSection("settings")}
              className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50 ${
                activeSection === "settings"
                  ? "border-l-4 border-orange-500 bg-orange-50/50"
                  : "border-l-4 border-transparent"
              }`}
            >
              <Settings className={`h-5 w-5 ${activeSection === "settings" ? "text-orange-500" : "text-slate-500"}`} />
              <span className={`text-sm font-medium ${activeSection === "settings" ? "text-slate-900" : "text-slate-600"}`}>
                Налаштування
              </span>
              <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-red-500 transition hover:bg-red-50 border-l-4 border-transparent"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-medium">Вийти з акаунту</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {activeSection === "profile" ? (
            <div className="space-y-6">
              {profileError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {profileError}
                </div>
              )}
              {/* Profile Header */}
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-orange-400/20 blur-2xl" />
                <div className="pointer-events-none absolute -left-8 bottom-0 h-44 w-44 rounded-full bg-cyan-300/20 blur-2xl" />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-5">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-500 text-3xl font-bold shadow-lg">
                        {(userName || "U")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-white/60">Особистий кабінет</p>
                        <h1 className="mt-1 text-3xl font-bold">{userName || "Користувач"}</h1>
                        <p className="mt-2 text-white/70">{userEmail}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
                    >
                      {isEditing ? "Скасувати" : "Редагувати профіль"}
                    </button>
                  </div>
                </div>
              </section>

              {/* Profile Details */}
              <section className="rounded-3xl bg-white p-8 shadow-medium">
                {profileLoading ? (
                  <div className="py-12 text-center text-slate-500">Завантаження...</div>
                ) : (
                  <div className="space-y-6">
                    {/* Contact Info */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
                            <MapPin className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Місто</p>
                            {isEditing ? (
                              <input
                                type="text"
                                value={formData.city || ""}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                                placeholder="Вкажіть місто"
                              />
                            ) : (
                              <p className="font-medium text-slate-900">{profile?.city || "Не вказано"}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
                            <Phone className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Телефон</p>
                            {isEditing ? (
                              <input
                                type="text"
                                value={formData.phone || ""}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                                placeholder="+380..."
                              />
                            ) : (
                              <p className="font-medium text-slate-900">{profile?.phone || "Не вказано"}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
                            <GraduationCap className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Освіта</p>
                            {isEditing ? (
                              <input
                                type="text"
                                value={formData.education || ""}
                                onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                                placeholder="Вкажіть освіту"
                              />
                            ) : (
                              <p className="font-medium text-slate-900">{profile?.education || "Не вказано"}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
                            <Calendar className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Дата народження</p>
                            {isEditing ? (
                              <input
                                type="date"
                                value={formData.birth_date || ""}
                                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                              />
                            ) : (
                              <p className="font-medium text-slate-900">
                                {profile?.birth_date
                                  ? new Date(profile.birth_date).toLocaleDateString("uk-UA")
                                  : "Не вказано"}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    <div className="rounded-2xl bg-slate-50 p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                          <FileText className="h-5 w-5 text-orange-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-slate-500">Про себе</p>
                          {isEditing ? (
                            <textarea
                              value={formData.bio || ""}
                              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none min-h-[100px]"
                              placeholder="Розкажіть про себе..."
                            />
                          ) : (
                            <p className="mt-2 whitespace-pre-wrap text-slate-900">
                              {profile?.bio || "Не вказано"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Languages & Links */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                            <Globe className="h-5 w-5 text-orange-500" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-slate-500">Мови</p>
                            {isEditing ? (
                              <div className="space-y-3">
                                <div className="relative" ref={languageSuggestionBoxRef}>
                                  <input
                                    type="text"
                                    value={languageQuery}
                                    onChange={(e) => {
                                      setLanguageQuery(e.target.value)
                                      setShowLanguageSuggestions(true)
                                    }}
                                    onFocus={() => setShowLanguageSuggestions(true)}
                                    onKeyDown={handleLanguageKeyDown}
                                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                                    placeholder="Почніть вводити назву мови..."
                                  />
                                  {showLanguageSuggestions && visibleLanguageSuggestions.length > 0 && (
                                    <div className="absolute z-10 mt-2 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                                      {visibleLanguageSuggestions.map((option) => (
                                        <button
                                          key={option.id}
                                          className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                                          type="button"
                                          onClick={() => {
                                            setSelectedLanguage(option)
                                            setLanguageQuery("")
                                            setShowLanguageSuggestions(false)
                                          }}
                                        >
                                          {option.name}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                
                                {selectedLanguage && (
                                  <div className="flex gap-2">
                                    <select
                                      value={selectedProficiency}
                                      onChange={(e) => setSelectedProficiency(e.target.value)}
                                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                                    >
                                      <option value="">Оберіть рівень</option>
                                      {proficiencyLevels.map((level) => (
                                        <option key={level.value} value={level.value}>
                                          {level.label}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={addLanguage}
                                      className="rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-orange-600"
                                      type="button"
                                    >
                                      Додати
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {profile?.user_languages?.length ? (
                                  profile.user_languages.map((lang) => (
                                    <span
                                      key={lang.id}
                                      className="rounded-lg bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm"
                                    >
                                      {lang.language_name} ({lang.proficiency_level})
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-500">Не вказано</span>
                                )}
                              </div>
                            )}
                            {isEditing && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {formData.user_languages?.length ? (
                                  formData.user_languages.map((lang) => (
                                    <span
                                      key={lang.name}
                                      className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700"
                                    >
                                      {lang.name} ({lang.proficiency_level})
                                      <button
                                        className="text-orange-500 transition hover:text-orange-700"
                                        type="button"
                                        onClick={() => removeLanguage(lang.name)}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-slate-500">Мови ще не додані</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                            <Globe className="h-5 w-5 text-orange-500" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-slate-500">Посилання</p>
                            {isEditing ? (
                              <div className="space-y-3">
                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={linkTitle}
                                    onChange={(e) => setLinkTitle(e.target.value)}
                                    className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                                    placeholder="Назва"
                                  />
                                  <input
                                    type="text"
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                                    placeholder="URL"
                                  />
                                  <button
                                    onClick={addLink}
                                    className="rounded-lg bg-orange-500 px-2 py-1.5 text-sm font-medium text-white transition hover:bg-orange-600 whitespace-nowrap"
                                    type="button"
                                  >
                                    Додати
                                  </button>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {formData.user_links?.length ? (
                                    formData.user_links.map((link) => (
                                      <span
                                        key={link.url}
                                        className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700"
                                      >
                                        {link.title}
                                        <button
                                          className="text-orange-500 transition hover:text-orange-700"
                                          type="button"
                                          onClick={() => removeLink(link.url)}
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-sm text-slate-500">Посилання ще не додані</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {profile?.user_links?.length ? (
                                  profile.user_links.map((link) => (
                                    <a
                                      key={link.id}
                                      href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded-lg bg-orange-100 px-3 py-1 text-sm font-medium text-orange-600 hover:bg-orange-200 transition"
                                    >
                                      {link.title}
                                    </a>
                                  ))
                                ) : (
                                  <span className="text-slate-500">Не вказано</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    {isEditing && (
                      <div className="flex justify-end">
                        <button
                          onClick={handleSave}
                          disabled={profileLoading}
                          className="flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-70"
                        >
                          <Save className="h-4 w-4" />
                          {profileLoading ? "Збереження..." : "Зберегти зміни"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          ) : activeSection === "resumes" ? (
            <div className="space-y-6">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-3xl font-bold">Мої резюме</h1>
                    <p className="mt-2 text-white/80">Ваші активні та архівні резюме</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCreateResumeForm((prev) => !prev)}
                      className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                      type="button"
                    >
                      {showCreateResumeForm ? "Сховати форму" : "Створити резюме"}
                    </button>
                    <button
                      onClick={() => void loadResumes()}
                      className="rounded-xl border border-white/35 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                      type="button"
                      disabled={resumesLoading}
                    >
                      {resumesLoading ? "Оновлення..." : "Оновити"}
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl bg-white p-8 shadow-medium">
                {resumesError && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {resumesError}
                  </div>
                )}
                {showCreateResumeForm && (
                  <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-base font-semibold text-slate-900">Нове резюме</h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                        placeholder="Назва резюме *"
                        value={createResumeForm.title}
                        onChange={(e) => setCreateResumeForm((prev) => ({ ...prev, title: e.target.value }))}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                        placeholder="Бажана роль"
                        value={createResumeForm.desired_role}
                        onChange={(e) => setCreateResumeForm((prev) => ({ ...prev, desired_role: e.target.value }))}
                      />
                      <CityAutocomplete
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                        placeholder="Оберіть місто"
                        value={createResumeForm.location}
                        onChange={(value) => setCreateResumeForm((prev) => ({ ...prev, location: value }))}
                        onOptionSelect={(option: CityOption | null) =>
                          setCreateResumeForm((prev) => ({
                            ...prev,
                            city_id: option?.id ?? null,
                            location: option?.name_uk ?? prev.location,
                          }))
                        }
                      />
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                        placeholder="Роки досвіду"
                        type="number"
                        min={0}
                        value={createResumeForm.years_experience}
                        onChange={(e) => setCreateResumeForm((prev) => ({ ...prev, years_experience: e.target.value }))}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                        placeholder="Зарплата від"
                        type="number"
                        min={0}
                        value={createResumeForm.salary_min}
                        onChange={(e) => setCreateResumeForm((prev) => ({ ...prev, salary_min: e.target.value }))}
                      />
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                          placeholder="Зарплата до"
                          type="number"
                          min={0}
                          value={createResumeForm.salary_max}
                          onChange={(e) => setCreateResumeForm((prev) => ({ ...prev, salary_max: e.target.value }))}
                        />
                        <select
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-orange-400/70"
                          value={createResumeForm.salary_currency}
                          onChange={(e) =>
                            setCreateResumeForm((prev) => ({
                              ...prev,
                              salary_currency: e.target.value as CurrencyType,
                            }))
                          }
                        >
                          <option value="UAH">UAH</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Формат роботи *</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {employmentTypeOptions.map((option) => {
                          const active = createResumeForm.employment_type.includes(option)
                          return (
                            <button
                              key={option}
                              type="button"
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                active
                                  ? "border-orange-400 bg-orange-100 text-orange-700"
                                  : "border-slate-300 bg-white text-slate-700"
                              }`}
                              onClick={() => handleToggleEmploymentType(option)}
                            >
                              {option}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <textarea
                      className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                      placeholder="Коротко про себе"
                      value={createResumeForm.summary}
                      onChange={(e) => setCreateResumeForm((prev) => ({ ...prev, summary: e.target.value }))}
                    />

                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        PDF резюме (опційно)
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-orange-400/70">
                          Обрати файл
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="hidden"
                            onChange={(e) => setCreateResumeFile(e.target.files?.[0] ?? null)}
                          />
                        </label>
                        {createResumeFile && (
                          <>
                            <span className="max-w-[320px] truncate text-xs text-slate-600">
                              {createResumeFile.name}
                            </span>
                            <button
                              className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                              type="button"
                              onClick={() => setCreateResumeFile(null)}
                            >
                              Очистити
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={createResumeForm.is_active}
                        onChange={(e) => setCreateResumeForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                      />
                      Активне резюме
                    </label>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                        type="button"
                        onClick={() => {
                          setShowCreateResumeForm(false)
                          setCreateResumeForm(createResumeInitialForm)
                          setCreateResumeFile(null)
                        }}
                      >
                        Скасувати
                      </button>
                      <button
                        className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                        type="button"
                        onClick={() => void handleCreateResume()}
                        disabled={createResumeLoading}
                      >
                        {createResumeLoading ? "Створення..." : "Створити"}
                      </button>
                    </div>
                  </div>
                )}
                {resumesLoading ? (
                  <div className="py-8 text-sm text-slate-500">Завантаження резюме...</div>
                ) : resumes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                    У вас поки немає резюме.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {resumes.map((resume) => (
                      <article
                        key={resume.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-slate-900">{resume.title}</h3>
                            <p className="mt-1 text-sm text-slate-600">{resume.desired_role || "Роль не вказана"}</p>
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                              <span>Локація: {resume.location || "Не вказано"}</span>
                              <span>Зарплата: {formatResumeSalary(resume)}</span>
                              <span>Оновлено: {formatDateTime(resume.updated_at ?? resume.created_at ?? null)}</span>
                            </div>
                          </div>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              resume.is_active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-600"
                            }`}
                          >
                            {resume.is_active ? "Активне" : "Неактивне"}
                          </span>
                        </div>

                        {resume.summary && (
                          <p className="mt-3 line-clamp-3 text-sm text-slate-600">{resume.summary}</p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            onClick={() => void handleOpenResumePdf(resume.id)}
                            disabled={!resume.pdf_file_path}
                          >
                            {resume.pdf_file_path ? "Відкрити PDF" : "PDF відсутній"}
                          </button>
                          <button
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                            type="button"
                            onClick={() => handleStartEditResume(resume)}
                          >
                            Редагувати
                          </button>
                          <button
                            className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            onClick={() => void handleRemoveResume(resume.id)}
                            disabled={deletingResumeId === resume.id}
                          >
                            {deletingResumeId === resume.id ? "Видалення..." : "Видалити"}
                          </button>
                          {resume.pdf_file_path && (
                            <button
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                              type="button"
                              onClick={() => void handleRemoveResumePdf(resume.id)}
                            >
                              Видалити PDF
                            </button>
                          )}
                        </div>

                        {editingResumeId === resume.id && (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                            <h4 className="text-sm font-semibold text-slate-900">Редагування резюме</h4>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <input
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                                placeholder="Назва резюме *"
                                value={editResumeForm.title}
                                onChange={(e) => setEditResumeForm((prev) => ({ ...prev, title: e.target.value }))}
                              />
                              <input
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                                placeholder="Бажана роль"
                                value={editResumeForm.desired_role}
                                onChange={(e) =>
                                  setEditResumeForm((prev) => ({ ...prev, desired_role: e.target.value }))
                                }
                              />
                              <CityAutocomplete
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                                placeholder="Оберіть місто"
                                value={editResumeForm.location}
                                onChange={(value) => setEditResumeForm((prev) => ({ ...prev, location: value }))}
                                onOptionSelect={(option: CityOption | null) =>
                                  setEditResumeForm((prev) => ({
                                    ...prev,
                                    city_id: option?.id ?? null,
                                    location: option?.name_uk ?? prev.location,
                                  }))
                                }
                              />
                              <input
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                                placeholder="Роки досвіду"
                                type="number"
                                min={0}
                                value={editResumeForm.years_experience}
                                onChange={(e) =>
                                  setEditResumeForm((prev) => ({ ...prev, years_experience: e.target.value }))
                                }
                              />
                              <input
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                                placeholder="Зарплата від"
                                type="number"
                                min={0}
                                value={editResumeForm.salary_min}
                                onChange={(e) => setEditResumeForm((prev) => ({ ...prev, salary_min: e.target.value }))}
                              />
                              <div className="grid grid-cols-[1fr_auto] gap-2">
                                <input
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                                  placeholder="Зарплата до"
                                  type="number"
                                  min={0}
                                  value={editResumeForm.salary_max}
                                  onChange={(e) => setEditResumeForm((prev) => ({ ...prev, salary_max: e.target.value }))}
                                />
                                <select
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-orange-400/70"
                                  value={editResumeForm.salary_currency}
                                  onChange={(e) =>
                                    setEditResumeForm((prev) => ({
                                      ...prev,
                                      salary_currency: e.target.value as CurrencyType,
                                    }))
                                  }
                                >
                                  <option value="UAH">UAH</option>
                                  <option value="USD">USD</option>
                                  <option value="EUR">EUR</option>
                                </select>
                              </div>
                            </div>

                            <div className="mt-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Формат роботи *</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {employmentTypeOptions.map((option) => {
                                  const active = editResumeForm.employment_type.includes(option)
                                  return (
                                    <button
                                      key={`${resume.id}-${option}`}
                                      type="button"
                                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                        active
                                          ? "border-orange-400 bg-orange-100 text-orange-700"
                                          : "border-slate-300 bg-white text-slate-700"
                                      }`}
                                      onClick={() => handleToggleEditEmploymentType(option)}
                                    >
                                      {option}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            <textarea
                              className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
                              placeholder="Коротко про себе"
                              value={editResumeForm.summary}
                              onChange={(e) => setEditResumeForm((prev) => ({ ...prev, summary: e.target.value }))}
                            />

                            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Оновити PDF (опційно)
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-orange-400/70">
                                  Обрати файл
                                  <input
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    className="hidden"
                                    onChange={(e) => setEditResumeFile(e.target.files?.[0] ?? null)}
                                  />
                                </label>
                                {editResumeFile && (
                                  <>
                                    <span className="max-w-[320px] truncate text-xs text-slate-600">
                                      {editResumeFile.name}
                                    </span>
                                    <button
                                      className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                                      type="button"
                                      onClick={() => setEditResumeFile(null)}
                                    >
                                      Очистити
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
                              <input
                                type="checkbox"
                                checked={editResumeForm.is_active}
                                onChange={(e) =>
                                  setEditResumeForm((prev) => ({ ...prev, is_active: e.target.checked }))
                                }
                              />
                              Активне резюме
                            </label>

                            <div className="mt-4 flex justify-end gap-2">
                              <button
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                                type="button"
                                onClick={handleCancelEditResume}
                              >
                                Скасувати
                              </button>
                              <button
                                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                                type="button"
                                onClick={() => void handleSaveEditedResume()}
                                disabled={editResumeLoading}
                              >
                                {editResumeLoading ? "Збереження..." : "Зберегти"}
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : activeSection === "applications" ? (
            <div key="applications-section" className="space-y-6">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="relative flex items-center justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold">Мої відгуки</h1>
                    <p className="mt-2 text-white/80">Відгуки на вакансії та їхні статуси</p>
                  </div>
                  <button
                    onClick={() => void loadApplications()}
                    className="rounded-xl border border-white/35 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                    type="button"
                    disabled={applicationsLoading}
                  >
                    {applicationsLoading ? "Оновлення..." : "Оновити"}
                  </button>
                </div>
              </section>

              <section className="rounded-3xl bg-white p-8 shadow-medium">
                {applicationsError && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {applicationsError}
                  </div>
                )}
                {applicationsLoading ? (
                  <div className="py-8 text-sm text-slate-500">Завантаження відгуків...</div>
                ) : applications.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                    Ви ще не подавали відгуки на вакансії.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.map((application) => (
                      <article
                        key={application.id}
                        className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4 pr-36"
                      >
                        <span
                          className={`absolute right-4 top-4 rounded-full border px-2.5 py-1 text-xs font-semibold ${applicationStatusClassName[application.status]}`}
                        >
                          {applicationStatusLabel[application.status]}
                        </span>

                        <div className="flex flex-wrap items-start gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-slate-900">
                              {application.vacancy?.title ?? `Вакансія #${application.vacancy_id}`}
                            </h3>
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                              <span>Резюме: {application.resume_title ?? "Без назви"}</span>
                              <span>Подано: {formatDateTime(application.created_at)}</span>
                            </div>
                          </div>
                        </div>

                        {application.cover_letter && (
                          <p className="mt-3 line-clamp-3 text-sm text-slate-600">{application.cover_letter}</p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : activeSection === "saved" ? (
            <div key="saved-section" className="space-y-6">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="relative">
                  <h1 className="text-3xl font-bold">Обрані вакансії</h1>
                  <p className="mt-2 text-white/80">Вакансії, які ви зберегли для перегляду пізніше</p>
                </div>
              </section>
              <section className="rounded-3xl bg-white p-8 shadow-medium">
                {savedVacanciesError && (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {savedVacanciesError}
                  </div>
                )}
                {savedVacanciesLoading ? (
                  <div className="py-12 text-center text-slate-500">Завантаження...</div>
                ) : savedVacancies.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <Star className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                    <p>У вас ще немає збережених вакансій</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedVacancies.map((saved) => (
                      <div
                        key={saved.id}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-orange-300 hover:bg-orange-50/30"
                      >
                        <div className="flex-1">
                          <div
                            className="flex items-center gap-2 cursor-pointer hover:text-orange-600 transition"
                            onClick={() => handleViewVacancy(saved)}
                          >
                            <h3 className="font-semibold text-slate-900">
                              {saved.vacancy?.title ?? `Вакансія #${saved.vacancy_id}`}
                            </h3>
                          </div>
                          {saved.note && (
                            <p className="mt-2 text-sm text-slate-600">{saved.note}</p>
                          )}
                          <p className="mt-2 text-xs text-slate-500">
                            Збережено: {new Date(saved.created_at).toLocaleDateString("uk-UA")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => window.open(`/vacancies/${saved.vacancy_id}`, "_blank")}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
                            title="Перегляти вакансію"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveSavedVacancy(saved.id)}
                            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
                            title="Видалити"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : activeSection === "notifications" ? (
            <div className="space-y-6">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="relative">
                  <h1 className="text-3xl font-bold">Сповіщення</h1>
                  <p className="mt-2 text-white/80">Керуйте email-підписками на нові вакансії</p>
                </div>
              </section>
              <VacancySubscriptionsPanel userEmail={userEmail} />
            </div>
          ) : activeSection === "analytics" ? (
            <div className="space-y-6">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="relative">
                  <h1 className="text-3xl font-bold">Аналітика</h1>
                  <p className="mt-2 text-white/80">Статистика переглядів профілю та відгуків</p>
                </div>
              </section>
              <AnalyticsDashboard embedded hideLeadCard />
            </div>
          ) : activeSection === "settings" ? (
            <div className="space-y-6">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="relative">
                  <h1 className="text-3xl font-bold">Налаштування</h1>
                  <p className="mt-2 text-white/80">Змініть пароль та налаштуйте сповіщення</p>
                </div>
              </section>
              <PasswordSettingsPanel />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview Header */}
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-orange-400/20 blur-2xl" />
                <div className="pointer-events-none absolute -left-8 bottom-0 h-44 w-44 rounded-full bg-cyan-300/20 blur-2xl" />
                <div className="relative">
                  <p className="text-xs uppercase tracking-wider text-white/60">Worker workspace</p>
                  <h1 className="mt-2 text-3xl font-bold">Резюме та пошук роботи</h1>
                  <p className="mt-3 max-w-2xl text-white/80">
                    Створіть професійне резюме та знайдіть роботу мрії. Керуйте своїми резюме та відстежуйте відгуки.
                  </p>
                </div>
              </section>

              {/* Resume Banner */}
              <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-amber-100 to-yellow-100 p-8">
                <div className="flex items-center justify-between">
                  <div className="max-w-md">
                    <h3 className="text-lg font-bold text-slate-900">
                      Створіть власне резюме для збільшення шансів знайти ідеальну вакансію
                    </h3>
                    <button
                      className="mt-4 flex items-center gap-2 rounded-full border-2 border-orange-500 bg-white px-6 py-3 text-sm font-semibold text-orange-500 transition hover:bg-orange-500 hover:text-white"
                      onClick={() => {
                        setActiveSection("resumes")
                        setShowCreateResumeForm(true)
                      }}
                      type="button"
                    >
                      <span className="text-lg">+</span>
                      Створити резюме
                    </button>
                  </div>
                  <div className="hidden md:block">
                    {/* Заглушка для ілюстрації */}
                    <div className="flex h-32 w-32 items-center justify-center rounded-full bg-orange-200">
                      <FileText className="h-16 w-16 text-orange-500" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Personal Data Preview */}
              <section className="rounded-3xl bg-white p-8 shadow-medium">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Особисті дані</h2>
                <div className="rounded-2xl bg-slate-50 p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-xl font-bold text-white">
                      {(userName || "U")[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{userName || "Користувач"}</h3>
                      <p className="text-sm text-slate-500">{userEmail}</p>
                    </div>
                    <button
                      onClick={() => setActiveSection("profile")}
                      className="ml-auto rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
                    >
                      Редагувати
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      <VacancyModal
        vacancy={selectedVacancy}
        onClose={() => setSelectedVacancy(null)}
        onApply={() => selectedVacancy && openApplyModal(selectedVacancy)}
        isApplyDisabled={applications.some((app) => app.vacancy_id === selectedVacancy?.id)}
        applicationStatus={applications.find((app) => app.vacancy_id === selectedVacancy?.id)?.status}
      />
      <ApplyModal
        vacancy={applyVacancy}
        resumes={resumes}
        selectedResumeId={selectedResumeId}
        coverLetter={coverLetter}
        isSubmitting={isSubmittingApplication}
        onResumeChange={setSelectedResumeId}
        onCoverLetterChange={setCoverLetter}
        onClose={closeApplyModal}
        onSubmit={submitApplication}
      />
    </div>
  )
}

export default WorkerProfile

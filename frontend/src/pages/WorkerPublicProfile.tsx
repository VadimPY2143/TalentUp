import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import Navbar from "../components/layout/Navbar"
import ResumeModal from "../components/ResumeModal"
import { openCandidateResume } from "../api/candidates"
import { getWorkerProfileForEmployer } from "../api/workers"
import type { EmployerWorkerProfile, WorkerActiveResume } from "../types/workerProfile"
import type { ChatResumeResponse } from "../types/chat"

const ensureUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

const formatSalary = (resume: WorkerActiveResume) => {
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

const formatExperience = (years?: number | null) => {
  if (years === null || years === undefined) {
    return "Досвід не вказано"
  }
  return `${years} років досвіду`
}

const formatDate = (value?: string | null) => {
  if (!value) {
    return "—"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "—"
  }
  return parsed.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const WorkerPublicProfile = () => {
  const { workerUserId } = useParams()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<EmployerWorkerProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [openedResume, setOpenedResume] = useState<ChatResumeResponse | null>(null)

  const normalizedWorkerId = Number(workerUserId)

  useEffect(() => {
    if (!Number.isFinite(normalizedWorkerId) || normalizedWorkerId <= 0) {
      setError("Некоректний ідентифікатор працівника")
      setIsLoading(false)
      return
    }

    let mounted = true
    const load = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await getWorkerProfileForEmployer(normalizedWorkerId)
        if (!mounted) {
          return
        }
        setProfile(data)
      } catch (err) {
        if (!mounted) {
          return
        }
        const message = err instanceof Error ? err.message : "Не вдалося завантажити профіль"
        setError(message)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [normalizedWorkerId])

  const languageChips = useMemo(() => {
    const fromStructured = (profile?.user_languages ?? []).map(
      (item) => `${item.language_name} (${item.proficiency_level})`,
    )
    const fromLegacy = profile?.languages ?? []
    return Array.from(new Set([...fromStructured, ...fromLegacy]))
  }, [profile])

  const links = useMemo(() => {
    const structured = (profile?.user_links ?? []).map((item) => ({
      key: `structured-${item.id}`,
      title: item.title,
      value: item.url,
    }))
    const legacy = (profile?.links ?? []).map((item, index) => ({
      key: `legacy-${index}`,
      title: "Посилання",
      value: item,
    }))
    return [...structured, ...legacy].filter((item) => item.value.trim().length > 0)
  }, [profile])

  const handleOpenPdf = async (resumeId: number) => {
    setActionError(null)
    try {
      await openCandidateResume(resumeId)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося відкрити PDF"
      setActionError(message)
    }
  }

  const handleOpenResume = (resume: WorkerActiveResume) => {
    const nextResume: ChatResumeResponse = {
      id: resume.id,
      user_id: profile?.user_id ?? 0,
      title: resume.title || "Резюме",
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
      created_at: resume.updated_at,
      updated_at: resume.updated_at,
    }
    setOpenedResume(nextResume)
  }

  const handleStartChat = (resumeId: number) => {
    setActionError(null)
    const params = new URLSearchParams({
      resumeId: String(resumeId),
    })
    navigate(`/messages?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-[1180px] px-4 py-8">
        <Link
          className="inline-flex rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
          to="/dashboard"
        >
          Назад до кабінету
        </Link>

        {isLoading ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Завантаження профілю...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : profile ? (
          <>
            <section className="mt-6 rounded-[26px] border border-slate-200 bg-white p-6 shadow-soft md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Профіль працівника</p>
                  <h1 className="mt-2 text-2xl font-semibold text-slate-900 md:text-3xl">{profile.username}</h1>
                </div>
                <button
                  className="rounded-xl bg-[#1f2f5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b294f]"
                  type="button"
                  onClick={() => {
                    const firstResumeId = profile.active_resumes[0]?.id
                    if (!firstResumeId) {
                      setActionError("У кандидата немає активних резюме для початку чату")
                      return
                    }
                    handleStartChat(firstResumeId)
                  }}
                >
                  Написати кандидату
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                <span>Місто: {profile.city || "Не вказано"}</span>
                <span>Телефон: {profile.phone || "Не вказано"}</span>
                <span>Освіта: {profile.education || "Не вказано"}</span>
              </div>
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                <h2 className="text-lg font-semibold text-slate-900">Про себе</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                  {profile.bio || "Кандидат ще не заповнив цей розділ."}
                </p>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                <h2 className="text-lg font-semibold text-slate-900">Мови та посилання</h2>
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Мови</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {languageChips.length ? (
                      languageChips.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700"
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">Не вказано</span>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Посилання</p>
                  <div className="mt-2 space-y-2">
                    {links.length ? (
                      links.map((item) => (
                        <a
                          key={item.key}
                          className="block text-sm text-indigo-700 underline-offset-2 hover:underline"
                          href={ensureUrl(item.value)}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {item.title}: {item.value}
                        </a>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">Не вказано</span>
                    )}
                  </div>
                </div>
              </article>
            </section>

            <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Активні резюме</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Резюме кандидата, які зараз доступні для роботодавців.
                  </p>
                </div>
              </div>

              {actionError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {actionError}
                </div>
              )}

              <div className="mt-4 space-y-3">
                {profile.active_resumes.length ? (
                  profile.active_resumes.map((resume) => (
                    <article
                      key={resume.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">{resume.title}</h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {resume.desired_role || "Позиція не вказана"}
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600">
                          {formatExperience(resume.years_experience)}
                        </span>
                      </div>

                      {resume.summary && (
                        <p className="mt-3 text-sm text-slate-600">{resume.summary}</p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>Локація: {resume.location || "Не вказано"}</span>
                        <span>Формат: {resume.employment_type?.join(", ") || "Не вказано"}</span>
                        <span>Зарплата: {formatSalary(resume)}</span>
                        <span>Оновлено: {formatDate(resume.updated_at)}</span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                          type="button"
                          onClick={() => handleOpenResume(resume)}
                        >
                          Відкрити резюме
                        </button>
                        {resume.pdf_file_path && (
                          <button
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                            type="button"
                            onClick={() => void handleOpenPdf(resume.id)}
                          >
                            Відкрити PDF
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    У кандидата немає активних резюме.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </main>
      <ResumeModal
        resume={openedResume}
        onClose={() => setOpenedResume(null)}
        onOpenPdf={() => void handleOpenPdf(openedResume?.id ?? 0)}
      />
    </div>
  )
}

export default WorkerPublicProfile

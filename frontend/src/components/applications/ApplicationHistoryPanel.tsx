import { useEffect, useMemo, useState } from "react"

import { getApplicationResume, openApplicationResumePdf } from "../../api/applications"
import type {
  ApplicationHistoryItem,
  ApplicationResume,
  ApplicationStatus,
  JobApplication,
} from "../../types/application"

interface ApplicationHistoryPanelProps {
  applications: JobApplication[]
  isLoading: boolean
  error: string | null
  onRefresh: () => void
}

const statusMeta: Record<ApplicationStatus, { label: string; badge: string; dot: string }> = {
  applied: {
    label: "Подано",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
  },
  viewed: {
    label: "Переглянуто",
    badge: "border-indigo-200 bg-indigo-50 text-indigo-700",
    dot: "bg-indigo-500",
  },
  accepted: {
    label: "Прийнято",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  rejected: {
    label: "Відхилено",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const getStatusLabel = (status: ApplicationStatus) => statusMeta[status]?.label ?? status

const formatSalary = (resume: ApplicationResume) => {
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

const formatExperience = (years: number | null | undefined) => {
  if (years === null || years === undefined) {
    return "Досвід не вказано"
  }
  return `${years} років`
}

const ApplicationTimeline = ({ history }: { history: ApplicationHistoryItem[] }) => {
  const sorted = useMemo(
    () => [...history].sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()),
    [history],
  )

  return (
    <ol className="mt-4 space-y-3 border-l border-slate-200 pl-4">
      {sorted.map((item) => {
        const meta = statusMeta[item.status]
        return (
          <li key={item.id} className="relative">
            <span
              className={`absolute -left-[22px] mt-1.5 h-2.5 w-2.5 rounded-full ${meta.dot}`}
              aria-hidden="true"
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>
                  {meta.label}
                </span>
                <span className="text-xs text-slate-500">{formatDateTime(item.changed_at)}</span>
              </div>
              {item.comment && <p className="mt-2 text-sm text-slate-700">{item.comment}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

const ApplicationHistoryPanel = ({
  applications,
  isLoading,
  error,
  onRefresh,
}: ApplicationHistoryPanelProps) => {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [resumeLoadingId, setResumeLoadingId] = useState<number | null>(null)
  const [selectedResume, setSelectedResume] = useState<ApplicationResume | null>(null)
  const [resumeError, setResumeError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedResume) {
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedResume])

  const handleOpenFullResume = async (applicationId: number) => {
    try {
      setResumeError(null)
      setResumeLoadingId(applicationId)
      const resume = await getApplicationResume(applicationId)
      setSelectedResume(resume)
    } catch (err) {
      console.error(err)
      setResumeError("Не вдалося відкрити повне резюме")
    } finally {
      setResumeLoadingId(null)
    }
  }

  const handleOpenPdf = async (resumeId?: number | null) => {
    if (!resumeId) {
      setResumeError("PDF для цього резюме не знайдено")
      return
    }

    try {
      setResumeError(null)
      await openApplicationResumePdf(resumeId)
    } catch (err) {
      console.error(err)
      setResumeError("Не вдалося відкрити PDF")
    }
  }

  return (
    <>
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-medium">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Applications</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-slate-900">Мої відгуки та статуси</h2>
          </div>
          <button
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-500"
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? "Оновлення..." : "Оновити"}
          </button>
        </div>

        {error && <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">{error}</div>}
        {resumeError && (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
            {resumeError}
          </div>
        )}

        {!error && isLoading && <div className="mt-4 text-sm text-slate-500">Завантаження відгуків...</div>}

        {!error && !isLoading && applications.length === 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            У вас ще немає відгуків. Відкрийте вакансії та подайте перший відгук.
          </div>
        )}

        {!error && applications.length > 0 && (
          <div className="mt-4 space-y-3">
            {applications.map((application) => {
              const meta = statusMeta[application.status]
              const isExpanded = expandedId === application.id
              return (
                <article
                  key={application.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {application.vacancy?.title ?? `Вакансія #${application.vacancy_id}`}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Подано: {formatDateTime(application.created_at)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Резюме: {application.resume_title ?? "Без назви"}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>
                      {getStatusLabel(application.status)}
                    </span>
                  </div>

                  {application.cover_letter && (
                    <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                      {application.cover_letter}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      onClick={() => void handleOpenFullResume(application.id)}
                      disabled={resumeLoadingId === application.id}
                    >
                      {resumeLoadingId === application.id ? "Відкриваємо..." : "Відкрити резюме"}
                    </button>
                    <button
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : application.id)}
                    >
                      {isExpanded ? "Сховати історію" : "Історія статусів"}
                    </button>
                  </div>

                  {isExpanded && <ApplicationTimeline history={application.history ?? []} />}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {selectedResume && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-sm px-4 py-6">
          <div className="w-full max-h-[92vh] max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-strong">
            <div className="sticky top-0 border-b border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Повне резюме</p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedResume.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{selectedResume.desired_role || "Бажана роль не вказана"}</p>
                </div>
                <button
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
                  type="button"
                  onClick={() => setSelectedResume(null)}
                >
                  Закрити
                </button>
              </div>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Локація</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{selectedResume.location || "Не вказано"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Зарплата</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{formatSalary(selectedResume)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Досвід</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{formatExperience(selectedResume.years_experience)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Формат роботи</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {selectedResume.employment_type?.length ? selectedResume.employment_type.join(", ") : "Не вказано"}
                  </p>
                </div>
              </div>

              {selectedResume.summary && (
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Про кандидата</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{selectedResume.summary}</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white p-6">
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                  type="button"
                  onClick={() => setSelectedResume(null)}
                >
                  Закрити
                </button>
                <button
                  className="rounded-xl bg-[#1f2f5e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1b294f] disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={() => void handleOpenPdf(selectedResume.id)}
                  disabled={!selectedResume.pdf_file_path}
                >
                  Відкрити PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ApplicationHistoryPanel

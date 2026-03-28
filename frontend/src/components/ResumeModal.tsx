import type { ChatResumeResponse } from "../types/chat"

interface ResumeModalProps {
  resume: ChatResumeResponse | null
  onClose: () => void
  onOpenPdf: () => void
}

const formatSalary = (resume: ChatResumeResponse) => {
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

const formatExperience = (years: number | null) => {
  if (years === null || years === undefined) {
    return "Досвід не вказано"
  }
  return `${years} років`
}

const formatDate = (value: string | null) => {
  if (!value) {
    return "Не вказано"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Не вказано"
  }
  return parsed.toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

const ResumeModal = ({ resume, onClose, onOpenPdf }: ResumeModalProps) => {
  if (!resume) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-sm px-4 py-6">
      <div className="w-full max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-strong">
        <div className="sticky top-0 border-b border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">{resume.title}</h1>
              <p className="mt-2 text-lg text-slate-600">{resume.desired_role || "Бажана роль не вказана"}</p>
            </div>
            <button
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
              type="button"
              onClick={onClose}
            >
              Закрити
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Локація</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {resume.location || "Локація не вказана"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Зарплата</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{formatSalary(resume)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Досвід</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{formatExperience(resume.years_experience)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Оновлено</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{formatDate(resume.updated_at)}</p>
            </div>
          </div>

          {!!resume.employment_type?.length && (
            <div>
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Формат роботи</h3>
              <div className="flex flex-wrap gap-2">
                {resume.employment_type.map((type) => (
                  <span
                    key={`${resume.id}-${type}`}
                    className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm text-orange-700"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {resume.summary && (
            <div>
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Про кандидата</h3>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{resume.summary}</p>
            </div>
          )}

        </div>

        <div className="sticky bottom-0 border-t border-slate-200 bg-white p-6">
          <div className="flex gap-3">
            {resume.pdf_file_path && (
              <button
                className="flex-1 rounded-xl bg-[#1f2f5e] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1b294f]"
                type="button"
                onClick={onOpenPdf}
              >
                Відкрити PDF
              </button>
            )}
            <button
              className={`rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 ${
                resume.pdf_file_path ? "" : "flex-1"
              }`}
              type="button"
              onClick={onClose}
            >
              Закрити
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResumeModal

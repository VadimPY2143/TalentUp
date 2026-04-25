import type { VacancyResponse } from "../types/vacancy"
import type { ApplicationStatus } from "../types/application"

interface VacancyModalProps {
  vacancy: VacancyResponse | null
  onClose: () => void
  onApply: () => void
  showApplyButton?: boolean
  isApplyDisabled?: boolean
  applicationStatus?: ApplicationStatus
}

const applicationStatusLabel: Record<ApplicationStatus, string> = {
  applied: "Подано",
  viewed: "Переглянуто",
  chat_started: "Почато переписку",
}

const VacancyModal = ({
  vacancy,
  onClose,
  onApply,
  showApplyButton = true,
  isApplyDisabled = false,
  applicationStatus,
}: VacancyModalProps) => {
  if (!vacancy) return null

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

  const employmentTypes = normalizeBadgeList([
    ...(vacancy.employment_type ?? []),
    ...(vacancy.work_format ?? []),
  ], [
    "Full-time",
    "Part-time",
  ])
  const workFormats = normalizeBadgeList([
    ...(vacancy.work_format ?? []),
    ...(vacancy.employment_type ?? []),
  ], [
    "Remote",
    "Office",
    "Hybrid",
  ])

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    })
  }

  const applyButtonLabel = isApplyDisabled
    ? `Ви вже відгукнулися${applicationStatus ? ` · ${applicationStatusLabel[applicationStatus]}` : ""}`
    : "Відгукнутися на вакансію"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-sm px-4 py-6">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-strong">
        <div className="sticky top-0 border-b border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">{vacancy.title}</h1>
              <p className="mt-2 text-lg text-slate-600">Компанія</p>
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

        <div className="p-6 space-y-6">
          {/* Основна інформація */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Локація</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {vacancy.location || "Локація не вказана"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Зарплата</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{formatSalary(vacancy)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Досвід</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {vacancy.experience_years_min || vacancy.experience_years_max
                  ? `${vacancy.experience_years_min || "0"}-${vacancy.experience_years_max || "∞"} років`
                  : "Досвід не вказано"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Опубліковано</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{formatDate(vacancy.created_at)}</p>
            </div>
          </div>

          {/* Формати роботи та тип зайнятості */}
          {(employmentTypes.length > 0 || workFormats.length > 0) && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Умови роботи</h3>
              <div className="flex flex-wrap gap-2">
                {employmentTypes.map((type) => (
                  <span key={type} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm text-orange-700">
                    {type}
                  </span>
                ))}
                {workFormats.map((format) => (
                  <span key={format} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-700">
                    {format}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Опис */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Опис вакансії</h3>
            <div className="prose prose-sm max-w-none text-slate-700">
              <p className="whitespace-pre-wrap">{vacancy.description}</p>
            </div>
          </div>

          {/* Обов'язки */}
          {vacancy.responsibilities && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Обов'язки</h3>
              <div className="prose prose-sm max-w-none text-slate-700">
                <p className="whitespace-pre-wrap">{vacancy.responsibilities}</p>
              </div>
            </div>
          )}

          {/* Вимоги */}
          {vacancy.requirements && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Вимоги</h3>
              <div className="prose prose-sm max-w-none text-slate-700">
                <p className="whitespace-pre-wrap">{vacancy.requirements}</p>
              </div>
            </div>
          )}
        </div>

        {/* Дії */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-white p-6">
          <div className="flex gap-3">
            {showApplyButton && (
              <button
                className="flex-1 rounded-xl bg-[#1f2f5e] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1b294f] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={onApply}
                disabled={isApplyDisabled}
              >
                {applyButtonLabel}
              </button>
            )}
            <button
              className={`rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 ${
                showApplyButton ? "" : "flex-1"
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

export default VacancyModal

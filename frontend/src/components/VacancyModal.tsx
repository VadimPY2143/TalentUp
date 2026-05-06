import type { ApplicationStatus } from "../types/application"
import type { VacancyResponse } from "../types/vacancy"

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

const normalizeBadgeList = (
  value: string[] | string | null | undefined,
  allowedValues: readonly string[],
): string[] => {
  if (!value) return []
  const allowedMap = new Map(allowedValues.map((item) => [item.toLowerCase(), item]))
  const normalized = new Set<string>()

  const addFromText = (text: string) => {
    const parts = text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

    for (const part of parts) {
      const exact = allowedMap.get(part.toLowerCase())
      if (exact) normalized.add(exact)
    }

    const lowered = text.toLowerCase()
    for (const allowedValue of allowedValues) {
      if (lowered.includes(allowedValue.toLowerCase())) normalized.add(allowedValue)
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim()) addFromText(item)
    }
    addFromText(value.join(""))
  } else {
    addFromText(value)
  }

  return Array.from(normalized)
}

const formatSalary = (vacancy: VacancyResponse) => {
  const min = vacancy.salary_min ?? undefined
  const max = vacancy.salary_max ?? undefined
  const currency = vacancy.salary_currency ?? "UAH"

  if (min && max) return `${min}-${max} ${currency}`
  if (min) return `від ${min} ${currency}`
  if (max) return `до ${max} ${currency}`
  return "Зарплата не вказана"
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

const VacancyModal = ({
  vacancy,
  onClose,
  onApply,
  showApplyButton = true,
  isApplyDisabled = false,
  applicationStatus,
}: VacancyModalProps) => {
  if (!vacancy) return null

  const employmentTypes = normalizeBadgeList(
    [...(vacancy.employment_type ?? []), ...(vacancy.work_format ?? [])],
    ["Full-time", "Part-time"],
  )
  const workFormats = normalizeBadgeList(
    [...(vacancy.work_format ?? []), ...(vacancy.employment_type ?? [])],
    ["Remote", "Office", "Hybrid"],
  )

  const applyButtonLabel = isApplyDisabled
    ? `Ви вже відгукнулися${applicationStatus ? ` · ${applicationStatusLabel[applicationStatus]}` : ""}`
    : "Відгукнутися на вакансію"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-2 py-3 backdrop-blur-sm sm:px-4 sm:py-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-strong">
        <div className="max-h-[92vh] overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{vacancy.title}</h1>
                <p className="mt-1 text-sm text-slate-600 sm:text-base">Компанія</p>
              </div>
              <button
                className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                type="button"
                onClick={onClose}
              >
                Закрити
              </button>
            </div>
          </div>

          <div className="space-y-6 px-4 py-4 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Локація</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{vacancy.location || "Локація не вказана"}</p>
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

            {(employmentTypes.length > 0 || workFormats.length > 0) && (
              <div>
                <h3 className="mb-3 text-base font-semibold text-slate-900 sm:text-lg">Умови роботи</h3>
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

            <div>
              <h3 className="mb-3 text-base font-semibold text-slate-900 sm:text-lg">Опис вакансії</h3>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{vacancy.description}</p>
            </div>

            {vacancy.responsibilities && (
              <div>
                <h3 className="mb-3 text-base font-semibold text-slate-900 sm:text-lg">Обов'язки</h3>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{vacancy.responsibilities}</p>
              </div>
            )}

            {vacancy.requirements && (
              <div>
                <h3 className="mb-3 text-base font-semibold text-slate-900 sm:text-lg">Вимоги</h3>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{vacancy.requirements}</p>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-4 py-3 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              {showApplyButton && (
                <button
                  className="h-11 flex-1 rounded-xl bg-[#1f2f5e] px-5 text-sm font-semibold text-white transition hover:bg-[#1b294f] disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={onApply}
                  disabled={isApplyDisabled}
                >
                  {applyButtonLabel}
                </button>
              )}
              <button
                className={`h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 ${
                  showApplyButton ? "sm:w-auto" : "flex-1"
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
    </div>
  )
}

export default VacancyModal

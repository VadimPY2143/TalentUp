import { useEffect, useMemo, useState } from "react"
import { BellRing, RefreshCw, Trash2 } from "lucide-react"

import {
  createVacancySubscription,
  deleteVacancySubscription,
  listVacancySubscriptions,
  setVacancySubscriptionActive,
} from "../../api/vacancySubscriptions"
import type { CityOption } from "../../types/city"
import type {
  VacancySubscription,
  VacancySubscriptionCreatePayload,
  VacancySubscriptionEmploymentKind,
  VacancySubscriptionFilters,
  VacancySubscriptionWorkFormat,
} from "../../types/vacancySubscription"
import CityAutocomplete from "../CityAutocomplete"

interface VacancySubscriptionsPanelProps {
  userEmail?: string
}

interface SubscriptionFormState {
  searchText: string
  cityId: number | null
  location: string
  employmentKind: VacancySubscriptionEmploymentKind[]
  workFormat: VacancySubscriptionWorkFormat[]
  salaryMin: string
  salaryMax: string
  salaryCurrency: string
  experienceYearsMin: string
  experienceYearsMax: string
  isActive: boolean
  excludeExpired: boolean
}

const employmentKindOptions: Array<{ label: string; value: VacancySubscriptionEmploymentKind }> = [
  { label: "Full-time", value: "Full-time" },
  { label: "Part-time", value: "Part-time" },
]

const workFormatOptions: Array<{ label: string; value: VacancySubscriptionWorkFormat }> = [
  { label: "Remote", value: "Remote" },
  { label: "Hybrid", value: "Hybrid" },
  { label: "Office", value: "Office" },
]

const buildInitialForm = (): SubscriptionFormState => ({
  searchText: "",
  cityId: null,
  location: "",
  employmentKind: [],
  workFormat: [],
  salaryMin: "",
  salaryMax: "",
  salaryCurrency: "UAH",
  experienceYearsMin: "",
  experienceYearsMax: "",
  isActive: true,
  excludeExpired: true,
})

const parseNonNegativeNumber = (value: string): number | undefined => {
  if (!value.trim()) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined
  }
  return Math.trunc(parsed)
}

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—"
  }
  return new Date(value).toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const countConfiguredFilters = (filters: VacancySubscriptionFilters): number => {
  return Object.entries(filters).reduce((count, [key, value]) => {
    if (key === "exclude_expired" && value === true) {
      return count
    }
    if (value === undefined || value === null) {
      return count
    }
    if (typeof value === "string" && !value.trim()) {
      return count
    }
    if (Array.isArray(value) && value.length === 0) {
      return count
    }
    return count + 1
  }, 0)
}

const VacancySubscriptionsPanel = ({ userEmail }: VacancySubscriptionsPanelProps) => {
  const [subscriptions, setSubscriptions] = useState<VacancySubscription[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [actionSubscriptionId, setActionSubscriptionId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState<SubscriptionFormState>(buildInitialForm)

  const activeCount = useMemo(
    () => subscriptions.filter((subscription) => subscription.is_active).length,
    [subscriptions],
  )

  useEffect(() => {
    void loadSubscriptions()
  }, [])

  const loadSubscriptions = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      const data = await listVacancySubscriptions()
      setSubscriptions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося завантажити підписки")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const toggleArrayValue = <T extends string>(values: T[], target: T): T[] => {
    if (values.includes(target)) {
      return values.filter((item) => item !== target)
    }
    return [...values, target]
  }

  const buildFiltersPayload = (state: SubscriptionFormState): VacancySubscriptionFilters => {
    const payload: VacancySubscriptionFilters = {
      exclude_expired: state.excludeExpired,
    }

    if (state.cityId) {
      payload.city_id = state.cityId
    }
    if (state.location.trim()) {
      payload.location = state.location.trim()
    }
    if (state.employmentKind.length) {
      payload.employment_kind = state.employmentKind
    }
    if (state.workFormat.length) {
      payload.work_format = state.workFormat
    }
    const salaryMin = parseNonNegativeNumber(state.salaryMin)
    if (salaryMin !== undefined) {
      payload.salary_min = salaryMin
    }
    const salaryMax = parseNonNegativeNumber(state.salaryMax)
    if (salaryMax !== undefined) {
      payload.salary_max = salaryMax
    }
    if (state.salaryCurrency.trim()) {
      payload.salary_currency = state.salaryCurrency.trim().toUpperCase()
    }
    const experienceMin = parseNonNegativeNumber(state.experienceYearsMin)
    if (experienceMin !== undefined) {
      payload.experience_years_min = experienceMin
    }
    const experienceMax = parseNonNegativeNumber(state.experienceYearsMax)
    if (experienceMax !== undefined) {
      payload.experience_years_max = experienceMax
    }

    return payload
  }

  const handleCreateSubscription = async () => {
    const normalizedQuery = form.searchText.trim()
    if (normalizedQuery.length < 2) {
      setError("Пошуковий запит має містити мінімум 2 символи")
      return
    }

    const salaryMin = parseNonNegativeNumber(form.salaryMin)
    const salaryMax = parseNonNegativeNumber(form.salaryMax)
    if (salaryMin !== undefined && salaryMax !== undefined && salaryMin > salaryMax) {
      setError("salary_min не може бути більшим за salary_max")
      return
    }

    const experienceMin = parseNonNegativeNumber(form.experienceYearsMin)
    const experienceMax = parseNonNegativeNumber(form.experienceYearsMax)
    if (experienceMin !== undefined && experienceMax !== undefined && experienceMin > experienceMax) {
      setError("experience_years_min не може бути більшим за experience_years_max")
      return
    }

    const payload: VacancySubscriptionCreatePayload = {
      search_text: normalizedQuery,
      filters: buildFiltersPayload(form),
      is_active: form.isActive,
    }

    try {
      setCreating(true)
      setError(null)
      setSuccessMessage(null)
      await createVacancySubscription(payload)
      await loadSubscriptions(true)
      setForm(buildInitialForm())
      setSuccessMessage("Підписку створено")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося створити підписку")
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (subscription: VacancySubscription) => {
    try {
      setActionSubscriptionId(subscription.id)
      setError(null)
      const updated = await setVacancySubscriptionActive(subscription.id, !subscription.is_active)
      setSubscriptions((prev) =>
        prev.map((item) => (item.id === subscription.id ? updated : item)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося оновити підписку")
    } finally {
      setActionSubscriptionId(null)
    }
  }

  const handleDelete = async (subscriptionId: number) => {
    const confirmed = window.confirm("Видалити цю підписку?")
    if (!confirmed) {
      return
    }
    try {
      setActionSubscriptionId(subscriptionId)
      setError(null)
      await deleteVacancySubscription(subscriptionId)
      setSubscriptions((prev) => prev.filter((item) => item.id !== subscriptionId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося видалити підписку")
    } finally {
      setActionSubscriptionId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-medium">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Підписки на вакансії</h2>
            <p className="text-sm text-slate-500">
              Усього: {subscriptions.length}. Активних: {activeCount}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void loadSubscriptions(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Оновлення..." : "Оновити"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-medium">
        <div className="mb-4 flex items-center gap-2">
          <BellRing className="h-5 w-5 text-orange-500" />
          <h3 className="text-base font-semibold text-slate-900">Нова підписка</h3>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Листи будуть надсилатися лише на email вашого акаунта:{" "}
          <span className="font-semibold text-slate-700">{userEmail || "невідомо"}</span>
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
            placeholder="Пошуковий запит (наприклад, Python)"
            value={form.searchText}
            onChange={(event) => setForm((prev) => ({ ...prev, searchText: event.target.value }))}
          />

          <CityAutocomplete
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
            placeholder="Оберіть місто"
            value={form.location}
            onChange={(value) => setForm((prev) => ({ ...prev, location: value }))}
            onOptionSelect={(option: CityOption | null) =>
              setForm((prev) => ({
                ...prev,
                cityId: option?.id ?? null,
                location: option?.name_uk ?? prev.location,
              }))
            }
          />

          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
            placeholder="salary_min"
            type="number"
            min={0}
            value={form.salaryMin}
            onChange={(event) => setForm((prev) => ({ ...prev, salaryMin: event.target.value }))}
          />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
              placeholder="salary_max"
              type="number"
              min={0}
              value={form.salaryMax}
              onChange={(event) => setForm((prev) => ({ ...prev, salaryMax: event.target.value }))}
            />
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-orange-400/70"
              value={form.salaryCurrency}
              onChange={(event) => setForm((prev) => ({ ...prev, salaryCurrency: event.target.value }))}
            >
              <option value="UAH">UAH</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>

          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
            placeholder="experience_years_min"
            type="number"
            min={0}
            value={form.experienceYearsMin}
            onChange={(event) => setForm((prev) => ({ ...prev, experienceYearsMin: event.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70"
            placeholder="experience_years_max"
            type="number"
            min={0}
            value={form.experienceYearsMax}
            onChange={(event) => setForm((prev) => ({ ...prev, experienceYearsMax: event.target.value }))}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Тип зайнятості</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {employmentKindOptions.map((option) => {
                const active = form.employmentKind.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-orange-400 bg-orange-100 text-orange-700"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        employmentKind: toggleArrayValue(prev.employmentKind, option.value),
                      }))
                    }
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Формат роботи</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {workFormatOptions.map((option) => {
                const active = form.workFormat.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-orange-400 bg-orange-100 text-orange-700"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        workFormat: toggleArrayValue(prev.workFormat, option.value),
                      }))
                    }
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Одразу активна
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.excludeExpired}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    excludeExpired: event.target.checked,
                  }))
                }
              />
              Не показувати прострочені
            </label>
          </div>

          <button
            type="button"
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void handleCreateSubscription()}
            disabled={creating}
          >
            {creating ? "Створення..." : "Додати підписку"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-medium">
        <h3 className="text-base font-semibold text-slate-900">Ваші підписки</h3>

        {loading ? (
          <div className="mt-4 py-6 text-sm text-slate-500">Завантаження підписок...</div>
        ) : subscriptions.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Підписок ще немає. Додайте першу підписку через форму вище.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {subscriptions.map((subscription) => {
              const filtersCount = countConfiguredFilters(subscription.filters || {})
              const jobsUrl = `/jobs?query=${encodeURIComponent(subscription.search_text)}`
              return (
                <article key={subscription.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold text-slate-900">{subscription.search_text}</h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Наступна відправка: {formatDateTime(subscription.next_run_at)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Остання відправка: {formatDateTime(subscription.last_sent_at)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        subscription.is_active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-300 bg-slate-100 text-slate-600"
                      }`}
                    >
                      {subscription.is_active ? "Активна" : "Пауза"}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Налаштованих фільтрів: <span className="font-semibold text-slate-700">{filtersCount}</span>
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void handleToggleActive(subscription)}
                      disabled={actionSubscriptionId === subscription.id}
                    >
                      {subscription.is_active ? "Поставити на паузу" : "Активувати"}
                    </button>
                    <a
                      href={jobsUrl}
                      className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
                    >
                      Перейти до вакансій
                    </a>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void handleDelete(subscription.id)}
                      disabled={actionSubscriptionId === subscription.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Видалити
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

export default VacancySubscriptionsPanel

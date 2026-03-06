import { useEffect, useMemo, useState, type FormEvent } from "react"
import Navbar from "../components/layout/Navbar"
import { createCompany, listCompanies, updateCompany } from "../api/companies"
import type { CompanyPayload, CompanyResponse } from "../types/company"

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

const emptyForm: CompanyFormState = {
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

const toText = (value: string) => {
  const normalized = value.trim()
  return normalized ? normalized : undefined
}

const toPayload = (form: CompanyFormState): CompanyPayload => ({
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

const EmployerDashboard = () => {
  const [companies, setCompanies] = useState<CompanyResponse[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [form, setForm] = useState<CompanyFormState>(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedCompany = useMemo(
    () => companies.find((item) => item.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  )

  const loadCompanies = async () => {
    try {
      setIsLoading(true)
      const data = await listCompanies()
      setCompanies(data)
      if (selectedCompanyId && !data.some((item) => item.id === selectedCompanyId)) {
        setSelectedCompanyId(null)
        setForm(emptyForm)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося завантажити компанії"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCompanies()
  }, [])

  const setField = (key: keyof CompanyFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const startCreate = () => {
    setSelectedCompanyId(null)
    setForm(emptyForm)
    setError(null)
    setSuccess(null)
  }

  const startEdit = (company: CompanyResponse) => {
    setSelectedCompanyId(company.id)
    setForm(companyToForm(company))
    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!form.name.trim()) {
      setError("Вкажіть назву компанії")
      return
    }

    if (form.founded_year && Number.isNaN(Number(form.founded_year))) {
      setError("Рік заснування має бути числом")
      return
    }

    try {
      setIsSaving(true)
      const payload = toPayload(form)
      if (selectedCompanyId) {
        const updated = await updateCompany(selectedCompanyId, payload)
        setCompanies((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        setSuccess("Профіль компанії оновлено")
      } else {
        const created = await createCompany(payload)
        setCompanies((prev) => [created, ...prev])
        setSelectedCompanyId(created.id)
        setSuccess("Компанію створено")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Помилка збереження компанії"
      setError(message)
    } finally {
      setIsSaving(false)
    }
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
            <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
              Компанії та бренд роботодавця
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-white/80 md:text-base">
              Створи компанію, щоб почати пошук кандидатів
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
                type="button"
                onClick={startCreate}
              >
                + Додати компанію
              </button>
              <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white/85">
                Всього компаній: <span className="font-semibold text-white">{companies.length}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-medium">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">Мої компанії</h2>
              <button
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-500"
                type="button"
                onClick={loadCompanies}
                disabled={isLoading}
              >
                Оновити
              </button>
            </div>

            {isLoading ? (
              <div className="mt-6 text-sm text-slate-500">Завантаження...</div>
            ) : companies.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Компаній ще немає. Натисни «Додати компанію», щоб створити перший профіль.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {companies.map((company) => {
                  const isSelected = company.id === selectedCompanyId
                  return (
                    <article
                      key={company.id}
                      className={`rounded-2xl border p-5 transition ${
                        isSelected
                          ? "border-orange-400/60 bg-orange-50/70"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{company.name}</h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {[company.industry, company.city, company.country].filter(Boolean).join(" · ") || "Без додаткових даних"}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">
                            Оновлено: {formatDate(company.updated_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              company.is_verified
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {company.is_verified ? "Верифіковано" : "Не верифіковано"}
                          </span>
                          <button
                            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-orange-500/70"
                            type="button"
                            onClick={() => startEdit(company)}
                          >
                            Редагувати
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-medium">
            <h2 className="font-display text-2xl font-semibold text-slate-900">
              {selectedCompany ? "Редагувати компанію" : "Нова компанія"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Заповни ключові поля, щоб сторінка компанії виглядала повною для кандидатів.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                placeholder="Назва компанії *"
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Юридична назва"
                  value={form.legal_name}
                  onChange={(event) => setField("legal_name", event.target.value)}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Індустрія"
                  value={form.industry}
                  onChange={(event) => setField("industry", event.target.value)}
                />
              </div>

              <textarea
                className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                placeholder="Короткий опис компанії"
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Розмір компанії (напр. 11-50)"
                  value={form.company_size}
                  onChange={(event) => setField("company_size", event.target.value)}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Рік заснування"
                  type="number"
                  value={form.founded_year}
                  onChange={(event) => setField("founded_year", event.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Вебсайт"
                  value={form.website}
                  onChange={(event) => setField("website", event.target.value)}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Email для кандидатів"
                  value={form.email}
                  onChange={(event) => setField("email", event.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Телефон"
                  value={form.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Країна"
                  value={form.country}
                  onChange={(event) => setField("country", event.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Місто"
                  value={form.city}
                  onChange={(event) => setField("city", event.target.value)}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-500/60"
                  placeholder="Адреса"
                  value={form.address}
                  onChange={(event) => setField("address", event.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                  {success}
                </div>
              )}

              <button
                className="w-full rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={isSaving}
              >
                {selectedCompany ? "Зберегти зміни" : "Створити компанію"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}

export default EmployerDashboard

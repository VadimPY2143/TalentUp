import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import Navbar from "../components/layout/Navbar"
import { useAuth } from "../auth/useAuth"
import EmployerDashboard from "./EmployerDashboard"
import WorkerProfilePanel from "../components/WorkerProfilePanel"
import {
  createResume,
  deleteResume,
  deleteResumePdf,
  listResumes,
  openResumePdf,
  updateResume,
  uploadResumePdf,
} from "../api/resumes"
import type { CurrencyType, EmploymentType, Resume, ResumeBase } from "../types/resume"
const employmentOptions: EmploymentType[] = ["Remote", "Office", "Hybrid"]
const currencyOptions: CurrencyType[] = ["UAH", "USD", "EUR"]

const employmentLabels: Record<EmploymentType, string> = {
  Remote: "Remote",
  Office: "Office",
  Hybrid: "Hybrid",
}
const currencyLabels: Record<CurrencyType, string> = {
  UAH: "UAH (грн)",
  USD: "USD ($)",
  EUR: "EUR (€)",
}

const emptyResume: ResumeBase = {
  title: "",
  summary: "",
  desired_role: "",
  employment_type: [],
  location: "",
  salary_min: undefined,
  salary_max: undefined,
  salary_currency: "UAH",
  years_experience: undefined,
  is_active: true,
}

const Dashboard = () => {
  const { role } = useAuth()
  console.log('Current role:', role) // Дебагінг
  const [resumes, setResumes] = useState<Resume[]>([])
  const [form, setForm] = useState<ResumeBase>(emptyResume)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const heading = useMemo(() => (editingId ? "Редагувати резюме" : "Нове резюме"), [editingId])
  const editingResume = useMemo(
    () => resumes.find((resume) => resume.id === editingId) ?? null,
    [resumes, editingId],
  )

  const loadResumes = async () => {
    try {
      setIsLoading(true)
      const data = await listResumes()
      setResumes(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Помилка завантаження"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (role === "employer") {
      setIsLoading(false)
      return
    }
    loadResumes()
  }, [role])

  const updateField = (field: keyof ResumeBase, value: ResumeBase[typeof field]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const toggleEmployment = (value: EmploymentType) => {
    setForm((prev) => {
      const exists = prev.employment_type.includes(value)
      const next = exists
        ? prev.employment_type.filter((item) => item !== value)
        : [...prev.employment_type, value]
      return { ...prev, employment_type: next }
    })
  }

  const handleEdit = (resume: Resume) => {
    setEditingId(resume.id)
    setForm({
      title: resume.title,
      summary: resume.summary ?? "",
      desired_role: resume.desired_role ?? "",
      employment_type: resume.employment_type ?? [],
      location: resume.location ?? "",
      salary_min: resume.salary_min ?? undefined,
      salary_max: resume.salary_max ?? undefined,
      salary_currency: resume.salary_currency ?? "UAH",
      years_experience: resume.years_experience ?? undefined,
      is_active: resume.is_active ?? true,
    })
    setError(null)
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyResume)
    setError(null)
  }

  const openNewForm = () => {
    setEditingId(null)
    setForm(emptyResume)
    setError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!form.title.trim()) {
      setError("Вкажіть назву резюме")
      return
    }

    if (form.employment_type.length === 0) {
      setError("Оберіть хоча б один тип зайнятості")
      return
    }

    try {
      setActionLoading(true)
      if (editingId) {
        await updateResume(editingId, form)
      } else {
        await createResume(form)
      }
      await loadResumes()
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Помилка збереження"
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      setActionLoading(true)
      await deleteResume(id)
      setResumes((prev) => prev.filter((item) => item.id !== id))
      if (editingId === id) {
        resetForm()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Помилка видалення"
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUploadPdf = async (resumeId: number, file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Можна завантажувати тільки PDF")
      return
    }

    try {
      setActionLoading(true)
      await uploadResumePdf(resumeId, file)
      await loadResumes()
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Помилка завантаження PDF"
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenPdf = async (resumeId: number) => {
    try {
      setActionLoading(true)
      await openResumePdf(resumeId)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Помилка відкриття PDF"
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeletePdf = async (resumeId: number) => {
    try {
      setActionLoading(true)
      await deleteResumePdf(resumeId)
      await loadResumes()
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Помилка видалення PDF"
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  if (role === "employer") {
    return <EmployerDashboard />
  }

  return (
    <div className="min-h-screen bg-[#edf2f8]">
      <Navbar />

      <div className="mx-auto max-w-[1280px] px-4 pb-12 pt-8">
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-7 text-white shadow-medium md:p-10">
          <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-orange-400/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-8 bottom-0 h-44 w-44 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.35em] text-white/65">Worker workspace</p>
            <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">Резюме та пошук роботи</h1>
            <p className="mt-3 max-w-3xl text-sm text-white/80 md:text-base">
              Створіть професійне резюме та знайдіть роботу мрії. Керуйте своїми резюме та відстежуйте відгуки.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white/85">
                Резюме: <span className="font-semibold text-white">{resumes.length}</span>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white/85">
                Активні: <span className="font-semibold text-white">{resumes.filter(r => r.is_active).length}</span>
              </div>
              <Link
                to="/jobs"
                className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                Пошук вакансій
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <WorkerProfilePanel />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.12fr,0.88fr]">
          <section className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-medium">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">
                Мої резюме
              </h2>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                  type="button"
                  onClick={openNewForm}
                >
                  Нове резюме
                </button>
                <button
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-500"
                  type="button"
                  onClick={loadResumes}
                  disabled={isLoading}
                >
                  Оновити
                </button>
              </div>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Створюйте та редагуйте свої резюме для пошуку роботи.
            </p>

            {isLoading ? (
              <div className="mt-6 text-sm text-slate-500">Завантаження...</div>
            ) : resumes.length === 0 ? (
              <div className="mt-6 text-sm text-slate-500">Резюме ще немає. Створіть перше.</div>
            ) : (
              <div className="mt-6 space-y-4">
                {resumes.map((resume) => (
                  <div
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
                    key={resume.id}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-base font-semibold">{resume.title}</div>
                        <div className="text-sm text-slate-500">
                          {resume.desired_role || "Без позиції"} · {resume.location || "Локація"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-orange-500/70"
                          type="button"
                          onClick={() => handleEdit(resume)}
                          disabled={actionLoading}
                        >
                          Редагувати
                        </button>
                        <button
                          className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-xs font-semibold text-orange-600 transition hover:bg-orange-500/20"
                          type="button"
                          onClick={() => handleDelete(resume.id)}
                          disabled={actionLoading}
                        >
                          Видалити
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                      {resume.employment_type?.map((type) => (
                        <span key={`${resume.id}-${type}`} className="rounded-full border border-slate-300 bg-white px-3 py-1">
                          {employmentLabels[type]}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-5 text-slate-900 shadow-medium">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">{heading}</h2>
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400"
                type="button"
                onClick={resetForm}
              >
                Очистити
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                placeholder="Назва резюме"
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
              />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                placeholder="Бажана посада"
                value={form.desired_role ?? ""}
                onChange={(event) => updateField("desired_role", event.target.value)}
              />
              <textarea
                className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                placeholder="Коротко про себе"
                value={form.summary ?? ""}
                onChange={(event) => updateField("summary", event.target.value)}
              />

              <div>
                <div className="text-sm font-semibold text-slate-700">Тип зайнятості</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {employmentOptions.map((option) => {
                    const isActive = form.employment_type.includes(option)
                    return (
                      <button
                        key={option}
                        type="button"
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          isActive
                            ? "border-orange-500 bg-orange-500/10 text-slate-900"
                            : "border-slate-300 bg-white text-slate-700"
                        }`}
                        onClick={() => toggleEmployment(option)}
                      >
                        {employmentLabels[option]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                placeholder="Локація"
                value={form.location ?? ""}
                onChange={(event) => updateField("location", event.target.value)}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                  placeholder="Зарплата від"
                  type="number"
                  value={form.salary_min ?? ""}
                  onChange={(event) => updateField("salary_min", event.target.value ? Number(event.target.value) : undefined)}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                  placeholder="Зарплата до"
                  type="number"
                  value={form.salary_max ?? ""}
                  onChange={(event) => updateField("salary_max", event.target.value ? Number(event.target.value) : undefined)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-orange-500/60"
                  value={form.salary_currency ?? "UAH"}
                  onChange={(event) => updateField("salary_currency", event.target.value as CurrencyType)}
                >
                  {currencyOptions.map((option) => (
                    <option key={option} value={option}>
                      {currencyLabels[option]}
                    </option>
                  ))}
                </select>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                  placeholder="Роки досвіду"
                  type="number"
                  value={form.years_experience ?? ""}
                  onChange={(event) => updateField("years_experience", event.target.value ? Number(event.target.value) : undefined)}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.is_active ?? true}
                  onChange={(event) => updateField("is_active", event.target.checked)}
                />
                Активне резюме
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 text-sm font-semibold text-slate-700">PDF резюме</div>
                {!editingId && (
                  <div className="text-sm text-slate-500">
                    Щоб додати PDF, спочатку створіть резюме.
                  </div>
                )}

                {editingId && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-orange-500/70">
                        Завантажити PDF
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          className="hidden"
                          onChange={async (event) => {
                            const selectedFile = event.target.files?.[0]
                            if (selectedFile && editingId) {
                              await handleUploadPdf(editingId, selectedFile)
                            }
                            event.target.value = ""
                          }}
                        />
                      </label>

                      {editingResume?.pdf_file_path && (
                        <>
                          <button
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-orange-500/70"
                            type="button"
                            onClick={() => handleOpenPdf(editingId)}
                            disabled={actionLoading}
                          >
                            Відкрити PDF
                          </button>
                          <button
                            className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-xs font-semibold text-orange-600 transition hover:bg-orange-500/20"
                            type="button"
                            onClick={() => handleDeletePdf(editingId)}
                            disabled={actionLoading}
                          >
                            Видалити PDF
                          </button>
                        </>
                      )}
                    </div>

                    <div className="text-xs text-slate-500">
                      {editingResume?.pdf_original_name
                        ? `Файл: ${editingResume.pdf_original_name}`
                        : "PDF ще не завантажено"}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm text-orange-600">
                  {error}
                </div>
              )}

              <button
                className="w-full rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={actionLoading}
              >
                {editingId ? "Зберегти зміни" : "Створити резюме"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

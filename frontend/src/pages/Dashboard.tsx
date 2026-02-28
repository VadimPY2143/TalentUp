import { useEffect, useMemo, useState, type FormEvent } from "react"
import Navbar from "../components/layout/Navbar"
import { createResume, deleteResume, listResumes, updateResume } from "../api/resumes"
import type { EmploymentType, Resume, ResumeBase } from "../types/resume"

const employmentOptions: EmploymentType[] = ["Remote", "Office", "Hybrid"]

const employmentLabels: Record<EmploymentType, string> = {
  Remote: "Віддалено",
  Office: "Офіс",
  Hybrid: "Гібрид",
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
  const [resumes, setResumes] = useState<Resume[]>([])
  const [form, setForm] = useState<ResumeBase>(emptyResume)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const heading = useMemo(() => (editingId ? "Редагувати резюме" : "Нове резюме"), [editingId])

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
    loadResumes()
  }, [])

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

  return (
    <div className="min-h-screen bg-[#e9edf4]">
      <Navbar />
      <div className="relative mx-auto max-w-[1200px] px-4 py-10">
        <div className="relative grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-medium">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Кабінет</p>
                <h1 className="font-display text-2xl font-semibold">Мої резюме</h1>
              </div>
              <button
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                type="button"
                onClick={openNewForm}
              >
                Нове резюме
              </button>
            </div>

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
                        >
                          Редагувати
                        </button>
                        <button
                          className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-xs font-semibold text-orange-600 transition hover:bg-orange-500/20"
                          type="button"
                          onClick={() => handleDelete(resume.id)}
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

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-medium">
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
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                  placeholder="Валюта"
                  value={form.salary_currency ?? ""}
                  onChange={(event) => updateField("salary_currency", event.target.value)}
                />
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

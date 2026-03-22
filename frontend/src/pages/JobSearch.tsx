import { useEffect, useState } from "react"
import Navbar from "../components/layout/Navbar"
import { searchVacancies } from "../api/vacancies"
import type { VacancyResponse } from "../types/vacancy"

const JobSearch = () => {
  const [vacancies, setVacancies] = useState<VacancyResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [location, setLocation] = useState("")
  const [salaryMin, setSalaryMin] = useState("")
  const [employmentType, setEmploymentType] = useState("")
  const [error, setError] = useState<string | null>(null)

  const loadVacancies = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const filters = {
        search: searchQuery || undefined,
        location: location || undefined,
        salary_min: salaryMin ? Number(salaryMin) : undefined,
        employment_type: employmentType || undefined,
      }
      const data = await searchVacancies(filters)
      setVacancies(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося завантажити вакансії"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadVacancies()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadVacancies()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })
  }

  const formatSalary = (vacancy: VacancyResponse) => {
    const currency = vacancy.salary_currency || "UAH"
    if (vacancy.salary_min && vacancy.salary_max) {
      return `${vacancy.salary_min}-${vacancy.salary_max} ${currency}`
    }
    if (vacancy.salary_min) {
      return `від ${vacancy.salary_min} ${currency}`
    }
    if (vacancy.salary_max) {
      return `до ${vacancy.salary_max} ${currency}`
    }
    return "Зарплата не вказана"
  }

  return (
    <div className="min-h-screen bg-[#edf2f8]">
      <Navbar />

      <div className="mx-auto max-w-[1280px] px-4 pb-12 pt-8">
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-7 text-white shadow-medium md:p-10">
          <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-orange-400/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-8 bottom-0 h-44 w-44 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.35em] text-white/65">Пошук роботи</p>
            <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">Знайдіть роботу мрії</h1>
            <p className="mt-3 max-w-3xl text-sm text-white/80 md:text-base">
              Шукайте вакансії від топ-компаній. Фільтруйте за локацією, зарплатою та типом зайнятості.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white/85">
                Знайдено: <span className="font-semibold text-white">{vacancies.length}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.12fr,0.88fr]">
          <section className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-medium">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">
                Вакансії
              </h2>
              <button
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-500"
                type="button"
                onClick={loadVacancies}
                disabled={isLoading}
              >
                Оновити
              </button>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Знайдено вакансії, що відповідають вашим критеріям.
            </p>

            {isLoading ? (
              <div className="mt-6 text-sm text-slate-500">Завантаження...</div>
            ) : error ? (
              <div className="mt-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            ) : vacancies.length === 0 ? (
              <div className="mt-6 text-sm text-slate-500">Вакансій не знайдено. Спробуйте змінити фільтри.</div>
            ) : (
              <div className="mt-6 space-y-4">
                {vacancies.map((vacancy) => (
                  <div
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
                    key={vacancy.id}
                  >
                    <div className="flex flex-col gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{vacancy.title}</h3>
                        <div className="text-sm text-slate-600">
                          {vacancy.company_name || "Компанія"} · {vacancy.location || "Локація"}
                        </div>
                      </div>
                      
                      <p className="text-sm text-slate-700 line-clamp-2">
                        {vacancy.description}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          {vacancy.employment_type?.map((type) => (
                            <span key={`${vacancy.id}-${type}`} className="rounded-full border border-slate-300 bg-white px-3 py-1">
                              {type}
                            </span>
                          ))}
                          <span className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-green-700">
                            {formatSalary(vacancy)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDate(vacancy.created_at)}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-orange-500/70">
                          Детальніше
                        </button>
                        <button className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-xs font-semibold text-orange-600 transition hover:bg-orange-500/20">
                          Відгукнутися
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-medium">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-slate-900">Фільтри пошуку</h2>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSearch}>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                placeholder="Ключові слова, посада"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                placeholder="Місто або країна"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />

              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                placeholder="Зарплата від"
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
              />

              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-orange-500/60"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
              >
                <option value="">Всі типи зайнятості</option>
                <option value="Full-time">Повна зайнятість</option>
                <option value="Part-time">Часткова зайнятість</option>
                <option value="Remote">Віддалено</option>
                <option value="Office">В офісі</option>
                <option value="Hybrid">Гібрид</option>
              </select>

              <button
                className="w-full rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Пошук..." : "Знайти вакансії"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}

export default JobSearch

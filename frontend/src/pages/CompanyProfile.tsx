import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { getCompanyById } from "../api/companies"
import { listCompanyVacancies } from "../api/vacancies"
import Navbar from "../components/layout/Navbar"
import type { CompanyResponse } from "../types/company"
import type { VacancyResponse } from "../types/vacancy"

interface RequestErrorWithStatus extends Error {
  status?: number
}

const toWebsiteUrl = (website: string | null | undefined) => {
  if (!website) {
    return null
  }
  return /^https?:\/\//i.test(website) ? website : `https://${website}`
}

const formatDate = (dateValue: string | null | undefined) => {
  if (!dateValue) {
    return "Not specified"
  }
  const parsed = Date.parse(dateValue)
  if (Number.isNaN(parsed)) {
    return "Not specified"
  }
  return new Date(parsed).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const formatSalary = (vacancy: VacancyResponse) => {
  const min = vacancy.salary_min ?? undefined
  const max = vacancy.salary_max ?? undefined
  const currency = vacancy.salary_currency ?? "UAH"
  if (min && max) {
    return `${min}-${max} ${currency}`
  }
  if (min) {
    return `from ${min} ${currency}`
  }
  if (max) {
    return `up to ${max} ${currency}`
  }
  return "Salary not specified"
}

const toCompanyLocation = (company: CompanyResponse | null) => {
  if (!company) {
    return "Location not specified"
  }
  const parts = [company.city, company.country].filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  )
  if (!parts.length) {
    return "Location not specified"
  }
  return parts.join(", ")
}

const getCompanyInitials = (name: string) => {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() ?? "")
    .join("")
  return letters || "CO"
}

const isVisibleWorkerVacancy = (vacancy: VacancyResponse) => {
  if (!vacancy.is_active) {
    return false
  }
  if (!vacancy.expires_at) {
    return true
  }
  const expiration = Date.parse(vacancy.expires_at)
  if (Number.isNaN(expiration)) {
    return true
  }
  return expiration > Date.now()
}

const getVacancyBadges = (vacancy: VacancyResponse) => {
  const rawValues = [
    ...(vacancy.employment_type ?? []),
    ...(vacancy.work_format ?? []),
  ]
  return Array.from(
    new Set(
      rawValues
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  )
}

const CompanyProfile = () => {
  const navigate = useNavigate()
  const { companyId } = useParams()
  const normalizedCompanyId = useMemo(() => {
    const parsed = Number(companyId)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null
    }
    return parsed
  }, [companyId])

  const [company, setCompany] = useState<CompanyResponse | null>(null)
  const [vacancies, setVacancies] = useState<VacancyResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLogoFailed, setIsLogoFailed] = useState(false)

  useEffect(() => {
    setIsLogoFailed(false)
  }, [company?.logo_url])

  useEffect(() => {
    if (!normalizedCompanyId) {
      setCompany(null)
      setVacancies([])
      setError("Invalid company identifier")
      setIsLoading(false)
      return
    }

    let mounted = true
    void (async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [companyData, companyVacancies] = await Promise.all([
          getCompanyById(normalizedCompanyId),
          listCompanyVacancies(normalizedCompanyId),
        ])
        if (!mounted) {
          return
        }
        setCompany(companyData)
        setVacancies(companyVacancies.filter(isVisibleWorkerVacancy))
      } catch (err) {
        if (!mounted) {
          return
        }
        const requestError = err as RequestErrorWithStatus
        if (requestError.status === 404) {
          setError("Company was not found")
        } else if (requestError.status === 403) {
          setError("This company profile is not available for your role")
        } else {
          setError(requestError.message || "Failed to load company profile")
        }
        setCompany(null)
        setVacancies([])
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      mounted = false
    }
  }, [normalizedCompanyId])

  const companyLocation = toCompanyLocation(company)
  const websiteUrl = toWebsiteUrl(company?.website)

  return (
    <div className="min-h-screen bg-[#e9edf4]">
      <Navbar />

      <main className="mx-auto max-w-[1180px] px-4 pb-12 pt-8">
        <Link
          to="/jobs"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
        >
          Back to jobs
        </Link>

        {isLoading && (
          <section className="mt-5 animate-pulse space-y-4">
            <div className="h-40 rounded-[28px] bg-slate-200" />
            <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
              <div className="h-52 rounded-2xl bg-slate-200" />
              <div className="h-52 rounded-2xl bg-slate-200" />
            </div>
            <div className="h-40 rounded-2xl bg-slate-200" />
          </section>
        )}

        {!isLoading && error && (
          <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <p className="font-semibold">Unable to open company profile</p>
            <p className="mt-2">{error}</p>
          </section>
        )}

        {!isLoading && !error && company && (
          <>
            <section className="relative mt-5 overflow-hidden rounded-[30px] bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-6 text-white shadow-medium md:p-8">
              <div className="pointer-events-none absolute -right-10 top-4 h-40 w-40 rounded-full bg-orange-400/20 blur-3xl" />
              <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-cyan-300/20 blur-3xl" />

              <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  {company.logo_url && !isLogoFailed ? (
                    <img
                      src={company.logo_url}
                      alt={`${company.name} logo`}
                      className="h-16 w-16 rounded-2xl border border-white/30 bg-white object-cover shadow-soft"
                      onError={() => setIsLogoFailed(true)}
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/30 bg-white/15 text-lg font-bold text-white">
                      {getCompanyInitials(company.name)}
                    </div>
                  )}

                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/60">Company profile</p>
                    <h1 className="mt-2 font-display text-2xl font-semibold md:text-3xl">{company.name}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/75">
                      <span>{companyLocation}</span>
                      <span className="h-1 w-1 rounded-full bg-white/40" />
                      <span>{company.is_verified ? "Verified employer" : "Profile pending verification"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {websiteUrl && (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                    >
                      Visit website
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/jobs")}
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                  >
                    Find more jobs
                  </button>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[1fr,320px]">
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">About company</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {company.description?.trim() || "The company has not added a description yet."}
                </p>

                <div className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-xs uppercase tracking-wide text-slate-500">Industry</span>
                    <div className="mt-1 font-semibold text-slate-900">{company.industry || "Not specified"}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-xs uppercase tracking-wide text-slate-500">Company size</span>
                    <div className="mt-1 font-semibold text-slate-900">{company.company_size || "Not specified"}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-xs uppercase tracking-wide text-slate-500">Founded</span>
                    <div className="mt-1 font-semibold text-slate-900">
                      {company.founded_year ? String(company.founded_year) : "Not specified"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-xs uppercase tracking-wide text-slate-500">Legal name</span>
                    <div className="mt-1 font-semibold text-slate-900">{company.legal_name || "Not specified"}</div>
                  </div>
                </div>
              </article>

              <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Trust signals</p>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Active vacancies</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{vacancies.length}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Last update</div>
                    <div className="mt-1 font-semibold text-slate-900">{formatDate(company.updated_at)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Contact email</div>
                    <div className="mt-1 break-all font-semibold text-slate-900">{company.email || "Not specified"}</div>
                  </div>
                </div>
              </aside>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Open roles</p>
                  <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">Company vacancies</h2>
                </div>
                <p className="text-sm text-slate-500">
                  {vacancies.length > 0 ? `${vacancies.length} active positions` : "No active vacancies right now"}
                </p>
              </div>

              {vacancies.length === 0 ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                  This company does not have visible vacancies at the moment.
                </div>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {vacancies.map((vacancy) => {
                    const badges = getVacancyBadges(vacancy)
                    return (
                      <article
                        key={vacancy.id}
                        className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-orange-300"
                      >
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">{vacancy.title}</h3>
                          <p className="mt-2 line-clamp-3 text-sm text-slate-600">{vacancy.description}</p>

                          <div className="mt-4 space-y-2 text-sm text-slate-600">
                            <div className="flex items-center justify-between gap-3">
                              <span>Location</span>
                              <span className="text-right font-semibold text-slate-900">
                                {vacancy.location || "Not specified"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Salary</span>
                              <span className="text-right font-semibold text-slate-900">{formatSalary(vacancy)}</span>
                            </div>
                          </div>

                          {badges.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {badges.map((badge) => (
                                <span
                                  key={`${vacancy.id}-${badge}`}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="text-xs text-slate-500">
                            Published: {formatDate(vacancy.created_at)}
                          </div>
                          <div className="flex gap-2">
                            <Link
                              to={`/jobs?vacancyId=${vacancy.id}`}
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                            >
                              View details
                            </Link>
                            <Link
                              to={`/jobs?vacancyId=${vacancy.id}`}
                              className="flex-1 rounded-lg bg-[#1f2f5e] px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-[#1b294f]"
                            >
                              Apply
                            </Link>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default CompanyProfile

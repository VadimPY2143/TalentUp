import { startTransition, useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import Navbar from "../components/layout/Navbar"
import { paymentsApi, type CreditPackage } from "../api/payments"
import { normalizeReturnTo } from "../payments/insufficientCredits"

const RESUME_SUMMARY_CREDITS = 4
const VACANCY_AI_FILL_CREDITS = 12
const CANDIDATE_MATCHING_PER_CANDIDATE_CREDITS = 2

type PaymentStatus = "success" | "failed" | "returned" | null

const formatUah = (amount: number) =>
  new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 0,
  }).format(amount)

const formatUahPerCredit = (amount: number) =>
  new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

const formatNumber = (value: number) =>
  new Intl.NumberFormat("uk-UA").format(value)

const parsePositiveInt = (value: string | null): number | null => {
  if (!value) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return Math.max(0, Math.trunc(parsed))
}

const resolvePaymentStatus = (params: URLSearchParams): PaymentStatus => {
  const rawStatus = (
    params.get("transactionStatus")
    || params.get("status")
    || params.get("payment_status")
    || params.get("payment")
    || ""
  )
    .trim()
    .toLowerCase()

  if (!rawStatus) {
    return null
  }
  if (["approved", "success", "paid", "complete", "completed"].includes(rawStatus)) {
    return "success"
  }
  if (["failed", "declined", "error"].includes(rawStatus)) {
    return "failed"
  }
  return "returned"
}

const getFeatureLabel = (feature: string | null): string | null => {
  if (!feature) {
    return null
  }
  if (feature === "candidate_matching") {
    return "AI Candidate Match"
  }
  if (feature === "vacancy_ai_fill") {
    return "AI Vacancy Fill"
  }
  if (feature === "resume_summary") {
    return "AI Resume Summary"
  }
  return feature.replace(/_/g, " ")
}

const getPackageCardDescription = (pkg: CreditPackage): string => {
  if (pkg.credits <= 80) {
    return "Для швидкого старту: протестувати AI-функції, закрити точкові задачі та оцінити результат."
  }
  if (pkg.credits <= 500) {
    return "Для регулярного найму: стабільний запас кредитів на щоденні задачі рекрутера та команди."
  }
  return "Для масштабного рекрутингу: максимальна вигода за кредит і достатній обсяг для багатьох вакансій."
}

export default function PaymentTest() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingCode, setProcessingCode] = useState<string | null>(null)
  const [selectedPackageCode, setSelectedPackageCode] = useState<string | null>(null)

  const reason = searchParams.get("reason")
  const requiredCredits = parsePositiveInt(searchParams.get("required"))
  const currentCredits = parsePositiveInt(searchParams.get("current"))
  const requestedMissing = parsePositiveInt(searchParams.get("missing"))
  const feature = searchParams.get("feature")
  const featureLabel = getFeatureLabel(feature)
  const returnTo = normalizeReturnTo(searchParams.get("return_to"), "/dashboard")
  const paymentStatus = resolvePaymentStatus(searchParams)

  const missingCredits = Math.max(
    0,
    requestedMissing
    ?? ((requiredCredits ?? 0) - (currentCredits ?? 0)),
  )

  const recommendedPackage = useMemo(() => {
    if (!packages.length) {
      return null
    }
    if (missingCredits > 0) {
      return packages.find((item) => item.credits >= missingCredits) ?? packages[packages.length - 1]
    }
    return packages[0]
  }, [missingCredits, packages])

  const selectedPackage = useMemo(() => {
    if (!packages.length) {
      return null
    }
    if (selectedPackageCode) {
      const current = packages.find((item) => item.code === selectedPackageCode)
      if (current) {
        return current
      }
    }
    return recommendedPackage
  }, [packages, recommendedPackage, selectedPackageCode])

  useEffect(() => {
    if (selectedPackageCode) {
      return
    }
    if (recommendedPackage) {
      setSelectedPackageCode(recommendedPackage.code)
    }
  }, [recommendedPackage, selectedPackageCode])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextPackages, nextBalance] = await Promise.all([
        paymentsApi.getPackages(),
        paymentsApi.getBalance(),
      ])
      setPackages(nextPackages)
      setBalance(nextBalance.credits)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося завантажити дані оплати")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handlePurchase = async (pkg: CreditPackage) => {
    try {
      setError(null)
      setProcessingCode(pkg.code)
      const idempotencyKey = `payment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const order = await paymentsApi.createOrder({
        package_code: pkg.code,
        idempotency_key: idempotencyKey,
      })

      const form = document.createElement("form")
      form.method = "POST"
      form.action = order.checkout_url

      Object.entries(order.checkout_fields).forEach(([key, value]) => {
        const input = document.createElement("input")
        input.type = "hidden"
        input.name = key
        input.value = String(value)
        form.appendChild(input)
      })

      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося створити платіж")
    } finally {
      setProcessingCode(null)
    }
  }

  const handleBack = () => {
    startTransition(() => {
      navigate(returnTo)
    })
  }

  const selectedPricePerCredit = selectedPackage
    ? selectedPackage.price_uah / Math.max(1, selectedPackage.credits)
    : 0

  const selectedResumeSummaries = selectedPackage
    ? Math.floor(selectedPackage.credits / RESUME_SUMMARY_CREDITS)
    : 0
  const selectedVacancyAIFills = selectedPackage
    ? Math.floor(selectedPackage.credits / VACANCY_AI_FILL_CREDITS)
    : 0
  const selectedCandidateResumeScans = selectedPackage
    ? Math.floor(selectedPackage.credits / CANDIDATE_MATCHING_PER_CANDIDATE_CREDITS)
    : 0

  const showDeficitBanner = reason === "insufficient_credits" || missingCredits > 0

  return (
    <div className="min-h-screen bg-[#e9edf4]">
      <Navbar />
      <main className="mx-auto w-full max-w-[1160px] px-4 pb-28 pt-8 md:pb-10 md:pt-10">
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#07122d] via-[#10234f] to-[#24408a] p-6 text-white shadow-medium md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-orange-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-90px] right-24 h-52 w-52 rounded-full border border-white/15" />

          <div className="relative grid gap-5 lg:grid-cols-[1.5fr,0.5fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-white/70">TalentUp Credits</p>
              <h1 className="mt-3 font-display text-2xl font-semibold md:text-4xl">
                Поповніть баланс і продовжуйте найм без пауз
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/85 md:text-base">
                Кредити відкривають AI-підбір кандидатів, AI-генерацію вакансій і швидші рішення в процесі найму.
              </p>

              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold md:text-sm">
                <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                  Безпечна онлайн-оплата
                </span>
                <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                  Миттєва активація кредитів
                </span>
                <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                  Прозорі пакети без прихованих комісій
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.24em] text-white/70">Ваш баланс</p>
                <div className="mt-3 flex items-baseline justify-center gap-2">
                  <span className="text-4xl font-semibold md:text-5xl">{formatNumber(balance)}</span>
                  <span className="text-base text-white/80">кредитів</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-3">
          {showDeficitBanner && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              Щоб продовжити дію, потрібно ще <span className="font-semibold">{formatNumber(missingCredits)}</span> кредитів.
              Вимагається: <span className="font-semibold">{requiredCredits ?? "?"}</span>, доступно:{" "}
              <span className="font-semibold">{currentCredits ?? "?"}</span>.
            </div>
          )}

          {paymentStatus === "success" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Платіж успішний. Оновіть баланс і поверніться до задачі.
            </div>
          )}
          {paymentStatus === "failed" && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              Оплату не завершено. Спробуйте ще раз або оберіть інший пакет.
            </div>
          )}
          {paymentStatus === "returned" && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              Ви повернулися з платіжної форми. Перевірте баланс і, за потреби, повторіть оплату.
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        <section className="mt-6">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-56 animate-pulse rounded-[24px] border border-slate-200 bg-white shadow-soft"
                />
              ))}
            </div>
          ) : packages.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-soft">
              Пакети кредитів тимчасово недоступні.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {packages.map((pkg, index) => {
                const isRecommended = recommendedPackage?.id === pkg.id
                const isSelected = selectedPackage?.id === pkg.id
                const pricePerCredit = pkg.price_uah / Math.max(1, pkg.credits)
                const shouldBadgePopular = !isRecommended && index === 1
                const shouldBadgeBestValue = !isRecommended && !shouldBadgePopular && pkg.code === "PRO_900"
                return (
                  <article
                    key={pkg.id}
                    className={`group relative overflow-hidden rounded-[24px] border bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-1 ${
                      isSelected
                        ? "border-[#1f2f5e] ring-2 ring-[#1f2f5e]/20"
                        : isRecommended
                            ? "border-orange-300 ring-2 ring-orange-200/70"
                            : "border-slate-200"
                    }`}
                  >
                    <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-slate-100 transition group-hover:scale-110" />
                    {isRecommended && (
                      <span className="absolute right-4 top-4 rounded-full bg-orange-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                        Найкращий вибір
                      </span>
                    )}
                    {shouldBadgePopular && (
                      <span className="absolute right-4 top-4 rounded-full bg-[#1f2f5e] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                        Популярний
                      </span>
                    )}
                    {shouldBadgeBestValue && (
                      <span className="absolute right-4 top-4 rounded-full bg-[#5b3aa3] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                        Макс вигода
                      </span>
                    )}

                    <h3 className="relative text-xl font-semibold text-slate-900">{pkg.name}</h3>
                    <p className="mt-2 text-sm text-slate-600">{getPackageCardDescription(pkg)}</p>

                    <div className="mt-4 space-y-1 text-sm text-slate-700">
                      <div className="flex items-center justify-between">
                        <span>Кредити</span>
                        <span className="font-semibold text-slate-900">{formatNumber(pkg.credits)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Вартість</span>
                        <span className="font-semibold text-slate-900">{formatUah(pkg.price_uah)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Ціна за 1 кредит</span>
                        <span className="font-semibold text-slate-900">{formatUahPerCredit(pricePerCredit)}</span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2">
                      <button
                        className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          isRecommended ? "bg-orange-500 hover:bg-orange-600" : "bg-[#1f2f5e] hover:bg-[#1a2750]"
                        }`}
                        type="button"
                        onClick={() => void handlePurchase(pkg)}
                        disabled={processingCode !== null}
                      >
                        {processingCode === pkg.code ? "Переадресація..." : "Поповнити кредити"}
                      </button>
                      <button
                        className={`w-full rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                          isSelected
                            ? "border-[#1f2f5e] bg-[#1f2f5e]/5 text-[#1f2f5e]"
                            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                        type="button"
                        onClick={() => setSelectedPackageCode(pkg.code)}
                      >
                        {isSelected ? "Пакет обрано" : "Обрати пакет"}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {selectedPackage && (
          <section className="mt-6 rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft md:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Що ви отримаєте з пакетом {selectedPackage.name}</h3>
            <p className="mt-1 text-sm text-slate-600">
              Обрано: <span className="font-semibold text-slate-900">{formatNumber(selectedPackage.credits)} кредитів</span> за{" "}
              <span className="font-semibold text-slate-900">{formatUah(selectedPackage.price_uah)}</span>
              {" "}({formatUahPerCredit(selectedPricePerCredit)} / кредит)
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">AI Resume Summary</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">~{formatNumber(selectedResumeSummaries)}</div>
                <div className="mt-1 text-xs text-slate-500">Аналіз резюме за 5 секунд замість 5 хв читання</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">AI Vacancy Fill</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">~{formatNumber(selectedVacancyAIFills)}</div>
                <div className="mt-1 text-xs text-slate-500">Автоматично заповнить вакансію за вашим коротким описом замість довгої ручної роботи</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">AI Candidate Match</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">~{formatNumber(selectedCandidateResumeScans)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Автоматично підбере найкращих кандидатів під вашу вакансію без ручного перегляду
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft md:p-6">
          <h3 className="text-lg font-semibold text-slate-900">Чому купують кредити на TalentUp</h3>
          <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              Миттєвий доступ до AI-функцій для рекрутера.
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              Захищена оплата через сертифікований платіжний шлюз, без збереження картки в TalentUp.
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              Швидке повернення в сценарій найму одразу після оплати.
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              Прозора економіка: видно ціну пакета і вартість кожної дії.
            </div>
          </div>
        </section>
      </main>

      {selectedPackage && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-strong backdrop-blur md:hidden">
          <div className="mx-auto flex w-full max-w-[1160px] items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900">{selectedPackage.name}</div>
              <div className="text-xs text-slate-600">
                {formatNumber(selectedPackage.credits)} кредитів • {formatUah(selectedPackage.price_uah)}
              </div>
            </div>
            <button
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => void handlePurchase(selectedPackage)}
              disabled={processingCode !== null}
            >
              {processingCode ? "..." : "Купити"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

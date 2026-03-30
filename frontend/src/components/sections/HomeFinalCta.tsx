import { Link } from "react-router-dom"
import type { UserRole } from "../../types/auth"

interface HomeFinalCtaProps {
  isAuthenticated: boolean
  role: UserRole | null
}

const HomeFinalCta = ({ isAuthenticated, role }: HomeFinalCtaProps) => {
  const title = !isAuthenticated
    ? "Готові почати?"
    : role === "employer"
      ? "Керуйте наймом без зайвих кроків"
      : "Час знайти наступну роботу"

  const subtitle = !isAuthenticated
    ? "Створіть акаунт кандидата або роботодавця та почніть роботу в TalentUp."
    : role === "employer"
      ? "Публікуйте вакансії, відбирайте кандидатів і спілкуйтеся з ними в єдиному процесі."
      : "Оновіть резюме, відкрийте нові вакансії і відстежуйте всі відгуки в одному кабінеті."

  return (
    <section className="bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] px-4 py-16 text-white md:py-20">
      <div className="mx-auto max-w-[1120px] rounded-3xl border border-white/15 bg-white/5 p-7 backdrop-blur-sm md:p-10">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm text-white/80 md:text-base">{subtitle}</p>

        <div className="mt-7 flex flex-wrap gap-3">
          {!isAuthenticated && (
            <>
              <Link
                className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                to="/register"
              >
                Створити акаунт кандидата
              </Link>
              <Link
                className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                to="/register?role=employer"
              >
                Створити акаунт роботодавця
              </Link>
            </>
          )}

          {isAuthenticated && role === "worker" && (
            <>
              <Link
                className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                to="/jobs"
              >
                Знайти вакансії
              </Link>
              <Link
                className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                to="/dashboard"
              >
                Мій кабінет
              </Link>
            </>
          )}

          {isAuthenticated && role === "employer" && (
            <>
              <Link
                className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                to="/candidates"
              >
                Відкрити базу кандидатів
              </Link>
              <Link
                className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                to="/dashboard"
              >
                Мій кабінет
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default HomeFinalCta

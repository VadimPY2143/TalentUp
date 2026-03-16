import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../../auth/useAuth"

const Navbar = () => {
  const navigate = useNavigate()
  const { isAuthenticated, role, logout } = useAuth()

  const primaryButton =
    "inline-flex items-center justify-center rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
  const secondaryButton =
    "inline-flex items-center justify-center rounded-xl bg-[#13244d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f1d3c]"

  const handleLogout = () => {
    logout()
    navigate("/")
  }

  return (
    <header className="sticky top-0 z-30 overflow-hidden border-b border-white/10 bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77]">
      <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-cyan-300/15 blur-2xl" />
      <div className="pointer-events-none absolute -right-8 top-0 h-28 w-28 rounded-full bg-orange-400/20 blur-2xl" />

      <div className="relative mx-auto flex max-w-[1120px] items-center justify-between px-4 py-4">
        <Link to="/" className="font-display text-xl font-semibold text-white md:text-2xl">
          Talent<span className="text-orange-500">Up</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-white/90 md:flex">
          {!isAuthenticated && (
            <>
              <Link className="transition hover:text-orange-300" to="/">Знайти роботу</Link>
              <Link className="transition hover:text-orange-300" to="/">Найняти фахівця</Link>
            </>
          )}
          {isAuthenticated && role === "worker" && (
            <Link className="transition hover:text-orange-300" to="/">Знайти роботу</Link>
          )}
          {isAuthenticated && role === "employer" && (
            <>
              <Link className="transition hover:text-orange-300" to="/candidates">База резюме</Link>
              <Link className="transition hover:text-orange-300" to="/">Найняти фахівця</Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/40"
              >
                Кабінет
              </Link>
              <button className={primaryButton} type="button" onClick={handleLogout}>
                Вийти
              </button>
            </>
          ) : (
            <>
              <Link to="/register" className={primaryButton}>
                Зареєструватися
              </Link>
              <Link to="/login" className={secondaryButton}>
                Увійти
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar

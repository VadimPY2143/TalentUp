import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../../auth/useAuth"

const Navbar = () => {
  const navigate = useNavigate()
  const { isAuthenticated, role, logout } = useAuth()

  const primaryButton =
    "inline-flex items-center justify-center rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
  const secondaryButton =
    "inline-flex items-center justify-center rounded-xl bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700"

  const handleLogout = () => {
    logout()
    navigate("/")
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-navy-900">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between px-4 py-4">
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
          {isAuthenticated && role === "worker" && <Link className="transition hover:text-orange-300" to="/">Знайти роботу</Link>}
          {isAuthenticated && role === "employer" && <Link className="transition hover:text-orange-300" to="/">Найняти фахівця</Link>}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="inline-flex items-center justify-center rounded-xl border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/40">
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

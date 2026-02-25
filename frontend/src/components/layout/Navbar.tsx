import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../../auth/useAuth"

const Navbar = () => {
  const navigate = useNavigate()
  const { isAuthenticated, role, logout } = useAuth()

  const primaryButton =
    "inline-flex items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5"
  const secondaryButton =
    "inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"

  const handleLogout = () => {
    logout()
    navigate("/")
  }

  return (
    <header className="sticky top-0 z-20 bg-navy-900">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between px-4 py-5">
        <Link to="/" className="font-display text-xl font-semibold text-white">
          Talent<span className="text-orange-500">Up</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-white/85 md:flex">
          {!isAuthenticated && (
            <>
              <Link to="/">Знайти роботу</Link>
              <Link to="/">Найняти фахівця</Link>
            </>
          )}
          {isAuthenticated && role === "worker" && <Link to="/">Знайти роботу</Link>}
          {isAuthenticated && role === "employer" && (
            <Link to="/">Найняти фахівця</Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className={secondaryButton}>
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

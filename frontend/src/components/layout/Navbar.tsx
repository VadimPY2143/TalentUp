import { Menu, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../../auth/useAuth"
import logo from "../../assets/talentup-logo.png"
import NotificationBell from "../NotificationBell"

const Navbar = () => {
  const navigate = useNavigate()
  const { isAuthenticated, role, logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const primaryButton =
    "inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
  const secondaryButton =
    "inline-flex items-center justify-center rounded-xl bg-[#13244d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f1d3c]"

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = ""
      return
    }

    document.body.style.overflow = "hidden"
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [isMobileMenuOpen])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [isAuthenticated, role])

  const handleLogout = () => {
    logout()
    setIsMobileMenuOpen(false)
    navigate("/")
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  const navItems = !isAuthenticated
    ? [
        { to: "/jobs", label: "Знайти роботу" },
        { to: "/register?role=employer", label: "Розмістити вакансію" },
      ]
    : role === "worker"
      ? [
          { to: "/jobs", label: "Знайти роботу" },
          { to: "/messages", label: "Повідомлення" },
        ]
      : [
          { to: "/candidates", label: "База резюме" },
          { to: "/payment?return_to=/dashboard", label: "Купити кредити" },
          { to: "/messages", label: "Повідомлення" },
        ]

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77]">
      <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-cyan-300/15 blur-2xl" />
      <div className="pointer-events-none absolute -right-8 top-0 h-28 w-28 rounded-full bg-orange-400/20 blur-2xl" />

      <div className="relative mx-auto flex h-16 max-w-[1120px] items-center justify-between px-3 md:h-24 md:px-1">
        <Link to="/" className="flex h-full items-center">
          <img
            src={logo}
            alt="TalentUp"
            className="block h-12 w-auto object-contain md:relative md:top-3 md:h-[145px] md:min-w-[300px]"
          />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-white/90 md:flex">
          {navItems.map((item) => (
            <Link key={item.to} className="transition hover:text-orange-300" to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex md:gap-3">
          {isAuthenticated ? (
            <>
              <NotificationBell />
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

        <div className="flex items-center gap-2 md:hidden">
          {isAuthenticated && <NotificationBell />}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 text-white transition hover:bg-white/10"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close menu backdrop"
            onClick={closeMobileMenu}
          />

          <div className="absolute inset-x-2 top-2 mx-auto w-auto max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0f1d3c] shadow-2xl">
            <div className="max-h-[min(82dvh,600px)] overflow-y-auto p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.25em] text-white/60">Menu</p>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-white"
                  onClick={closeMobileMenu}
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="space-y-1.5">
                {navItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white/95"
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-3 space-y-1.5">
                {isAuthenticated ? (
                  <>
                    <Link
                      to="/dashboard"
                      className="block rounded-xl border border-white/20 px-4 py-2.5 text-center text-sm font-semibold text-white"
                      onClick={closeMobileMenu}
                    >
                      Кабінет
                    </Link>
                    <button className={`${primaryButton} w-full`} type="button" onClick={handleLogout}>
                      Вийти
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/register" className={`${primaryButton} w-full`} onClick={closeMobileMenu}>
                      Зареєструватися
                    </Link>
                    <Link to="/login" className={`${secondaryButton} w-full`} onClick={closeMobileMenu}>
                      Увійти
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export default Navbar

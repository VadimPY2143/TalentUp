import { useMemo, useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { loginUser } from "../api/auth"
import { API_URL } from "../api/client"
import { useAuth } from "../auth/useAuth"
import logo from "../assets/talentup-logo.png"

const Login = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const oauthError = useMemo(() => searchParams.get("oauth_error"), [searchParams])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!email || !password) {
      setError("Заповніть усі поля")
      return
    }

    try {
      setIsSubmitting(true)
      const data = await loginUser({ email, password })
      login(data.access_token)
      navigate("/")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Помилка входу"
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#e9edf4]">
      <div className="grid min-h-screen w-full overflow-hidden lg:grid-cols-2">
        <div className="relative flex min-h-[36vh] flex-col justify-between gap-8 bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-6 text-white md:p-12 lg:min-h-screen">
          <Link to="/" className="inline-flex items-center">
            <img src={logo} alt="TalentUp" className="h-14 w-auto origin-left scale-[1.25] sm:h-16 md:h-20" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl md:text-4xl">Працюй там, де тебе цінують</h1>
            <ul className="mt-4 space-y-2 text-sm text-white/80 sm:mt-6">
              <li>10 000+ кандидатів</li>
              <li>Прозорий найм</li>
              <li>Швидкий старт</li>
            </ul>
          </div>
          <p className="text-xs text-white/55">TalentUp Career Platform</p>
        </div>

        <div className="flex min-h-[60vh] items-center justify-center bg-[#f4f6fa] p-4 sm:p-6 md:p-10 lg:min-h-screen">
          <div className="w-full max-w-[520px] rounded-2xl bg-white p-4 shadow-soft sm:p-6 md:bg-transparent md:p-0 md:shadow-none">
            <h2 className="text-center text-2xl font-semibold text-slate-900">Увійти в акаунт</h2>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                placeholder="Пароль"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Link className="text-sm font-semibold text-orange-500" to="/">
                Забули пароль?
              </Link>
              {error && (
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm text-orange-600">
                  {error}
                </div>
              )}
              {oauthError && (
                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
                  OAuth помилка: {oauthError}
                </div>
              )}
              <button
                className="h-11 w-full rounded-xl bg-orange-500 px-6 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Вхід..." : "Увійти"}
              </button>
            </form>

            <div className="my-5 flex items-center gap-2 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              або
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  window.location.href = `${API_URL}/auth/google/login`
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                type="button"
              >
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M23.5 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.44a5.51 5.51 0 0 1-2.38 3.62v3.01h3.86c2.26-2.08 3.58-5.14 3.58-8.74Z" fill="#4285F4" />
                  <path d="M12 24c3.24 0 5.96-1.07 7.95-2.89l-3.86-3.01c-1.07.72-2.44 1.16-4.09 1.16-3.15 0-5.82-2.13-6.78-4.98H1.23v3.12A12 12 0 0 0 12 24Z" fill="#34A853" />
                  <path d="M5.22 14.28a7.22 7.22 0 0 1 0-4.56V6.6H1.23a12 12 0 0 0 0 10.8l3.99-3.12Z" fill="#FBBC05" />
                  <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.45-3.45A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.23 6.6l3.99 3.12C6.18 6.87 8.85 4.75 12 4.75Z" fill="#EA4335" />
                </svg>
                Продовжити з Google
              </button>
            </div>

            <div className="mt-6 text-center text-sm text-slate-500">
              Немає акаунту?{" "}
              <Link className="font-semibold text-orange-500" to="/register">
                Зареєструватися
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

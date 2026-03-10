import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { loginUser } from "../api/auth"
import { useAuth } from "../auth/useAuth"

const Login = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      login(data.access_token, data.refresh_token)
      navigate("/dashboard")
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
        <div className="relative flex min-h-[42vh] flex-col justify-between gap-8 bg-navy-900 p-8 text-white md:p-12 lg:min-h-screen">
          <div className="text-xl font-semibold">
            Talent<span className="text-orange-500">Up</span>
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold md:text-4xl">
              Працюй там, де тебе цінують
            </h1>
            <ul className="mt-6 space-y-2 text-sm text-white/80">
              <li>10 000+ кандидатів</li>
              <li>Прозорий найм</li>
              <li>Швидкий старт</li>
            </ul>
          </div>
          <p className="text-xs text-white/55">TalentUp Career Platform</p>
        </div>

        <div className="flex min-h-[58vh] items-center justify-center bg-[#f4f6fa] p-8 md:p-10 lg:min-h-screen">
          <div className="w-full max-w-[520px]">
          <h2 className="text-center font-display text-2xl font-semibold text-slate-900">
            Увійти в акаунт
          </h2>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
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
            <button
              className="w-full rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              type="button"
            >
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M23.5 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.44a5.51 5.51 0 0 1-2.38 3.62v3.01h3.86c2.26-2.08 3.58-5.14 3.58-8.74Z" fill="#4285F4" />
                <path d="M12 24c3.24 0 5.96-1.07 7.95-2.89l-3.86-3.01c-1.07.72-2.44 1.16-4.09 1.16-3.15 0-5.82-2.13-6.78-4.98H1.23v3.12A12 12 0 0 0 12 24Z" fill="#34A853" />
                <path d="M5.22 14.28a7.22 7.22 0 0 1 0-4.56V6.6H1.23a12 12 0 0 0 0 10.8l3.99-3.12Z" fill="#FBBC05" />
                <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.45-3.45A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.23 6.6l3.99 3.12C6.18 6.87 8.85 4.75 12 4.75Z" fill="#EA4335" />
              </svg>
              Продовжити з Google
            </button>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              type="button"
            >
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.5 3h-17A1.5 1.5 0 0 0 2 4.5v15A1.5 1.5 0 0 0 3.5 21h17a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 20.5 3ZM8.34 18.5H5.67V9.5h2.67v9ZM7 8.34a1.55 1.55 0 1 1 0-3.1 1.55 1.55 0 0 1 0 3.1Zm12.5 10.16h-2.67v-4.42c0-1.06-.02-2.43-1.48-2.43-1.49 0-1.72 1.16-1.72 2.36v4.5h-2.67V9.5h2.56v1.23h.04c.36-.68 1.25-1.4 2.57-1.4 2.75 0 3.26 1.81 3.26 4.16v5.01Z" fill="#0A66C2" />
              </svg>
              Продовжити з LinkedIn
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-slate-500">
            Немає акаунту? <Link className="font-semibold text-orange-500" to="/register">Зареєструватися</Link>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

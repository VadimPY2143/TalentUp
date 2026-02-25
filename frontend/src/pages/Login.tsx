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
      login(data.access_token)
      navigate("/dashboard")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Помилка входу"
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-sky-50 lg:grid lg:grid-cols-2">
      <div className="flex flex-col gap-6 bg-gradient-to-b from-navy-900 to-navy-700 px-8 py-12 text-white md:px-12">
        <div className="text-xl font-semibold">
          Talent<span className="text-orange-500">Up</span>
        </div>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">
          Почни заробляти вже сьогодні
        </h1>
        <ul className="space-y-2 text-sm text-white/80">
          <li>10 000+ фрилансерів</li>
          <li>Безпечні платежі</li>
          <li>Швидкий старт</li>
        </ul>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-medium animate-fade-up">
          <h2 className="text-center font-display text-2xl font-semibold text-slate-900">
            Увійти в акаунт
          </h2>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <input
              className="w-full rounded-xl bg-sky-50 px-4 py-3 text-sm text-slate-700 outline-none"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="w-full rounded-xl bg-sky-50 px-4 py-3 text-sm text-slate-700 outline-none"
              placeholder="Пароль"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Link className="text-sm font-semibold text-orange-500" to="/">
              Забули пароль?
            </Link>
            {error && (
              <div className="rounded-xl bg-orange-500/10 px-4 py-2 text-sm text-orange-600">
                {error}
              </div>
            )}
            <button
              className="w-full rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
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
              className="w-full rounded-xl bg-sky-50 px-4 py-3 text-sm font-semibold text-slate-600"
              type="button"
            >
              Продовжити з Google
            </button>
            <button
              className="w-full rounded-xl bg-sky-50 px-4 py-3 text-sm font-semibold text-slate-600"
              type="button"
            >
              Продовжити з Apple
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
  )
}

export default Login

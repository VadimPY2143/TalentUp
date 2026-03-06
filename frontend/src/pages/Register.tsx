import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { registerUser } from "../api/auth"
import type { UserRole } from "../types/auth"

const Register = () => {
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>("worker")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!username || !email || !password) {
      setError("Заповніть усі поля")
      return
    }

    try {
      setIsSubmitting(true)
      await registerUser({ username, email, password, role })
      navigate("/login")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Помилка реєстрації"
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const roleButton = (value: UserRole) => {
    const isActive = role === value
    const baseClass = "w-full rounded-xl border px-4 py-4 text-left text-sm transition flex items-center gap-3"
    const activeClass = "border-orange-500 bg-orange-500/10 text-slate-900"
    const idleClass = "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
    return `${baseClass} ${isActive ? activeClass : idleClass}`
  }

  return (
    <div className="min-h-screen w-full bg-[#e9edf4]">
      <div className="grid min-h-screen w-full overflow-hidden lg:grid-cols-2">
        <div className="relative flex min-h-[42vh] flex-col justify-between gap-8 bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white md:p-12 lg:min-h-screen">
          <div className="text-xl font-semibold">
            <Link to="/">
              Talent<span className="text-orange-500">Up</span>
            </Link>
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold md:text-4xl">
              Створи профіль та знайди роботу швидше
            </h1>
            <ul className="mt-6 space-y-2 text-sm text-white/80">
              <li>Реєстрація за 1 хвилину</li>
              <li>Ролі для шукача і роботодавця</li>
              <li>Швидкий доступ до вакансій</li>
            </ul>
          </div>
          <p className="text-xs text-white/55">TalentUp Career Platform</p>
        </div>

        <div className="flex min-h-[58vh] items-center justify-center bg-[#f4f6fa] p-8 md:p-10 lg:min-h-screen">
          <div className="w-full max-w-[520px]">
            <h2 className="text-center font-display text-2xl font-semibold text-slate-900">Створити акаунт</h2>

            <form className="mt-7 space-y-3" onSubmit={handleSubmit}>
              <button type="button" className={roleButton("worker")} onClick={() => setRole("worker")}>
                <span className="text-xl">🧑‍💻</span>
                <span>
                  <span className="block font-semibold text-slate-900">Я шукач роботи</span>
                  <span className="block text-xs text-slate-500">Хочу знайти роботу</span>
                </span>
              </button>

              <button type="button" className={roleButton("employer")} onClick={() => setRole("employer")}>
                <span className="text-xl">🏢</span>
                <span>
                  <span className="block font-semibold text-slate-900">Я роботодавець</span>
                  <span className="block text-xs text-slate-500">Хочу наймати спеціалістів</span>
                </span>
              </button>

              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                placeholder="Ім'я користувача"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                placeholder="Пароль (мін. 8 символів)"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              {error && (
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm text-orange-600">
                  {error}
                </div>
              )}

              <button
                className="mt-2 w-full rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Реєстрація..." : "Створити акаунт"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500">
              Вже маєте акаунт? <Link className="font-semibold text-orange-500" to="/login">Увійти</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register

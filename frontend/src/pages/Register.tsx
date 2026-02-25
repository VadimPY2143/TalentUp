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
      await registerUser({
        username,
        email,
        password,
        role,
      })
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
    const baseClass =
      "w-full rounded-xl border px-4 py-3 text-left text-sm transition"
    const activeClass = "border-orange-500 bg-orange-500/10 text-slate-900"
    const idleClass = "border-transparent bg-sky-50 text-slate-600"

    return `${baseClass} ${isActive ? activeClass : idleClass}`
  }

  return (
    <div className="min-h-screen bg-sky-50">
      <header className="bg-navy-900">
        <div className="mx-auto max-w-[1120px] px-4 py-5 text-white">
          <div className="text-xl font-semibold">
            Talent<span className="text-orange-500">Up</span>
          </div>
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-medium animate-fade-up">
          <h2 className="font-display text-2xl font-semibold text-slate-900">
            Створити акаунт
          </h2>
          <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
            <button
              type="button"
              className={roleButton("worker")}
              onClick={() => setRole("worker")}
            >
              Я фрилансер — Хочу знаходити замовлення
            </button>
            <button
              type="button"
              className={roleButton("employer")}
              onClick={() => setRole("employer")}
            >
              Я замовник — Хочу наймати спеціалістів
            </button>
            <input
              className="w-full rounded-xl bg-sky-50 px-4 py-3 text-sm text-slate-700 outline-none"
              placeholder="Ім'я користувача"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <input
              className="w-full rounded-xl bg-sky-50 px-4 py-3 text-sm text-slate-700 outline-none"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="w-full rounded-xl bg-sky-50 px-4 py-3 text-sm text-slate-700 outline-none"
              placeholder="Пароль (мін. 8 символів)"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && (
              <div className="rounded-xl bg-orange-500/10 px-4 py-2 text-sm text-orange-600">
                {error}
              </div>
            )}
            <button
              className="mt-2 w-full rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Реєстрація..." : "Створити акаунт"}
            </button>
          </form>
          <div className="mt-6 text-sm text-slate-500">
            Вже маєте акаунт?{" "}
            <Link className="font-semibold text-orange-500" to="/login">
              Увійти
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register

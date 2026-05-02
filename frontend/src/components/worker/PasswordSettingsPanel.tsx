import { useState, type FormEvent } from "react"
import { Lock } from "lucide-react"
import { changePassword } from "../../api/auth"
import { useAuth } from "../../auth/useAuth"

const PasswordSettingsPanel = () => {
  const { login } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const resetForm = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Заповніть усі поля")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Новий пароль і підтвердження не збігаються")
      return
    }

    try {
      setIsSubmitting(true)
      const token = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      login(token.access_token)
      resetForm()
      setSuccessMessage("Пароль успішно змінено")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося змінити пароль"
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rounded-3xl bg-white p-8 shadow-medium">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
          <Lock className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900">Зміна пароля</h2>
          <p className="mt-2 text-sm text-slate-600">
            Для підтвердження особи спочатку введіть поточний пароль, а потім задайте новий.
          </p>
        </div>
      </div>

      <form className="mt-6 max-w-xl space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="current-password">
            Поточний пароль
          </label>
          <input
            id="current-password"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-orange-500/60"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="new-password">
            Новий пароль
          </label>
          <input
            id="new-password"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-orange-500/60"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="confirm-password">
            Підтвердження нового пароля
          </label>
          <input
            id="confirm-password"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-orange-500/60"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <button
          className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Збереження..." : "Оновити пароль"}
        </button>
      </form>
    </section>
  )
}

export default PasswordSettingsPanel

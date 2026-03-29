import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { useAuth } from "../auth/useAuth"

const OAuthCallback = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  const accessToken = useMemo(() => searchParams.get("access_token"), [searchParams])
  const refreshToken = useMemo(() => searchParams.get("refresh_token"), [searchParams])

  useEffect(() => {
    if (!accessToken || !refreshToken) {
      setError("Невірна OAuth відповідь. Спробуйте ще раз.")
      return
    }

    login(accessToken, refreshToken)
    navigate("/", { replace: true })
  }, [accessToken, refreshToken, login, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#e9edf4] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-soft">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-slate-900">Помилка OAuth</h1>
            <p className="mt-3 text-sm text-slate-600">{error}</p>
            <button
              className="mt-5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
              type="button"
              onClick={() => navigate("/login", { replace: true })}
            >
              Повернутись до входу
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-slate-900">Виконуємо вхід...</h1>
            <p className="mt-3 text-sm text-slate-600">Зачекайте кілька секунд.</p>
          </>
        )}
      </div>
    </div>
  )
}

export default OAuthCallback

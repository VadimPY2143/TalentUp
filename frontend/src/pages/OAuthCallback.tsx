import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { useAuth } from "../auth/useAuth"
import { setApiUrlOverride } from "../api/client"

const OAuthCallback = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthReady, isAuthenticated, login } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const accessToken = searchParams.get("access_token")
    const apiOrigin = searchParams.get("api_origin")

    if (apiOrigin) {
      setApiUrlOverride(apiOrigin)
    }

    if (accessToken) {
      login(accessToken)
      navigate("/", { replace: true })
      return
    }

    if (!isAuthReady) {
      return
    }

    if (isAuthenticated) {
      navigate("/", { replace: true })
      return
    }

    setError("Невірна OAuth відповідь. Спробуйте ще раз.")
  }, [isAuthReady, isAuthenticated, login, navigate, searchParams])

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

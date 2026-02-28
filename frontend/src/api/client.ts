const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

const ACCESS_TOKEN_KEY = "accessToken"
const REFRESH_TOKEN_KEY = "refreshToken"

const getToken = () => localStorage.getItem(ACCESS_TOKEN_KEY)
const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY)

const saveTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    return null
  }

  const response = await fetch(`${API_URL}/user/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) {
    clearTokens()
    return null
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token: string
  }

  saveTokens(data.access_token, data.refresh_token)
  return data.access_token
}

export const apiFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const token = getToken()
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  })

  if (response.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      const retry = await fetch(`${API_URL}${path}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
          ...(options?.headers ?? {}),
        },
        ...options,
      })

      const retryData = await retry.json().catch(() => null)
      if (!retry.ok) {
        const detail = retryData?.detail
        if (Array.isArray(detail)) {
          const message = detail
            .map((item) => {
              const path = Array.isArray(item.loc) ? item.loc.join(".") : "error"
              return `${path}: ${item.msg}`
            })
            .join("; ")
          throw new Error(message)
        }
        const message = detail ?? "Request failed"
        throw new Error(message)
      }

      return retryData as T
    }
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = data?.detail
    if (Array.isArray(detail)) {
      const message = detail
        .map((item) => {
          const path = Array.isArray(item.loc) ? item.loc.join(".") : "error"
          return `${path}: ${item.msg}`
        })
        .join("; ")
      throw new Error(message)
    }
    const message = detail ?? "Request failed"
    throw new Error(message)
  }

  return data as T
}

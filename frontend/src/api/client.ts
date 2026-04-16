export const API_URL = import.meta.env.VITE_API_URL ?? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://127.0.0.1:8000' : `${window.location.protocol}//${window.location.hostname}`)

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

const parseErrorDetail = (detail: unknown): string => {
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const path = Array.isArray(item?.loc) ? item.loc.join(".") : "error"
        return `${path}: ${item?.msg ?? "Request failed"}`
      })
      .join("; ")
  }
  if (typeof detail === "string") {
    return detail
  }
  return "Request failed"
}

const buildHeaders = (token: string | null, options?: RequestInit): HeadersInit => {
  const isFormData = options?.body instanceof FormData
  return {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers ?? {}),
  }
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
    headers: buildHeaders(token, options),
    ...options,
  })

  if (response.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      const retry = await fetch(`${API_URL}${path}`, {
        headers: buildHeaders(newToken, options),
        ...options,
      })

      if (retry.status === 204) {
        return null as T
      }
      const retryData = await retry.json().catch(() => null)
      if (!retry.ok) {
        throw new Error(parseErrorDetail(retryData?.detail))
      }

      return retryData as T
    }
  }

  if (response.status === 204) {
    return null as T
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const errorMessage = parseErrorDetail(data?.detail)
    const error = new Error(errorMessage)
    ;(error as Error & { status?: number }).status = response.status
    throw error
  }

  return data as T
}

export const apiFetchBlob = async (path: string, options?: RequestInit): Promise<Blob> => {
  const token = getToken()
  const response = await fetch(`${API_URL}${path}`, {
    headers: buildHeaders(token, options),
    ...options,
  })

  if (response.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      const retry = await fetch(`${API_URL}${path}`, {
        headers: buildHeaders(newToken, options),
        ...options,
      })
      if (!retry.ok) {
        const data = await retry.json().catch(() => null)
        throw new Error(parseErrorDetail(data?.detail))
      }
      return retry.blob()
    }
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(parseErrorDetail(data?.detail))
  }
  return response.blob()
}

const API_URL_OVERRIDE_STORAGE_KEY = "api_url_override"

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(message: string, status: number, detail: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
  }
}

const resolveDefaultApiUrl = (): string => {
  const configured = (import.meta.env.VITE_API_URL ?? "").trim()
  if (configured) {
    return trimTrailingSlash(configured)
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://127.0.0.1:8000"
  }

  return `${window.location.protocol}//${window.location.hostname}`
}

const readStoredApiUrlOverride = (): string | null => {
  try {
    const raw = sessionStorage.getItem(API_URL_OVERRIDE_STORAGE_KEY)
    if (!raw) {
      return null
    }
    return trimTrailingSlash(raw)
  } catch {
    return null
  }
}

export let API_URL = readStoredApiUrlOverride() ?? resolveDefaultApiUrl()

export const setApiUrlOverride = (nextUrl: string | null) => {
  if (!nextUrl) {
    API_URL = resolveDefaultApiUrl()
    try {
      sessionStorage.removeItem(API_URL_OVERRIDE_STORAGE_KEY)
    } catch {
      // ignore storage failures
    }
    return
  }

  const normalized = trimTrailingSlash(nextUrl.trim())
  if (!/^https?:\/\//i.test(normalized)) {
    return
  }

  API_URL = normalized
  try {
    sessionStorage.setItem(API_URL_OVERRIDE_STORAGE_KEY, normalized)
  } catch {
    // ignore storage failures
  }
}

let accessTokenMemory: string | null = null
let refreshInFlight: Promise<string | null> | null = null

export const setAccessToken = (token: string | null) => {
  accessTokenMemory = token
}

export const clearAccessToken = () => {
  accessTokenMemory = null
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
  if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) {
      return message
    }
  }
  if (typeof detail === "string") {
    return detail
  }
  return "Request failed"
}

const buildHeaders = (token: string | null, options?: RequestInit): HeadersInit => {
  const hasBody = options?.body !== undefined && options?.body !== null
  const isFormData = options?.body instanceof FormData
  const isNgrokApi = /https?:\/\/[^/]*ngrok(-free)?\.(app|dev)/i.test(API_URL)
  return {
    ...(isFormData || !hasBody ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isNgrokApi ? { "ngrok-skip-browser-warning": "true" } : {}),
    ...(options?.headers ?? {}),
  }
}

const refreshAccessToken = async () => {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    const response = await fetch(`${API_URL}/user/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as {
      access_token: string
    }

    setAccessToken(data.access_token)
    return data.access_token
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

export const refreshAccessTokenViaCookie = async (): Promise<string> => {
  const token = await refreshAccessToken()
  if (!token) {
    throw new Error("Unauthorized")
  }
  return token
}

export const apiFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const token = accessTokenMemory
  const response = await fetch(`${API_URL}${path}`, {
    headers: buildHeaders(token, options),
    credentials: "include",
    ...options,
  })

  if (response.status === 401 && path !== "/user/refresh") {
    const newToken = await refreshAccessToken()
    if (newToken) {
      const retry = await fetch(`${API_URL}${path}`, {
        headers: buildHeaders(newToken, options),
        credentials: "include",
        ...options,
      })

      if (retry.status === 204) {
        return null as T
      }
      const retryData = await retry.json().catch(() => null)
      if (!retry.ok) {
        throw new ApiError(
          parseErrorDetail(retryData?.detail),
          retry.status,
          retryData?.detail ?? null,
        )
      }

      return retryData as T
    }
  }

  if (response.status === 204) {
    return null as T
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(
      parseErrorDetail(data?.detail),
      response.status,
      data?.detail ?? null,
    )
  }

  return data as T
}

export const apiFetchBlob = async (path: string, options?: RequestInit): Promise<Blob> => {
  const token = accessTokenMemory
  const response = await fetch(`${API_URL}${path}`, {
    headers: buildHeaders(token, options),
    credentials: "include",
    ...options,
  })

  if (response.status === 401 && path !== "/user/refresh") {
    const newToken = await refreshAccessToken()
    if (newToken) {
      const retry = await fetch(`${API_URL}${path}`, {
        headers: buildHeaders(newToken, options),
        credentials: "include",
        ...options,
      })
      if (!retry.ok) {
        const data = await retry.json().catch(() => null)
        throw new ApiError(
          parseErrorDetail(data?.detail),
          retry.status,
          data?.detail ?? null,
        )
      }
      return retry.blob()
    }
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(
      parseErrorDetail(data?.detail),
      response.status,
      data?.detail ?? null,
    )
  }
  return response.blob()
}

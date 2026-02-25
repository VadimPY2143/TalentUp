const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

const getToken = () => localStorage.getItem("accessToken")

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

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = data?.detail ?? "Request failed"
    throw new Error(message)
  }

  return data as T
}

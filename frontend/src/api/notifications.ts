import { API_URL, apiFetch } from "./client"
import type { NotificationListResponse, UnreadCountResponse } from "../types/notification"

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")

export const listNotifications = (limit = 20, cursor?: string | null) => {
  const params = new URLSearchParams()
  params.set("limit", String(limit))
  if (cursor) {
    params.set("cursor", cursor)
  }
  return apiFetch<NotificationListResponse>(`/notifications?${params.toString()}`)
}

export const getUnreadNotificationCount = async (): Promise<number> => {
  const data = await apiFetch<UnreadCountResponse>("/notifications/unread-count")
  return data?.unread_count ?? 0
}

export const markNotificationRead = (id: number) => {
  return apiFetch<void>(`/notifications/${id}/read`, { method: "PATCH" })
}

export const markAllNotificationsRead = () => {
  return apiFetch<void>("/notifications/read-all", { method: "PATCH" })
}

export const buildNotificationsWebSocketUrl = (token: string) => {
  const httpBase = trimTrailingSlash(API_URL)
  const wsBase = httpBase.startsWith("https://")
    ? `wss://${httpBase.slice("https://".length)}`
    : httpBase.startsWith("http://")
      ? `ws://${httpBase.slice("http://".length)}`
      : httpBase
  return `${wsBase}/notifications/ws?token=${encodeURIComponent(token)}`
}


import { useState, useRef, useEffect, useCallback } from "react"
import { Bell, MessageSquare, Briefcase, CheckCircle2 } from "lucide-react"
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  buildNotificationsWebSocketUrl,
} from "../api/notifications"
import { useAuth } from "../auth/useAuth"
import type { Notification } from "../types/notification"
import type { NotificationSocketEvent } from "../types/notification"

const formatTime = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Щойно"
  if (diffMins < 60) return `${diffMins} хв тому`
  if (diffHours < 24) return `${diffHours} год тому`
  if (diffDays < 7) return `${diffDays} дн тому`
  return date.toLocaleDateString("uk-UA")
}

const translateNotification = (notification: Notification) => {
  const translated = { ...notification }

  if (translated.title === "New message") {
    translated.title = "Нове повідомлення"
  } else if (translated.title === "Application status updated") {
    translated.title = "Статус заявки оновлено"
  } else if (translated.title === "Your resume was saved") {
    translated.title = "Ваше резюме збережено"
  }

  if (translated.body) {
    translated.body = translated.body.replace("I applied", "Я подав заявку")
  }

  return translated
}

const NotificationBell = () => {
  const { token } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const cursorRef = useRef<string | null>(null)
  const loadingMoreRef = useRef(false)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  useEffect(() => {
    cursorRef.current = cursor
  }, [cursor])

  useEffect(() => {
    loadingMoreRef.current = loadingMore
  }, [loadingMore])

  const loadNotifications = useCallback(
    async (mode: "initial" | "more" = "initial") => {
      if (mode === "more" && loadingMoreRef.current) return
      
      if (mode === "more") {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      
      setError(null)
      try {
        const data = await listNotifications(10, mode === "more" ? cursorRef.current : null)
        const next = data?.notifications ?? []
        setNotifications((prev) => (mode === "more" ? [...prev, ...next] : next))
        setCursor(data?.next_cursor ?? null)
        setHasMore(Boolean(data?.next_cursor))
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не вдалося завантажити сповіщення")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    loadNotifications()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (!token) return

    const wsUrl = buildNotificationsWebSocketUrl(token)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      // WebSocket connected
    }

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as NotificationSocketEvent
        if (payload?.type === "notification_created" && payload.notification) {
          const incoming = payload.notification as Notification
          setNotifications((prev) => {
            if (prev.some((item) => item.id === incoming.id)) {
              return prev
            }
            return [incoming, ...prev]
          })
          return
        }
        if (payload?.type === "notification_enqueued") {
          void loadNotifications("initial")
        }
      } catch {
        // ignore malformed websocket payloads
      }
    }

    ws.onerror = () => {
      // WebSocket error
    }

    ws.onclose = () => {
      // WebSocket disconnected
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [token, loadNotifications])

  const markAsRead = async (id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)))
    try {
      await markNotificationRead(id)
    } catch {
      // Revert on error
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: false, read_at: null } : n)))
    }
  }

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })))
    try {
      await markAllNotificationsRead()
    } catch {
      // Revert on error
      setNotifications((prev) => prev.map((n) => (n.is_read ? n : { ...n, is_read: false, read_at: null })))
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "message":
        return <MessageSquare className="h-4 w-4 text-blue-400" />
      case "application":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />
      case "vacancy":
        return <Briefcase className="h-4 w-4 text-orange-400" />
      default:
        return <Bell className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 text-white transition hover:border-white/40 hover:bg-white/10"
      >
        <Bell className="h-5 w-5 text-orange-500" fill="currentColor" stroke="currentColor" strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-white/10 bg-gradient-to-b from-[#13244d] to-[#0b1736] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h3 className="font-semibold text-white">Сповіщення</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-orange-400 transition hover:text-orange-300"
              >
                Прочитати все
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {error && (
              <div className="mx-4 mt-4 rounded-xl border border-red-200/50 bg-red-50/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {!notifications.length && !loading && (
              <div className="px-4 py-8 text-center text-sm text-white/60">
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
                Немає сповіщень
              </div>
            )}

            {notifications.map((notification) => {
              const translated = translateNotification(notification)
              return (
                <div
                  key={notification.id}
                  className={`group relative border-b border-white/5 px-4 py-3 transition hover:bg-white/5 ${
                    !notification.is_read ? "bg-white/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="block w-full text-left"
                      >
                        <p className={`text-sm font-medium ${!notification.is_read ? "text-white" : "text-white/80"}`}>
                          {translated.title}
                          {!notification.is_read && (
                            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-orange-500" />
                          )}
                        </p>
                        {translated.body && (
                          <p className="mt-0.5 text-xs text-white/60 line-clamp-2">
                            {translated.body}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-white/40">{formatTime(notification.created_at)}</p>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {hasMore && (
              <div className="px-4 py-3">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => loadNotifications("more")}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-60"
                >
                  {loadingMore ? "Завантаження..." : "Завантажити ще"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell

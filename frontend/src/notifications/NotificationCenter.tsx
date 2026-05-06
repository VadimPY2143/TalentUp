import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { listNotifications, markAllNotificationsRead, markNotificationRead, buildNotificationsWebSocketUrl } from "../api/notifications"
import { useAuth } from "../auth/useAuth"
import type { Notification } from "../types/notification"

const formatTime = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
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

export const NotificationCenter = () => {
  const { token } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items])

  const load = useCallback(
    async (mode: "initial" | "more") => {
      if (loading) return
      setLoading(true)
      setError(null)
      try {
        const data = await listNotifications(20, mode === "more" ? cursor : null)
        const next = data?.notifications ?? []
        setItems((prev) => (mode === "more" ? [...prev, ...next] : next))
        setCursor(data?.next_cursor ?? null)
        setHasMore(Boolean(data?.next_cursor))
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не вдалося завантажити сповіщення")
      } finally {
        setLoading(false)
      }
    },
    [cursor],
  )

  useEffect(() => {
    load("initial")
  }, [load])

  useEffect(() => {
    if (!token) return

    const wsUrl = buildNotificationsWebSocketUrl(token)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log("WebSocket connected for notifications")
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log("Received notification via WebSocket:", data)
        load("initial")
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error)
      }
    }

    ws.onerror = (error) => {
      console.error("WebSocket error:", error)
    }

    ws.onclose = () => {
      console.log("WebSocket disconnected")
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [token, load])

  const onMarkRead = async (id: number) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)))
    try {
      await markNotificationRead(id)
    } catch {
      // revert best-effort
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: false, read_at: null } : n)))
    }
  }

  const onMarkAllRead = async () => {
    const prevUnread = unreadCount
    setItems((prev) => prev.map((n) => (n.is_read ? n : { ...n, is_read: true, read_at: new Date().toISOString() })))
    try {
      await markAllNotificationsRead()
    } catch {
      // revert best-effort
      setItems((prev) => prev.map((n) => (n.is_read && !n.read_at ? { ...n, is_read: false } : n)))
      setError("Не вдалося позначити всі як прочитані")
      // eslint-disable-next-line no-unused-vars
      void prevUnread
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1120px] px-4 py-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Сповіщення</h1>
          <p className="mt-1 text-sm text-slate-600">
            {unreadCount ? `${unreadCount} непрочитаних` : "Всі прочитані"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMarkAllRead}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Позначити всі прочитаними
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {!items.length && !loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
            Поки що немає сповіщень.
          </div>
        )}

        {items.map((n) => {
          const translated = translateNotification(n)
          return (
            <article
              key={n.id}
              className={`rounded-2xl border bg-white p-5 transition ${
                n.is_read ? "border-slate-200" : "border-orange-200 shadow-[0_10px_30px_-20px_rgba(234,88,12,0.55)]"
              }`}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!n.is_read && <span className="h-2 w-2 flex-none rounded-full bg-orange-500" />}
                    <h2 className="truncate text-base font-semibold text-slate-900">{translated.title}</h2>
                  </div>
                  {translated.body && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{translated.body}</p>}
                  <p className="mt-3 text-xs text-slate-500">{formatTime(n.created_at)}</p>
                </div>

                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => onMarkRead(n.id)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Позначити прочитаним
                  </button>
                )}
              </div>
            </article>
          )
        })}

        {hasMore && (
          <div className="pt-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => load("more")}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "Завантаження..." : "Завантажити ще"}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}


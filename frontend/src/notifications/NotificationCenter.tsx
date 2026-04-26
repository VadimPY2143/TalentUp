import { useCallback, useEffect, useMemo, useState } from "react"
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../api/notifications"
import type { Notification } from "../types/notification"

type NotificationCenterProps = {
  embedded?: boolean
  refreshSignal?: number
  onMarkedRead?: (count?: number) => void
  onMarkedAllRead?: (count: number) => void
}

const formatTime = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

export const NotificationCenter = ({
  embedded = false,
  refreshSignal,
  onMarkedRead,
  onMarkedAllRead,
}: NotificationCenterProps) => {
  const [items, setItems] = useState<Notification[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        setError(e instanceof Error ? e.message : "Failed to load notifications")
      } finally {
        setLoading(false)
      }
    },
    [cursor, loading],
  )

  useEffect(() => {
    load("initial")
  }, [load])

  useEffect(() => {
    if (refreshSignal === undefined) {
      return
    }
    load("initial")
  }, [load, refreshSignal])

  const onMarkRead = async (id: number) => {
    const wasUnread = items.find((n) => n.id === id)?.is_read === false
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)),
    )
    try {
      await markNotificationRead(id)
      if (wasUnread) {
        onMarkedRead?.(1)
      }
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
      if (prevUnread) {
        onMarkedAllRead?.(prevUnread)
      }
    } catch {
      // revert best-effort
      setItems((prev) => prev.map((n) => (n.is_read && !n.read_at ? { ...n, is_read: false } : n)))
      setError("Failed to mark all as read")
      // eslint-disable-next-line no-unused-vars
      void prevUnread
    }
  }

  return (
    <section className={embedded ? "flex h-full min-h-0 flex-col" : "mx-auto w-full max-w-[1120px] px-4 py-10"}>
      <div
        className={
          embedded
            ? "flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-soft"
            : "flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
        }
      >
        <div>
          <h1 className={embedded ? "text-sm font-semibold text-slate-900" : "text-2xl font-bold text-slate-900"}>
            Notifications
          </h1>
          <p className={embedded ? "mt-0.5 text-xs text-slate-500" : "mt-1 text-sm text-slate-600"}>
            {unreadCount ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMarkAllRead}
            className={
              embedded
                ? "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                : "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            }
          >
            Mark all read
          </button>
          <button
            type="button"
            onClick={() => load("initial")}
            className={
              embedded
                ? "rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
                : "rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            }
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className={embedded ? "mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" : "mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"}>
          {error}
        </div>
      )}

      <div className={embedded ? "mt-3 min-h-0 flex-1 space-y-3 overflow-auto pr-1" : "mt-6 space-y-3"}>
        {!items.length && !loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
            No notifications yet.
          </div>
        )}

        {items.map((n) => (
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
                  <h2 className="truncate text-base font-semibold text-slate-900">{n.title}</h2>
                </div>
                {n.body && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>}
                <p className="mt-3 text-xs text-slate-500">{formatTime(n.created_at)}</p>
              </div>

              {!n.is_read && (
                <button
                  type="button"
                  onClick={() => onMarkRead(n.id)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Mark read
                </button>
              )}
            </div>
          </article>
        ))}

        {hasMore && (
          <div className="pt-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => load("more")}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

import { useEffect, useRef, useState } from "react"
import { buildNotificationsWebSocketUrl, getUnreadNotificationCount } from "../api/notifications"
import type { NotificationSocketEvent } from "../types/notification"

const POLL_INTERVAL_MS = 25_000

type UnreadNotificationsOptions = {
  onNotificationCreated?: () => void
}

export const useUnreadNotifications = (token: string | null, enabled: boolean, options?: UnreadNotificationsOptions) => {
  const [unreadCount, setUnreadCount] = useState(0)
  const [socketConnected, setSocketConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const pollRef = useRef<number | null>(null)
  const onNotificationCreatedRef = useRef<(() => void) | undefined>(undefined)

  onNotificationCreatedRef.current = options?.onNotificationCreated

  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0)
      setSocketConnected(false)
      return
    }

    let alive = true

    getUnreadNotificationCount()
      .then((count) => {
        if (!alive) return
        setUnreadCount(count)
      })
      .catch(() => {})

    return () => {
      alive = false
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !token) {
      socketRef.current?.close()
      socketRef.current = null
      setSocketConnected(false)
      return
    }

    const ws = new WebSocket(buildNotificationsWebSocketUrl(token))
    socketRef.current = ws

    ws.onopen = () => setSocketConnected(true)
    ws.onclose = () => setSocketConnected(false)
    ws.onerror = () => setSocketConnected(false)
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as NotificationSocketEvent
        if (payload?.type === "notification_created") {
          setUnreadCount((prev) => prev + 1)
          onNotificationCreatedRef.current?.()
        }
      } catch {
        // ignore
      }
    }

    return () => {
      ws.close()
      socketRef.current = null
      setSocketConnected(false)
    }
  }, [enabled, token])

  useEffect(() => {
    if (!enabled) return

    const startPolling = () => {
      if (pollRef.current !== null) return
      pollRef.current = window.setInterval(() => {
        getUnreadNotificationCount()
          .then(setUnreadCount)
          .catch(() => {})
      }, POLL_INTERVAL_MS)
    }

    // Poll always as a fallback if WS isn't connected.
    if (!socketConnected) {
      startPolling()
    } else if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }

    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [enabled, socketConnected])

  const decrementUnread = (amount = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - amount))
  }

  const resetUnread = () => setUnreadCount(0)

  return { unreadCount, setUnreadCount, decrementUnread, resetUnread, socketConnected }
}

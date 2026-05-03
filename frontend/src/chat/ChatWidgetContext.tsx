import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { listMyChats } from "../api/chat"
import { useAuth } from "../auth/useAuth"

export type ChatWidgetOpenArgs = {
  resumeId?: number | null
  vacancyId?: number | null
}

type ChatWidgetContextValue = {
  isOpen: boolean
  open: (args?: ChatWidgetOpenArgs) => void
  close: () => void
  toggle: () => void
  request: ChatWidgetOpenArgs | null
  clearRequest: () => void
  unreadCount: number
  setUnreadCount: (count: number) => void
  refreshUnread: () => void
}

const ChatWidgetContext = createContext<ChatWidgetContextValue | null>(null)

const sumUnread = (items: { unread_count: number }[]) =>
  items.reduce((acc, item) => acc + (Number.isFinite(item.unread_count) ? item.unread_count : 0), 0)

export const ChatWidgetProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [request, setRequest] = useState<ChatWidgetOpenArgs | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  const pollRef = useRef<number | null>(null)

  const refreshUnread = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0)
      return
    }
    try {
      const chats = await listMyChats()
      setUnreadCount(sumUnread(chats))
    } catch {
      // Keep the last known value; widget panel will refresh it when opened.
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0)
      setIsOpen(false)
      setRequest(null)
      if (pollRef.current) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }

    void refreshUnread()
    pollRef.current = window.setInterval(() => void refreshUnread(), 30_000)
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [isAuthenticated, refreshUnread])

  const open = useCallback((args?: ChatWidgetOpenArgs) => {
    setIsOpen(true)
    if (args && (args.resumeId || args.vacancyId)) {
      setRequest({ resumeId: args.resumeId ?? null, vacancyId: args.vacancyId ?? null })
    }
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const clearRequest = useCallback(() => setRequest(null), [])

  const value = useMemo<ChatWidgetContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      request,
      clearRequest,
      unreadCount,
      setUnreadCount,
      refreshUnread,
    }),
    [clearRequest, close, isOpen, open, refreshUnread, request, toggle, unreadCount],
  )

  return <ChatWidgetContext.Provider value={value}>{children}</ChatWidgetContext.Provider>
}

export const useChatWidget = () => {
  const ctx = useContext(ChatWidgetContext)
  if (!ctx) {
    throw new Error("useChatWidget must be used within ChatWidgetProvider")
  }
  return ctx
}


import { createContext, useCallback, useContext, useMemo, useState } from "react"

type NotificationWidgetContextValue = {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  refreshSignal: number
  bumpRefresh: () => void
}

const NotificationWidgetContext = createContext<NotificationWidgetContextValue | null>(null)

export const NotificationWidgetProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])
  const bumpRefresh = useCallback(() => setRefreshSignal((prev) => prev + 1), [])

  const value = useMemo<NotificationWidgetContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      refreshSignal,
      bumpRefresh,
    }),
    [bumpRefresh, close, isOpen, open, refreshSignal, toggle],
  )

  return <NotificationWidgetContext.Provider value={value}>{children}</NotificationWidgetContext.Provider>
}

export const useNotificationWidget = () => {
  const ctx = useContext(NotificationWidgetContext)
  if (!ctx) {
    throw new Error("useNotificationWidget must be used within NotificationWidgetProvider")
  }
  return ctx
}


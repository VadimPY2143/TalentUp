import { createContext, useContext } from "react"
import { useAuth } from "../auth/useAuth"
import { useChatWidget } from "../chat/ChatWidgetContext"
import { useUnreadNotifications } from "./useUnreadNotifications"
import { useNotificationWidget } from "./NotificationWidgetContext"

type UnreadNotificationsContextValue = {
  unreadCount: number
  setUnreadCount: (count: number) => void
  decrementUnread: (amount?: number) => void
  resetUnread: () => void
  socketConnected: boolean
}

const UnreadNotificationsContext = createContext<UnreadNotificationsContextValue | null>(null)

export const UnreadNotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, token } = useAuth()
  const { refreshUnread } = useChatWidget()
  const { bumpRefresh } = useNotificationWidget()

  const { unreadCount, setUnreadCount, decrementUnread, resetUnread, socketConnected } = useUnreadNotifications(
    token,
    isAuthenticated,
    {
      onNotificationCreated: () => {
        bumpRefresh()
        void refreshUnread()
      },
    },
  )

  return (
    <UnreadNotificationsContext.Provider
      value={{
        unreadCount,
        setUnreadCount,
        decrementUnread,
        resetUnread,
        socketConnected,
      }}
    >
      {children}
    </UnreadNotificationsContext.Provider>
  )
}

export const useUnreadNotificationsContext = () => {
  const ctx = useContext(UnreadNotificationsContext)
  if (!ctx) {
    throw new Error("useUnreadNotificationsContext must be used within UnreadNotificationsProvider")
  }
  return ctx
}


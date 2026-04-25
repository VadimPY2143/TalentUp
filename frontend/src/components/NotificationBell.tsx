import { useState, useRef, useEffect } from "react"
import { Bell, CheckCircle2, MessageSquare, Briefcase, X } from "lucide-react"

interface Notification {
  id: string
  type: "message" | "application" | "vacancy" | "system"
  title: string
  message: string
  timestamp: string
  read: boolean
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "message",
    title: "Нове повідомлення",
    message: "Роботодавець переглянув ваше резюме",
    timestamp: "2 хв тому",
    read: false,
  },
  {
    id: "2",
    type: "application",
    title: "Статус заявки змінився",
    message: "Вашу заявку на вакансію Frontend Developer прийнято",
    timestamp: "1 год тому",
    read: false,
  },
  {
    id: "3",
    type: "vacancy",
    title: "Нова вакансія для вас",
    message: "З'явилася нова вакансія Python Developer",
    timestamp: "3 год тому",
    read: true,
  },
]

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const getIcon = (type: Notification["type"]) => {
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
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-white/10 bg-gradient-to-b from-[#13244d] to-[#0b1736] shadow-2xl">
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

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-white/60">
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
                Немає сповіщень
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group relative border-b border-white/5 px-4 py-3 transition hover:bg-white/5 ${
                    !notification.read ? "bg-white/5" : ""
                  }`}
                >
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100"
                  >
                    <X className="h-3 w-3 text-white/40 hover:text-white/80" />
                  </button>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="block w-full text-left"
                      >
                        <p className={`text-sm font-medium ${!notification.read ? "text-white" : "text-white/80"}`}>
                          {notification.title}
                          {!notification.read && (
                            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-orange-500" />
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-white/60 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-xs text-white/40">{notification.timestamp}</p>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-2">
            <button className="w-full text-center text-xs text-white/60 transition hover:text-white/90">
              Переглянути всі сповіщення
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell

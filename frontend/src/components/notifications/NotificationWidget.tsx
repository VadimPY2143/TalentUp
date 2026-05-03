import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { useNotificationWidget } from "../../notifications/NotificationWidgetContext"
import { NotificationCenter } from "../../notifications/NotificationCenter"
import { useUnreadNotificationsContext } from "../../notifications/UnreadNotificationsContext"

const NotificationWidget = () => {
  const { isOpen, close, refreshSignal } = useNotificationWidget()
  const { decrementUnread } = useUnreadNotificationsContext()
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close()
      }
    }

    const onMouseDown = (event: MouseEvent) => {
      const panel = panelRef.current
      if (!panel) {
        return
      }
      if (event.target instanceof Node && !panel.contains(event.target)) {
        close()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("mousedown", onMouseDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("mousedown", onMouseDown)
    }
  }, [close, isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <>
      <div className="fixed inset-0 z-40" aria-hidden="true" />

      <div className="fixed right-4 top-[92px] z-50 w-[min(620px,calc(100vw-2rem))]">
        <div
          ref={panelRef}
          className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b1736] via-[#13244d] to-[#101828] shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Notifications</p>
              <p className="mt-0.5 text-sm font-semibold text-white">Updates</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 text-white/85 transition hover:border-white/25 hover:bg-white/5"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="h-[min(74vh,720px)] bg-[#e9edf4] p-3">
            <NotificationCenter
              embedded
              refreshSignal={refreshSignal}
              onMarkedRead={(count = 1) => decrementUnread(count)}
              onMarkedAllRead={(count) => decrementUnread(count)}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default NotificationWidget


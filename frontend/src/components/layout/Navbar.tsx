import { Bell, MessageSquareText } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../../auth/useAuth"
import logo from "../../assets/talentup-logo.png"
import { useChatWidget } from "../../chat/ChatWidgetContext"
import { useUnreadNotifications } from "../../notifications/useUnreadNotifications"

const Navbar = () => {
  const navigate = useNavigate()
  const { isAuthenticated, role, logout, token } = useAuth()
  const { toggle: toggleChat, unreadCount: unreadChats, refreshUnread } = useChatWidget()
  const { unreadCount } = useUnreadNotifications(token, isAuthenticated, {
    onNotificationCreated: () => void refreshUnread(),
  })

  const primaryButton =
    "inline-flex items-center justify-center rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
  const secondaryButton =
    "inline-flex items-center justify-center rounded-xl bg-[#13244d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f1d3c]"

  const handleLogout = () => {
    logout()
    navigate("/")
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77]">
      <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-cyan-300/15 blur-2xl" />
      <div className="pointer-events-none absolute -right-8 top-0 h-28 w-28 rounded-full bg-orange-400/20 blur-2xl" />

      <div className="relative mx-auto flex h-20 max-w-[1120px] items-center justify-between px-1">
        <Link to="/" className="flex h-full items-center gap-3">
          <img
            src={logo}
            alt="TalentUp"
            className="relative top-3 block h-16 w-auto object-contain md:h-[120px]"
          />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-white/90 md:flex">
          {!isAuthenticated && (
            <>
              <Link className="transition hover:text-orange-300" to="/jobs">
                Р—РЅР°Р№С‚Рё СЂРѕР±РѕС‚Сѓ
              </Link>
              <Link className="transition hover:text-orange-300" to="/register?role=employer">
                Р РѕР·РјС–СЃС‚РёС‚Рё РІР°РєР°РЅСЃС–СЋ
              </Link>
            </>
          )}

          {isAuthenticated && role === "worker" && (
            <>
              <Link className="transition hover:text-orange-300" to="/jobs">
                Р—РЅР°Р№С‚Рё СЂРѕР±РѕС‚Сѓ
              </Link>
              <Link className="hidden transition hover:text-orange-300" to="/messages">
                РџРѕРІС–РґРѕРјР»РµРЅРЅСЏ
              </Link>
            </>
          )}

          {isAuthenticated && role === "employer" && (
            <>
              <Link className="transition hover:text-orange-300" to="/candidates">
                Р‘Р°Р·Р° СЂРµР·СЋРјРµ
              </Link>
              <Link className="transition hover:text-orange-300" to="/payment?return_to=/dashboard">
                РљСѓРїРёС‚Рё РєСЂРµРґРёС‚Рё
              </Link>
              <Link className="hidden transition hover:text-orange-300" to="/messages">
                РџРѕРІС–РґРѕРјР»РµРЅРЅСЏ
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          {isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={toggleChat}
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 text-white transition hover:border-white/40"
                aria-label="Messages"
              >
                <MessageSquareText className="h-5 w-5" />
                {unreadChats > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                    {unreadChats > 99 ? "99+" : unreadChats}
                  </span>
                )}
              </button>

              <Link
                to="/notifications"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 text-white transition hover:border-white/40"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/40"
              >
                РљР°Р±С–РЅРµС‚
              </Link>
              <button className={primaryButton} type="button" onClick={handleLogout}>
                Р’РёР№С‚Рё
              </button>
            </>
          ) : (
            <>
              <Link to="/register" className={primaryButton}>
                Р—Р°СЂРµС”СЃС‚СЂСѓРІР°С‚РёСЃСЏ
              </Link>
              <Link to="/login" className={secondaryButton}>
                РЈРІС–Р№С‚Рё
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar


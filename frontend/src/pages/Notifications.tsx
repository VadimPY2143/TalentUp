import Navbar from "../components/layout/Navbar"
import { NotificationCenter } from "../notifications/NotificationCenter"
import { useUnreadNotificationsContext } from "../notifications/UnreadNotificationsContext"

const Notifications = () => {
  const { decrementUnread } = useUnreadNotificationsContext()

  return (
    <div className="min-h-screen bg-[#e9edf4]">
      <Navbar />
      <NotificationCenter
        onMarkedRead={(count = 1) => decrementUnread(count)}
        onMarkedAllRead={(count) => decrementUnread(count)}
      />
    </div>
  )
}

export default Notifications

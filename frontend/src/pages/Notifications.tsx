import Navbar from "../components/layout/Navbar"
import { NotificationCenter } from "../notifications/NotificationCenter"

const Notifications = () => {
  return (
    <div className="min-h-screen bg-[#e9edf4]">
      <Navbar />
      <NotificationCenter />
    </div>
  )
}

export default Notifications


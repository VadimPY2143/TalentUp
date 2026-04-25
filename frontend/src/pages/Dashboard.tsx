import WorkerProfile from "../components/WorkerProfile"
import { useAuth } from "../auth/useAuth"
import EmployerDashboard from "./EmployerDashboard"
import { useEffect, useState } from "react"
import { getCurrentUser, type UserInfo } from "../api/userProfile"

const Dashboard = () => {
  const { role } = useAuth()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (role && role !== "employer") {
      getCurrentUser()
        .then(setUserInfo)
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [role])

  if (role === "employer") {
    return <EmployerDashboard />
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Завантаження...</div>
  }

  const userEmail = userInfo?.email ?? "user@example.com"
  const userName = userInfo?.username ?? "Користувач"

  return <WorkerProfile userEmail={userEmail} userName={userName} />
}

export default Dashboard

import Navbar from "../components/layout/Navbar"
import AnalyticsDashboard from "../components/analytics/AnalyticsDashboardV2"

const Analytics = () => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(36,59,119,0.10),_transparent_24%),linear-gradient(180deg,#eef3fb_0%,#e9edf4_100%)]">
      <Navbar />
      <AnalyticsDashboard />
    </div>
  )
}

export default Analytics

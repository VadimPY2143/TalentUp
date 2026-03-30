import Navbar from "../components/layout/Navbar"
import { useAuth } from "../auth/useAuth"
import HomeHero from "../components/sections/HomeHero"
import HomeSignals from "../components/sections/HomeSignals"
import HomeHowItWorks from "../components/sections/HomeHowItWorks"
import HomePlatformFeatures from "../components/sections/HomePlatformFeatures"
import HomeFinalCta from "../components/sections/HomeFinalCta"

const Home = () => {
  const { isAuthenticated, role } = useAuth()

  return (
    <div className="min-h-screen bg-[#e9edf4]">
      <Navbar />
      <main>
        <HomeHero isAuthenticated={isAuthenticated} role={role} />
        <HomeSignals />
        <HomeHowItWorks />
        <HomePlatformFeatures />
        <HomeFinalCta isAuthenticated={isAuthenticated} role={role} />
      </main>
    </div>
  )
}

export default Home

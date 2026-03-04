import Navbar from "../components/layout/Navbar"
import Footer from "../components/layout/Footer"
import { useAuth } from "../auth/useAuth"
import Hero from "../components/sections/Hero"
import Categories from "../components/sections/Categories"
import TopFreelancers from "../components/sections/TopFreelancers"
import CallToAction from "../components/sections/CallToAction"

const Home = () => {
  const { isAuthenticated } = useAuth()

  return (
    <div>
      <Navbar />
      <Hero />
      <Categories />
      <TopFreelancers />
      {!isAuthenticated && <CallToAction />}
      <Footer />
    </div>
  )
}

export default Home

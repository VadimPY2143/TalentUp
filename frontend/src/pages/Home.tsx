import Navbar from "../components/layout/Navbar"
import Footer from "../components/layout/Footer"
import { useAuth } from "../auth/useAuth"
import Hero from "../sections/Hero"
import Categories from "../sections/Categories"
import TopFreelancers from "../sections/TopFreelancers"
import CallToAction from "../sections/CallToAction"

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

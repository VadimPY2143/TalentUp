import Navbar from "../components/layout/Navbar"
import Hero from "../sections/Hero"
import Categories from "../sections/Categories"
import TopFreelancers from "../sections/TopFreelancers"
import CallToAction from "../sections/CallToAction"

const Home = () => {
  return (
    <div>
      <Navbar />
      <Hero />
      <Categories />
      <TopFreelancers />
      <CallToAction />
    </div>
  )
}

export default Home

import { Link } from "react-router-dom"
import Navbar from "../components/layout/Navbar"

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-sky-50">
      <Navbar />
      <div className="mx-auto max-w-[1120px] px-4 py-12">
        <div className="rounded-3xl bg-white p-8 shadow-medium">
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Вітаємо в кабінеті
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Тут буде особистий кабінет користувача.
          </p>
          <Link
            className="mt-6 inline-flex rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-2 text-sm font-semibold text-white"
            to="/"
          >
            На головну
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

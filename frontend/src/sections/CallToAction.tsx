import { Link } from "react-router-dom"

const CallToAction = () => {
  return (
    <section className="bg-gradient-to-b from-navy-800 to-navy-900 py-16 text-white">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-6 px-4 text-center md:flex-row md:text-left">
        <h2 className="animate-fade font-display text-2xl font-semibold md:text-3xl">
          Готові почати працювати?
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            className="rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-2.5 text-sm font-semibold text-white"
            to="/register"
          >
            Створити акаунт
          </Link>
          <button
            className="rounded-full border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white"
            type="button"
          >
            Дізнатися більше
          </button>
        </div>
      </div>
    </section>
  )
}

export default CallToAction

import { Link } from "react-router-dom"

const CallToAction = () => {
  return (
    <section className="bg-navy-700 px-4 py-20">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-6 text-center text-white">
        <h2 className="animate-fade font-display text-4xl font-semibold md:text-5xl">
          Готові почати працювати?
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            className="rounded-2xl bg-orange-500 px-8 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
            to="/register"
          >
            Створити акаунт
          </Link>
          <button
            className="rounded-2xl bg-navy-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-navy-800"
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

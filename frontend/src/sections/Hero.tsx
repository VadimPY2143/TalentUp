import { Link } from "react-router-dom"

const Hero = () => {
  return (
    <section className="bg-gradient-to-b from-navy-900 to-navy-700 pb-24 pt-20 text-white">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center px-4 text-center">
        <h1 className="animate-fade-up font-display text-3xl font-semibold md:text-5xl">
          Знайди роботу. Продай навички.
        </h1>
        <p className="animate-fade-up-delay mt-4 max-w-2xl text-base text-white/75 md:text-lg">
          Платформа нового покоління для фрилансерів та бізнесу
        </p>
        <div className="animate-fade-up-delay mt-10 w-full max-w-xl">
          <div className="flex w-full flex-col gap-3 rounded-3xl bg-white p-2 shadow-soft sm:flex-row sm:items-center sm:rounded-full">
            <input
              className="w-full bg-transparent px-4 py-2 text-sm text-slate-700 outline-none"
              placeholder="Наприклад: UI Design, React, Marketing..."
              aria-label="Пошук"
            />
            <button
              className="rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-2 text-sm font-semibold text-white"
              type="button"
            >
              Пошук
            </button>
          </div>
        </div>
        <div className="mt-6 animate-fade">
          <Link
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-soft"
            to="/register"
          >
            Почати зараз
          </Link>
        </div>
      </div>
    </section>
  )
}

export default Hero

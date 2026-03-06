import { Link } from "react-router-dom"

const Hero = () => {
  return (
    <section className="bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] pb-24 pt-20 text-white">
      <div className="mx-auto max-w-[1120px] px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="animate-fade-up font-display text-4xl font-semibold md:text-6xl">
            Знайди роботу. Продай навички.
          </h1>
          <p className="animate-fade-up-delay mt-5 text-base text-white/80 md:text-lg">
            Платформа нового покоління для шукачів роботи та роботодавців
          </p>
          <div className="animate-fade-up-delay mt-10">
            <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3 rounded-2xl bg-white p-2 shadow-soft sm:flex-row sm:items-center sm:rounded-full">
              <input
                className="w-full bg-transparent px-4 py-2 text-sm text-slate-700 placeholder:text-slate-500 outline-none"
                placeholder="Наприклад: UI Design, React, Marketing..."
                aria-label="Пошук"
              />
              <button
                className="rounded-xl bg-orange-500 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 sm:rounded-full"
                type="button"
              >
                Пошук
              </button>
            </div>
          </div>
          <div className="mt-7 animate-fade">
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-8 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
              to="/register"
            >
              Почати зараз
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero

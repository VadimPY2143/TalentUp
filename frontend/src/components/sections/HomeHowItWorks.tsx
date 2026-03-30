import { Link } from "react-router-dom"

const workerSteps = [
  {
    title: "Створіть резюме",
    description: "Заповніть профіль, додайте PDF та позначте активне резюме для роботодавців.",
  },
  {
    title: "Знайдіть вакансії",
    description: "Використовуйте пошук і фільтри за локацією, зарплатою, форматом та досвідом.",
  },
  {
    title: "Відстежуйте відгуки",
    description: "Дивіться статуси заявок і спілкуйтеся з роботодавцем прямо в чаті.",
  },
]

const employerSteps = [
  {
    title: "Створіть компанію",
    description: "Оформіть профіль компанії з контактами та базовою інформацією для кандидатів.",
  },
  {
    title: "Опублікуйте вакансії",
    description: "Створюйте вакансії вручну або за допомогою AI-заповнення чернетки.",
  },
  {
    title: "Працюйте з відгуками",
    description: "Переглядайте резюме, зберігайте кандидатів і починайте діалог у чаті.",
  },
]

const HomeHowItWorks = () => {
  return (
    <section className="bg-[#e9edf4] py-14 md:py-16">
      <div className="mx-auto max-w-[1120px] px-4">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-slate-900 md:text-4xl">
            Два сценарії, одна платформа
          </h2>
          <p className="mt-3 text-sm text-slate-600 md:text-base">
            TalentUp побудований для швидкої взаємодії кандидатів і роботодавців без зайвої
            рутини.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <h3 className="font-display text-xl font-semibold text-slate-900">Для кандидата</h3>
            <div className="mt-4 space-y-4">
              {workerSteps.map((step, index) => (
                <div key={step.title} className="flex gap-3">
                  <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              className="mt-6 inline-flex rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
              to="/jobs"
            >
              Перейти до вакансій
            </Link>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <h3 className="font-display text-xl font-semibold text-slate-900">Для роботодавця</h3>
            <div className="mt-4 space-y-4">
              {employerSteps.map((step, index) => (
                <div key={step.title} className="flex gap-3">
                  <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              className="mt-6 inline-flex rounded-xl bg-[#1f2f5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b294f]"
              to="/register?role=employer"
            >
              Почати найм
            </Link>
          </article>
        </div>
      </div>
    </section>
  )
}

export default HomeHowItWorks

import { Link } from "react-router-dom"

const features = [
  {
    code: "AI",
    title: "AI-вижимка резюме",
    description:
      "Отримуйте короткий підсумок та сильні сторони кандидата перед контактом, щоб пришвидшити відбір.",
    ctaLabel: "Відкрити пошук кандидатів",
    ctaTo: "/candidates",
  },
  {
    code: "CH",
    title: "Вбудований чат",
    description:
      "Починайте діалог між роботодавцем і кандидатом без сторонніх месенджерів та втрати контексту.",
    ctaLabel: "Перейти в повідомлення",
    ctaTo: "/messages",
  },
  {
    code: "TR",
    title: "Трекінг відгуків",
    description:
      "Контролюйте статуси заявок: подано, переглянуто, прийнято або відхилено в кабінеті користувача.",
    ctaLabel: "Подивитись вакансії",
    ctaTo: "/jobs",
  },
]

const HomePlatformFeatures = () => {
  return (
    <section className="bg-[#edf2f8] py-14 md:py-16">
      <div className="mx-auto max-w-[1120px] px-4">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Core features</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-slate-900 md:text-4xl">
            Що дає TalentUp вже зараз
          </h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-soft"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#13244d] text-sm font-semibold text-white">
                {feature.code}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 flex-1 text-sm text-slate-600">{feature.description}</p>
              <Link
                className="mt-5 inline-flex text-sm font-semibold text-orange-600 transition hover:text-orange-700"
                to={feature.ctaTo}
              >
                {feature.ctaLabel}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HomePlatformFeatures

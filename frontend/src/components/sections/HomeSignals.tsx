const signalCards = [
  {
    label: "Швидкість відповіді",
    value: "< 24 год",
    description: "Середній час до першого фідбеку на активні відгуки.",
  },
  {
    label: "Прозорі вакансії",
    value: "81%",
    description: "Частка вакансій з відкритим salary range та форматом роботи.",
  },
  {
    label: "Активні діалоги",
    value: "320+",
    description: "Розпочаті чати роботодавець-кандидат за поточний тиждень.",
  },
]

const HomeSignals = () => {
  return (
    <section className="bg-[#edf2f8] py-12 md:py-14">
      <div className="mx-auto max-w-[1120px] px-4">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-medium md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Market pulse</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900 md:text-3xl">
                Ринок найму в реальному часі
              </h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {signalCards.map((card) => (
              <article
                key={card.label}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {card.label}
                </p>
                <p className="mt-2 font-display text-3xl font-semibold text-slate-900">
                  {card.value}
                </p>
                <p className="mt-2 text-sm text-slate-600">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HomeSignals

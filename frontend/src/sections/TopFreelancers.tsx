import { freelancers } from "../data/freelancers"

const TopFreelancers = () => {
  return (
    <section className="bg-sky-50 pb-20">
      <div className="mx-auto max-w-[1120px] px-4">
        <h2 className="animate-fade text-center font-display text-2xl font-semibold text-slate-900 md:text-3xl">
          Топ фрилансери
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {freelancers.map((freelancer) => (
            <div
              className="rounded-2xl bg-white p-6 text-center shadow-soft"
              key={freelancer.name}
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/15 text-lg font-semibold text-slate-900">
                {freelancer.name[0]}
              </div>
              <div className="text-base font-semibold text-slate-900">
                {freelancer.name}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {freelancer.role}
              </div>
              <div className="mt-3 text-sm font-semibold text-orange-500">
                {freelancer.rate}
              </div>
              <button
                className="mt-4 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-2 text-sm font-semibold text-white"
                type="button"
              >
                Найняти фахівця
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default TopFreelancers

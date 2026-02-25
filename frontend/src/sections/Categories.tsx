import { categories } from "../data/categories"

const Categories = () => {
  return (
    <section className="bg-sky-50 py-20">
      <div className="mx-auto max-w-[1120px] px-4">
        <h2 className="animate-fade text-center font-display text-2xl font-semibold text-slate-900 md:text-3xl">
          Популярні категорії
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {categories.map((category) => (
            <div
              className="rounded-2xl bg-white p-6 shadow-soft"
              key={category.title}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/15 text-sm font-semibold text-orange-500">
                {category.icon}
              </div>
              <div className="mt-4 text-base font-semibold text-slate-900">
                {category.title}
              </div>
              <div className="mt-1 text-sm text-slate-500">{category.count}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Categories

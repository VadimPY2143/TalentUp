import { categories } from "../../data/categories"

const Categories = () => {
  return (
    <section className="bg-[#e9edf4] pb-16 pt-14">
      <div className="mx-auto max-w-[1120px] px-4">
        <h2 className="animate-fade text-center font-display text-3xl font-semibold text-slate-900 md:text-5xl">
          Популярні категорії
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {categories.map((category) => (
            <div
              className="rounded-2xl bg-white p-7 shadow-soft"
              key={category.title}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fde6c9] text-sm font-semibold text-orange-600">
                {category.icon}
              </div>
              <div className="mt-4 text-xl font-semibold text-slate-900">
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

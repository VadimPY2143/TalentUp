import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { getUserProfile, searchLanguages, upsertUserProfile } from "../api/profile"
import type { LanguageOption, UserProfilePayload } from "../types/profile"

interface ProfileFormSource {
  city?: string | null
  education?: string | null
  bio?: string | null
  birth_date?: string | null
  phone?: string | null
  languages?: string[] | null
  links?: string[] | null
}

interface WorkerProfileForm {
  city: string
  education: string
  bio: string
  birth_date: string
  phone: string
  languages: string[]
  links: string[]
}

const emptyProfile: WorkerProfileForm = {
  city: "",
  education: "",
  bio: "",
  birth_date: "",
  phone: "",
  languages: [],
  links: [""],
}

const trimOrNull = (value: string) => {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const normalizeLinkList = (links: string[]) => {
  return links.map((item) => item.trim()).filter(Boolean)
}

const mapProfileToForm = (profile?: ProfileFormSource | null): WorkerProfileForm => {
  const links = profile?.links?.length ? profile.links : [""]

  return {
    city: profile?.city ?? "",
    education: profile?.education ?? "",
    bio: profile?.bio ?? "",
    birth_date: profile?.birth_date ?? "",
    phone: profile?.phone ?? "",
    languages: profile?.languages ?? [],
    links: [...links],
  }
}

const WorkerProfilePanel = () => {
  const [form, setForm] = useState<WorkerProfileForm>(emptyProfile)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [languageQuery, setLanguageQuery] = useState("")
  const [languageSuggestions, setLanguageSuggestions] = useState<LanguageOption[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const deferredLanguageQuery = useDeferredValue(languageQuery)
  const suggestionBoxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadProfile = async () => {
      try {
        setIsLoading(true)
        const profile = await getUserProfile()
        if (!cancelled) {
          setForm(mapProfileToForm(profile))
        }
      } catch (err) {
        if (cancelled) {
          return
        }
        const message = err instanceof Error ? err.message : "Не вдалося завантажити профіль"
        if (message === "Profile not found") {
          setForm(emptyProfile)
          setError(null)
          return
        }
        setError(message)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadSuggestions = async () => {
      try {
        const options = await searchLanguages(deferredLanguageQuery, 10)
        if (!cancelled) {
          setLanguageSuggestions(options)
        }
      } catch {
        if (!cancelled) {
          setLanguageSuggestions([])
        }
      }
    }

    if (!showSuggestions) {
      return () => {
        cancelled = true
      }
    }

    void loadSuggestions()
    return () => {
      cancelled = true
    }
  }, [deferredLanguageQuery, showSuggestions])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionBoxRef.current && !suggestionBoxRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const visibleSuggestions = useMemo(() => {
    const selected = new Set(form.languages.map((item) => item.toLowerCase()))
    return languageSuggestions.filter((item) => !selected.has(item.name.toLowerCase()))
  }, [form.languages, languageSuggestions])

  const setField = <K extends keyof WorkerProfileForm>(field: K, value: WorkerProfileForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const addLanguage = (rawValue: string) => {
    const value = rawValue.trim()
    if (!value) {
      return
    }

    setForm((prev) => {
      const exists = prev.languages.some((item) => item.toLowerCase() === value.toLowerCase())
      if (exists) {
        return prev
      }
      return { ...prev, languages: [...prev.languages, value] }
    })
    setLanguageQuery("")
    setShowSuggestions(false)
  }

  const removeLanguage = (value: string) => {
    setForm((prev) => ({
      ...prev,
      languages: prev.languages.filter((item) => item !== value),
    }))
  }

  const handleLanguageKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      const firstSuggestion = visibleSuggestions.find(
        (item) => item.name.toLowerCase() === languageQuery.trim().toLowerCase(),
      )
      addLanguage(firstSuggestion?.name ?? languageQuery)
    }
  }

  const updateLink = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      links: prev.links.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }))
  }

  const addLinkField = () => {
    setForm((prev) => ({ ...prev, links: [...prev.links, ""] }))
  }

  const removeLinkField = (index: number) => {
    setForm((prev) => {
      const next = prev.links.filter((_, itemIndex) => itemIndex !== index)
      return { ...prev, links: next.length ? next : [""] }
    })
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError(null)
      setSuccessMessage(null)

      const normalizedLinks = normalizeLinkList(form.links)
      const payload: UserProfilePayload = {
        city: trimOrNull(form.city),
        education: trimOrNull(form.education),
        bio: trimOrNull(form.bio),
        birth_date: form.birth_date || null,
        phone: trimOrNull(form.phone),
        languages: [...form.languages],
        links: normalizedLinks,
      }

      const profile = await upsertUserProfile(payload)
      setForm(mapProfileToForm(profile))
      setSuccessMessage("Профіль збережено")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося зберегти профіль"
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 text-slate-900 shadow-medium">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Профіль воркера</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-slate-900">Особисті дані</h2>
          <p className="mt-2 text-sm text-slate-500">
            Мови підтягуються з каталогу, а посилання зберігаються окремими елементами списку.
          </p>
        </div>
        <button
          className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
          type="button"
          onClick={handleSave}
          disabled={isLoading || isSaving}
        >
          {isSaving ? "Збереження..." : "Зберегти профіль"}
        </button>
      </div>

      {isLoading ? (
        <div className="mt-6 text-sm text-slate-500">Завантаження профілю...</div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
              placeholder="Місто"
              value={form.city}
              onChange={(event) => setField("city", event.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
              placeholder="Освіта"
              value={form.education}
              onChange={(event) => setField("education", event.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
              placeholder="Телефон"
              value={form.phone}
              onChange={(event) => setField("phone", event.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-orange-500/60"
              type="date"
              value={form.birth_date}
              onChange={(event) => setField("birth_date", event.target.value)}
            />
          </div>

          <textarea
            className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
            placeholder="Коротко про себе"
            value={form.bio}
            onChange={(event) => setField("bio", event.target.value)}
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2">
                <div className="text-sm font-semibold text-slate-800">Мови</div>
                <div className="text-xs text-slate-500">Почніть вводити назву і додавайте кілька мов через Enter.</div>
              </div>

              <div className="relative" ref={suggestionBoxRef}>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                  placeholder="Наприклад: English, German, Polish"
                  value={languageQuery}
                  onChange={(event) => {
                    setLanguageQuery(event.target.value)
                    setShowSuggestions(true)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={handleLanguageKeyDown}
                />

                {showSuggestions && visibleSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                    {visibleSuggestions.map((option) => (
                      <button
                        key={option.id}
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                        type="button"
                        onClick={() => addLanguage(option.name)}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {form.languages.length > 0 ? (
                  form.languages.map((language) => (
                    <span
                      key={language}
                      className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700"
                    >
                      {language}
                      <button
                        className="text-orange-500 transition hover:text-orange-700"
                        type="button"
                        onClick={() => removeLanguage(language)}
                      >
                        x
                      </button>
                    </span>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">Мови ще не додані.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2">
                <div className="text-sm font-semibold text-slate-800">Посилання</div>
                <div className="text-xs text-slate-500">Кожне посилання зберігається окремим елементом.</div>
              </div>

              <div className="space-y-3">
                {form.links.map((link, index) => (
                  <div key={`link-${index}`} className="flex gap-2">
                    <input
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/60"
                      placeholder="https://linkedin.com/in/username"
                      value={link}
                      onChange={(event) => updateLink(index, event.target.value)}
                    />
                    <button
                      className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-500"
                      type="button"
                      onClick={() => removeLinkField(index)}
                    >
                      Видалити
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-500/60 hover:text-slate-900"
                type="button"
                onClick={addLinkField}
              >
                Додати посилання
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default WorkerProfilePanel

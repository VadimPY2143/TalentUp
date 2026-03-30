import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Briefcase,
  Eye,
  Star,
  EyeOff,
  Mail,
  Settings,
  LogOut,
  User,
  MapPin,
  Phone,
  GraduationCap,
  Calendar,
  Globe,
  FileText,
  Save,
  X,
  ChevronRight,
  FileStack,
  Send,
  Bell,
  BarChart3,
  Camera,
  Home,
} from "lucide-react"
import { useAuth } from "../auth/useAuth"
import {
  getUserProfile,
  updateUserProfile,
  createUserProfile,
  type UserProfile,
  type UserProfileUpdate,
} from "../api/userProfile"

interface WorkerProfileProps {
  userEmail?: string
  userName?: string
}

type Section = "overview" | "resumes" | "applications" | "saved" | "notifications" | "analytics" | "settings" | "profile"

const WorkerProfile = ({ userEmail, userName }: WorkerProfileProps) => {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState<Section>("overview")
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<UserProfileUpdate>({})

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setProfileLoading(true)
      const data = await getUserProfile()
      setProfile(data)
      setFormData({
        city: data.city,
        education: data.education,
        bio: data.bio,
        birth_date: data.birth_date,
        phone: data.phone,
        languages: data.languages,
        links: data.links,
      })
      setProfileError(null)
    } catch (err) {
      // Якщо профіль не знайдено (404), створюємо порожній без помилки
      const errorMsg = err instanceof Error ? err.message.toLowerCase() : ""
      const isNotFound = errorMsg.includes("404") || errorMsg.includes("not found") || errorMsg.includes("не знайдено") || errorMsg.includes("failed to fetch")
      if (isNotFound) {
        try {
          const newProfile = await createUserProfile({})
          setProfile(newProfile)
          setFormData({})
          setProfileError(null)
        } catch {
          // Якщо не вдалося створити, просто показуємо порожню форму
          setProfile({
            id: 0,
            user_id: 0,
            city: null,
            education: null,
            bio: null,
            birth_date: null,
            phone: null,
            languages: null,
            links: null,
            created_at: "",
            updated_at: "",
          })
          setFormData({})
          setProfileError(null)
        }
      } else {
        // Інші помилки теж не показуємо
        setProfileError(null)
      }
    } finally {
      setProfileLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setProfileLoading(true)
      const updated = await updateUserProfile(formData)
      setProfile(updated)
      setIsEditing(false)
      setProfileError(null)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Помилка збереження")
    } finally {
      setProfileLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate("/")
  }

  const menuItems = [
    { id: "overview", label: "Огляд", icon: BarChart3 },
    { id: "resumes", label: "Мої резюме", icon: FileStack },
    { id: "applications", label: "Мої відгуки", icon: Send },
    { id: "saved", label: "Обрані вакансії", icon: Star },
    { id: "notifications", label: "Сповіщення", icon: Bell },
    { id: "analytics", label: "Аналітика", icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-white">Talent</span>
              <span className="text-2xl font-bold text-orange-500">Up</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/80">{userName || "Користувач"}</span>
            <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold">
              {(userName || "U")[0].toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 p-6">
        {/* Sidebar */}
        <aside className="w-72 shrink-0">
          {/* User Card */}
          <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] text-white shadow-lg">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-lg font-bold">
                  {(userName || "U")[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold">{userName || "Користувач"}</h3>
                  <p className="text-xs text-white/60">Шукаю роботу</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-4 rounded-2xl bg-white shadow-medium overflow-hidden">
            <button
              onClick={() => navigate("/")}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-slate-600 transition hover:bg-slate-50 border-l-4 border-transparent"
            >
              <Home className="h-5 w-5" />
              <span className="text-sm font-medium">На головну</span>
              <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
            </button>
            <div className="border-t border-slate-100" />
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as Section)}
                className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50 ${
                  activeSection === item.id
                    ? "border-l-4 border-orange-500 bg-orange-50/50"
                    : "border-l-4 border-transparent"
                }`}
              >
                <item.icon className={`h-5 w-5 ${activeSection === item.id ? "text-orange-500" : "text-slate-500"}`} />
                <span className={`text-sm font-medium ${activeSection === item.id ? "text-slate-900" : "text-slate-600"}`}>
                  {item.label}
                </span>
                <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
              </button>
            ))}
            <div className="border-t border-slate-100" />
            <button
              onClick={() => setActiveSection("profile")}
              className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50 ${
                activeSection === "profile"
                  ? "border-l-4 border-orange-500 bg-orange-50/50"
                  : "border-l-4 border-transparent"
              }`}
            >
              <User className={`h-5 w-5 ${activeSection === "profile" ? "text-orange-500" : "text-slate-500"}`} />
              <span className={`text-sm font-medium ${activeSection === "profile" ? "text-slate-900" : "text-slate-600"}`}>
                Мій профіль
              </span>
              <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
            </button>
            <button
              onClick={() => setActiveSection("settings")}
              className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50 ${
                activeSection === "settings"
                  ? "border-l-4 border-orange-500 bg-orange-50/50"
                  : "border-l-4 border-transparent"
              }`}
            >
              <Settings className={`h-5 w-5 ${activeSection === "settings" ? "text-orange-500" : "text-slate-500"}`} />
              <span className={`text-sm font-medium ${activeSection === "settings" ? "text-slate-900" : "text-slate-600"}`}>
                Налаштування
              </span>
              <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-red-500 transition hover:bg-red-50 border-l-4 border-transparent"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-medium">Вийти з акаунту</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {activeSection === "profile" ? (
            <div className="space-y-6">
              {/* Profile Header */}
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-orange-400/20 blur-2xl" />
                <div className="pointer-events-none absolute -left-8 bottom-0 h-44 w-44 rounded-full bg-cyan-300/20 blur-2xl" />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-5">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-500 text-3xl font-bold shadow-lg">
                        {(userName || "U")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-white/60">Особистий кабінет</p>
                        <h1 className="mt-1 text-3xl font-bold">{userName || "Користувач"}</h1>
                        <p className="mt-2 text-white/70">{userEmail}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
                    >
                      {isEditing ? "Скасувати" : "Редагувати профіль"}
                    </button>
                  </div>
                </div>
              </section>

              {/* Profile Details */}
              <section className="rounded-3xl bg-white p-8 shadow-medium">
                {profileLoading ? (
                  <div className="py-12 text-center text-slate-500">Завантаження...</div>
                ) : (
                  <div className="space-y-6">
                    {/* Contact Info */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
                            <MapPin className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Місто</p>
                            {isEditing ? (
                              <input
                                type="text"
                                value={formData.city || ""}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                                placeholder="Вкажіть місто"
                              />
                            ) : (
                              <p className="font-medium text-slate-900">{profile?.city || "Не вказано"}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
                            <Phone className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Телефон</p>
                            {isEditing ? (
                              <input
                                type="text"
                                value={formData.phone || ""}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                                placeholder="+380..."
                              />
                            ) : (
                              <p className="font-medium text-slate-900">{profile?.phone || "Не вказано"}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
                            <GraduationCap className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Освіта</p>
                            {isEditing ? (
                              <input
                                type="text"
                                value={formData.education || ""}
                                onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                                placeholder="Вкажіть освіту"
                              />
                            ) : (
                              <p className="font-medium text-slate-900">{profile?.education || "Не вказано"}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
                            <Calendar className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Дата народження</p>
                            {isEditing ? (
                              <input
                                type="date"
                                value={formData.birth_date || ""}
                                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                              />
                            ) : (
                              <p className="font-medium text-slate-900">
                                {profile?.birth_date
                                  ? new Date(profile.birth_date).toLocaleDateString("uk-UA")
                                  : "Не вказано"}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    <div className="rounded-2xl bg-slate-50 p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                          <FileText className="h-5 w-5 text-orange-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-slate-500">Про себе</p>
                          {isEditing ? (
                            <textarea
                              value={formData.bio || ""}
                              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none min-h-[100px]"
                              placeholder="Розкажіть про себе..."
                            />
                          ) : (
                            <p className="mt-2 whitespace-pre-wrap text-slate-900">
                              {profile?.bio || "Не вказано"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Languages & Links */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                            <Globe className="h-5 w-5 text-orange-500" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-slate-500">Мови</p>
                            {isEditing ? (
                              <input
                                type="text"
                                value={formData.languages?.join(", ") || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    languages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                                  })
                                }
                                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                                placeholder="Українська, Англійська..."
                              />
                            ) : (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {profile?.languages?.length ? (
                                  profile.languages.map((lang, idx) => (
                                    <span
                                      key={idx}
                                      className="rounded-lg bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm"
                                    >
                                      {lang}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-500">Не вказано</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                            <Globe className="h-5 w-5 text-orange-500" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-slate-500">Посилання</p>
                            {isEditing ? (
                              <input
                                type="text"
                                value={formData.links?.join(", ") || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    links: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                                  })
                                }
                                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                                placeholder="LinkedIn, GitHub, Portfolio..."
                              />
                            ) : (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {profile?.links?.length ? (
                                  profile.links.map((link, idx) => (
                                    <a
                                      key={idx}
                                      href={link.startsWith("http") ? link : `https://${link}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded-lg bg-orange-100 px-3 py-1 text-sm font-medium text-orange-600 hover:bg-orange-200 transition"
                                    >
                                      {link.length > 20 ? link.substring(0, 20) + "..." : link}
                                    </a>
                                  ))
                                ) : (
                                  <span className="text-slate-500">Не вказано</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    {isEditing && (
                      <div className="flex justify-end">
                        <button
                          onClick={handleSave}
                          disabled={profileLoading}
                          className="flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-70"
                        >
                          <Save className="h-4 w-4" />
                          {profileLoading ? "Збереження..." : "Зберегти зміни"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          ) : activeSection === "resumes" ? (
            <div className="space-y-6">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="relative">
                  <h1 className="text-3xl font-bold">Мої резюме</h1>
                  <p className="mt-2 text-white/80">Керуйте своїми резюме та створюйте нові</p>
                </div>
              </section>
              <section className="rounded-3xl bg-white p-8 shadow-medium">
                <p className="text-slate-600">Тут будуть ваші резюме...</p>
              </section>
            </div>
          ) : activeSection === "applications" ? (
            <div className="space-y-6">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="relative">
                  <h1 className="text-3xl font-bold">Мої відгуки</h1>
                  <p className="mt-2 text-white/80">Відстежуйте статус ваших відгуків на вакансії</p>
                </div>
              </section>
              <section className="rounded-3xl bg-white p-8 shadow-medium">
                <p className="text-slate-600">Тут будуть ваші відгуки на вакансії...</p>
              </section>
            </div>
          ) : activeSection === "saved" ? (
            <div className="space-y-6">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="relative">
                  <h1 className="text-3xl font-bold">Обрані вакансії</h1>
                  <p className="mt-2 text-white/80">Вакансії, які ви зберегли для перегляду пізніше</p>
                </div>
              </section>
              <section className="rounded-3xl bg-white p-8 shadow-medium">
                <p className="text-slate-600">Тут будуть ваші збережені вакансії...</p>
              </section>
            </div>
          ) : activeSection === "notifications" ? (
            <div className="space-y-6">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="relative">
                  <h1 className="text-3xl font-bold">Сповіщення</h1>
                  <p className="mt-2 text-white/80">Нові вакансії та відповіді роботодавців</p>
                </div>
              </section>
              <section className="rounded-3xl bg-white p-8 shadow-medium">
                <p className="text-slate-600">Тут будуть ваші сповіщення...</p>
              </section>
            </div>
          ) : activeSection === "analytics" ? (
            <div className="space-y-6">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="relative">
                  <h1 className="text-3xl font-bold">Аналітика</h1>
                  <p className="mt-2 text-white/80">Статистика переглядів профілю та відгуків</p>
                </div>
              </section>
              <section className="rounded-3xl bg-white p-8 shadow-medium">
                <p className="text-slate-600">Тут буде аналітика...</p>
              </section>
            </div>
          ) : activeSection === "settings" ? (
            <div className="space-y-6">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="relative">
                  <h1 className="text-3xl font-bold">Налаштування</h1>
                  <p className="mt-2 text-white/80">Змініть пароль та налаштуйте сповіщення</p>
                </div>
              </section>
              <section className="rounded-3xl bg-white p-8 shadow-medium">
                <p className="text-slate-600">Тут будуть налаштування...</p>
              </section>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview Header */}
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-8 text-white shadow-lg">
                <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-orange-400/20 blur-2xl" />
                <div className="pointer-events-none absolute -left-8 bottom-0 h-44 w-44 rounded-full bg-cyan-300/20 blur-2xl" />
                <div className="relative">
                  <p className="text-xs uppercase tracking-wider text-white/60">Worker workspace</p>
                  <h1 className="mt-2 text-3xl font-bold">Резюме та пошук роботи</h1>
                  <p className="mt-3 max-w-2xl text-white/80">
                    Створіть професійне резюме та знайдіть роботу мрії. Керуйте своїми резюме та відстежуйте відгуки.
                  </p>
                </div>
              </section>

              {/* Resume Banner */}
              <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-amber-100 to-yellow-100 p-8">
                <div className="flex items-center justify-between">
                  <div className="max-w-md">
                    <h3 className="text-lg font-bold text-slate-900">
                      Створіть власне резюме для збільшення шансів знайти ідеальну вакансію
                    </h3>
                    <button className="mt-4 flex items-center gap-2 rounded-full border-2 border-orange-500 bg-white px-6 py-3 text-sm font-semibold text-orange-500 transition hover:bg-orange-500 hover:text-white">
                      <span className="text-lg">+</span>
                      Створити резюме
                    </button>
                  </div>
                  <div className="hidden md:block">
                    {/* Заглушка для ілюстрації */}
                    <div className="flex h-32 w-32 items-center justify-center rounded-full bg-orange-200">
                      <FileText className="h-16 w-16 text-orange-500" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Personal Data Preview */}
              <section className="rounded-3xl bg-white p-8 shadow-medium">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Особисті дані</h2>
                <div className="rounded-2xl bg-slate-50 p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-xl font-bold text-white">
                      {(userName || "U")[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{userName || "Користувач"}</h3>
                      <p className="text-sm text-slate-500">{userEmail}</p>
                    </div>
                    <button
                      onClick={() => setActiveSection("profile")}
                      className="ml-auto rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
                    >
                      Редагувати
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default WorkerProfile

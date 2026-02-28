import { createContext, useEffect, useMemo, useState } from "react"

export type Theme = "light" | "dark"

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const THEME_KEY = "theme"

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === "dark" ? "dark" : "light"
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((prev) => (prev === "light" ? "dark" : "light")),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

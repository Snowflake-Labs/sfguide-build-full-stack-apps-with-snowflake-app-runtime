/*
 * Copyright 2026 Snowflake Inc.
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")

  // Load stored preference on mount
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored)
    }
  }, [])

  // Apply theme class whenever theme changes
  useEffect(() => {
    const root = document.documentElement
    const resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme

    setResolvedTheme(resolved)
    root.classList.toggle("dark", resolved === "dark")
  }, [theme])

  // Keep in sync with OS preference changes when using system theme
  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => {
      const next = e.matches ? "dark" : "light"
      setResolvedTheme(next)
      document.documentElement.classList.toggle("dark", e.matches)
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  function setTheme(next: Theme) {
    setThemeState(next)
    localStorage.setItem("theme", next)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

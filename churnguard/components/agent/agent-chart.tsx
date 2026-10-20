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

import { useEffect, useRef, useState } from "react"
import { useTheme } from "@/components/theme-provider"

/** Renders a Vega-Lite spec from the agent's data_to_chart tool. */
export function AgentChart({ spec }: { spec: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const { theme } = useTheme()

  useEffect(() => {
    let view: { finalize: () => void } | undefined
    let cancelled = false
    ;(async () => {
      try {
        const { default: embed } = await import("vega-embed")
        const parsed = JSON.parse(spec)
        const dark = document.documentElement.classList.contains("dark")
        const result = await embed(ref.current!, { ...parsed, width: "container", autosize: { type: "fit", contains: "padding" } }, {
          actions: false,
          renderer: "svg",
          theme: dark ? "dark" : undefined,
          config: { background: "transparent", range: { category: ["#1E7BC4", "#E5484D", "#F5A524", "#2FA66A", "#8B5CF6"] } },
        })
        if (cancelled) result.finalize()
        else view = result
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to render chart")
      }
    })()
    return () => { cancelled = true; view?.finalize() }
  }, [spec, theme])

  if (error) return <p className="text-xs text-red-600">Chart could not be rendered: {error}</p>
  return <div ref={ref} className="w-full overflow-hidden rounded-md border bg-background p-2" />
}

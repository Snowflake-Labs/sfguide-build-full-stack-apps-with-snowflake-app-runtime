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
import Image from "next/image"
import Link from "next/link"
import { APP_TITLE, LOGO_SRC } from "@/lib/constants"
import { ThemeToggle } from "@/components/theme-toggle"
import { AskButton } from "@/components/agent/ask-button"
import { SuggestedBadge } from "@/components/agent/suggested-badge"

/**
 * AppHeader — top navigation bar.
 * To customize: edit APP_TITLE and LOGO_SRC in lib/constants.ts.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background text-foreground">
      <div className="w-full px-4 h-14 flex items-center gap-3">
        {LOGO_SRC && (
          <Image
            src={LOGO_SRC}
            alt={`${APP_TITLE} logo`}
            width={28}
            height={28}
            className="shrink-0"
          />
        )}
        <span className="text-sm font-semibold tracking-tight">
          {APP_TITLE}
        </span>
        <nav className="ml-6 flex items-center gap-4 text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground">Explorer</Link>
          <Link href="/actions" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">Action Board<SuggestedBadge /></Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <AskButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

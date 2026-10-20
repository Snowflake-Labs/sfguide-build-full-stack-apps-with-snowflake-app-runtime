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

import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useChat } from "@/components/agent/chat-provider"

export function AskButton() {
  const { setOpen } = useChat()
  return (
    <Button size="sm" variant="outline" onClick={() => setOpen(true)} title="Ask ChurnGuard (⌘K)">
      <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
      Ask ChurnGuard
      <kbd className="ml-1 hidden rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:inline">⌘K</kbd>
    </Button>
  )
}

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

import { useEffect, useLayoutEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ArrowUp, Check, Loader2, Plus, Sparkles, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AgentChart } from "@/components/agent/agent-chart"
import { AgentTable } from "@/components/agent/agent-table"
import { useChat, type ChatMessage, type ContentItem } from "@/components/agent/chat-provider"

const MIN_ROWS = 4
const MAX_ROWS = 8

/** Grow the textarea with its content between MIN_ROWS and MAX_ROWS; scroll only beyond MAX_ROWS. */
function fitTextarea(el: HTMLTextAreaElement) {
  const cs = getComputedStyle(el)
  const line = parseFloat(cs.lineHeight) || 20
  const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
  const min = line * MIN_ROWS + pad
  const max = line * MAX_ROWS + pad
  el.style.height = "auto"
  const h = Math.min(max, Math.max(min, el.scrollHeight))
  el.style.height = `${h}px`
  el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden"
}

const SUGGESTIONS: Record<string, string[]> = {
  "/": [
    "Who are the top 5 high-risk customers by spend and what should we do?",
    "Show the monthly churn trend as a chart",
    "Break down churn risk by credit rating",
    "Which high-risk customers have no open action?",
  ],
  "/actions": [
    "Summarize open retention actions and escalations",
    "Flag high-risk customers for retention",
    "Which high-risk customers still have no open action?",
    "What does the retention playbook recommend for high return rates?",
  ],
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="agent-md text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}

function Item({ item, onClose }: { item: ContentItem; onClose: () => void }) {
  switch (item.kind) {
    case "text":
      return <Markdown text={item.text} />
    case "table":
      return <AgentTable title={item.title} data={item.data} />
    case "chart":
      return <AgentChart spec={item.spec} />
    case "staged":
      return (
        <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
          <span className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
            <Check className="h-4 w-4" aria-hidden="true" />
            {item.count != null ? `${item.count} proposal${item.count === 1 ? "" : "s"} staged for review` : item.message}
          </span>
          <Link href="/actions?tab=suggested" onClick={onClose} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
            Review in Agent Suggested
          </Link>
        </div>
      )
  }
}

function Loading({ m }: { m: ChatMessage }) {
  const steps = m.status ?? []
  return (
    <div className="space-y-2">
      {m.thinking && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
          </span>
          Thinking…
        </div>
      )}
      {steps.length > 0 && (
        <ol className="space-y-1 text-xs text-muted-foreground">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              {i === steps.length - 1 && m.streaming
                ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                : <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />}
              {s}
            </li>
          ))}
        </ol>
      )}
      {!(m.items?.length) && m.streaming && (
        <div className="space-y-2" aria-hidden="true">
          <div className="shimmer h-3 w-11/12 rounded" />
          <div className="shimmer h-3 w-4/5 rounded" />
          <div className="shimmer h-3 w-2/3 rounded" />
        </div>
      )}
    </div>
  )
}

function Message({ m, onClose }: { m: ChatMessage; onClose: () => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">{m.text}</div>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {(m.streaming || m.thinking) && <Loading m={m} />}
      {m.items?.map((it, i) => <Item key={i} item={it} onClose={onClose} />)}
      {m.error && <p className="text-sm text-red-600">{m.error}</p>}
    </div>
  )
}

export function ChatDrawer() {
  const { open, setOpen, messages, busy, draft, setDraft, send, stop, newConversation } = useChat()
  const pathname = usePathname()
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const suggestions = SUGGESTIONS[pathname] ?? SUGGESTIONS["/"]
  const close = () => setOpen(false)

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 50)
  }, [open, draft])

  useLayoutEffect(() => {
    if (input.current) fitTextarea(input.current)
  }, [draft, open])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages])

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/20 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-label="ChurnGuard assistant"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-[65] flex w-full max-w-xl flex-col border-l bg-background shadow-2xl transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold">Ask ChurnGuard</span>
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={newConversation} disabled={!messages.length} title="New conversation">
              <Plus className="h-4 w-4" aria-hidden="true" /> New conversation
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={close} title="Close (Esc)" aria-label="Close">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </header>

        <div ref={scroller} className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="space-y-4 pt-6">
              <div>
                <p className="text-sm font-medium">How can I help with retention?</p>
                <p className="text-xs text-muted-foreground">Answers come from churn data and the retention playbook. Staged proposals need your approval.</p>
              </div>
              <div className="grid gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-lg border bg-card px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <Message key={m.id} m={m} onClose={close} />)
          )}
        </div>

        <form
          className="border-t p-3"
          onSubmit={(e) => { e.preventDefault(); send(draft) }}
        >
          <div className="flex items-end gap-2 rounded-xl border bg-card p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
            <textarea
              ref={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft) } }}
              rows={MIN_ROWS}
              placeholder="Ask about customers, churn, or next steps…"
              aria-label="Message"
              className="flex-1 resize-none overflow-hidden bg-transparent px-1 py-1 text-sm leading-5 outline-none placeholder:text-muted-foreground"
            />
            {busy ? (
              <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={stop} title="Stop" aria-label="Stop">
                <Square className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            ) : (
              <Button type="submit" size="icon" className="h-8 w-8" disabled={!draft.trim()} title="Send" aria-label="Send">
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">Enter to send · Shift+Enter for a new line · ⌘K to toggle</p>
        </form>
      </aside>
    </>
  )
}

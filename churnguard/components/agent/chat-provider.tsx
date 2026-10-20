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

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

export type TableData = { columns: string[]; rows: unknown[][] }
export type ContentItem =
  | { kind: "text"; text: string }
  | { kind: "table"; title?: string; data: TableData }
  | { kind: "chart"; spec: string }
  | { kind: "staged"; count: number | null; message: string }

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text?: string
  items?: ContentItem[]
  status?: string[]
  thinking?: boolean
  streaming?: boolean
  error?: string
}

type ChatState = {
  open: boolean
  setOpen: (v: boolean) => void
  messages: ChatMessage[]
  busy: boolean
  draft: string
  setDraft: (v: string) => void
  /** Open the drawer with a pre-filled prompt (user reviews, then sends). */
  prefill: (text: string) => void
  send: (text: string) => Promise<void>
  stop: () => void
  newConversation: () => void
}

const ChatContext = createContext<ChatState | null>(null)
const STORAGE_KEY = "churnguard.chat.v1"

type Persisted = { threadId: number | null; parentMessageId: number; messages: ChatMessage[] }

function load(): Persisted {
  if (typeof window === "undefined") return { threadId: null, parentMessageId: 0, messages: [] }
  try {
    const p = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "") as Persisted
    return { ...p, messages: p.messages.map((m) => ({ ...m, streaming: false, thinking: false })) }
  } catch {
    return { threadId: null, parentMessageId: 0, messages: [] }
  }
}

/** Convert a Snowflake result_set (rowType + data) into columns/rows. */
function toTable(resultSet: Record<string, unknown> | undefined): TableData {
  const meta = (resultSet?.resultSetMetaData ?? {}) as { rowType?: { name: string }[] }
  return { columns: (meta.rowType ?? []).map((c) => c.name), rows: (resultSet?.data as unknown[][]) ?? [] }
}

function stagedFrom(content: unknown): ContentItem {
  const text = JSON.stringify(content ?? "")
  const m = text.match(/(\d+)\s+proposals?\s+staged/i)
  return { kind: "staged", count: m ? Number(m[1]) : null, message: m ? m[0] : "Proposals staged" }
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const thread = useRef<{ threadId: number | null; parentMessageId: number }>({ threadId: null, parentMessageId: 0 })
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    const p = load()
    thread.current = { threadId: p.threadId, parentMessageId: p.parentMessageId }
    setMessages(p.messages)
  }, [])

  useEffect(() => {
    if (busy) return
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...thread.current, messages }))
  }, [messages, busy])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const patchLast = useCallback((fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((ms) => ms.map((m, i) => (i === ms.length - 1 ? fn(m) : m)))
  }, [])

  const send = useCallback(async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setDraft("")
    setBusy(true)
    const now = Date.now()
    setMessages((ms) => [
      ...ms,
      { id: `u${now}`, role: "user", text },
      { id: `a${now}`, role: "assistant", items: [], status: [], thinking: true, streaming: true },
    ])
    const controller = new AbortController()
    abort.current = controller
    const items = new Map<number, ContentItem>()
    let stagingToolId: string | null = null
    const flush = () => patchLast((m) => ({ ...m, items: [...items.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v) }))

    try {
      if (!thread.current.threadId) {
        const r = await fetch("/api/agent/threads", { method: "POST" })
        const b = await r.json()
        if (!r.ok) throw new Error(b.error ?? "Failed to start conversation")
        thread.current = { threadId: b.threadId, parentMessageId: 0 }
      }
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...thread.current, message: text }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? "Agent request failed")

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buf = ""
      let extra = 1000 // indexes for items that don't carry content_index
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += value
        let sep: number
        while ((sep = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, sep)
          buf = buf.slice(sep + 2)
          let event = "message"
          let data = ""
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim()
            else if (line.startsWith("data:")) data += line.slice(5).trim()
          }
          if (!data) continue
          let d: Record<string, any>
          try { d = JSON.parse(data) } catch { continue }
          const idx = typeof d.content_index === "number" ? d.content_index : extra++

          switch (event) {
            case "response.status":
              if (d.message) patchLast((m) => (m.status?.at(-1) === d.message ? m : { ...m, status: [...(m.status ?? []), d.message] }))
              break
            case "response.thinking.delta":
              patchLast((m) => (m.thinking ? m : { ...m, thinking: true }))
              break
            case "response.text.delta": {
              const cur = items.get(idx)
              items.set(idx, { kind: "text", text: (cur?.kind === "text" ? cur.text : "") + (d.text ?? "") })
              patchLast((m) => ({ ...m, thinking: false }))
              flush()
              break
            }
            case "response.table":
              items.set(idx, { kind: "table", title: d.title, data: toTable(d.result_set) })
              flush()
              break
            case "response.chart":
              if (d.chart_spec) { items.set(idx, { kind: "chart", spec: d.chart_spec }); flush() }
              break
            case "response.tool_use":
              if (d.name === "stage_retention_actions") stagingToolId = d.tool_use_id
              break
            case "response.tool_result":
              if (d.name === "stage_retention_actions" || (stagingToolId && d.tool_use_id === stagingToolId)) {
                items.set(idx, stagedFrom(d.content))
                flush()
                qc.invalidateQueries({ queryKey: ["proposals"] })
              }
              break
            case "metadata":
              if (d.metadata?.role === "assistant" && d.metadata.message_id) thread.current.parentMessageId = Number(d.metadata.message_id)
              break
            case "response":
              // Final aggregate: only used as a fallback if no text streamed.
              if (![...items.values()].some((i) => i.kind === "text")) {
                const texts = ((d.content ?? []) as { type: string; text?: string }[]).filter((c) => c.type === "text" && c.text)
                texts.forEach((c, i) => items.set(10_000 + i, { kind: "text", text: c.text! }))
                if (texts.length) flush()
              }
              break
            case "error":
              throw new Error(d.message ?? "Agent error")
          }
        }
      }
      patchLast((m) => ({ ...m, thinking: false, streaming: false }))
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError"
      patchLast((m) => ({ ...m, thinking: false, streaming: false, error: aborted ? "Stopped." : e instanceof Error ? e.message : "Agent request failed" }))
    } finally {
      abort.current = null
      setBusy(false)
    }
  }, [busy, patchLast, qc])

  const stop = useCallback(() => abort.current?.abort(), [])
  const newConversation = useCallback(() => {
    abort.current?.abort()
    thread.current = { threadId: null, parentMessageId: 0 }
    setMessages([])
    setDraft("")
    sessionStorage.removeItem(STORAGE_KEY)
  }, [])
  const prefill = useCallback((text: string) => { setDraft(text); setOpen(true) }, [])

  return (
    <ChatContext.Provider value={{ open, setOpen, messages, busy, draft, setDraft, prefill, send, stop, newConversation }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat(): ChatState {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error("useChat must be used inside ChatProvider")
  return ctx
}

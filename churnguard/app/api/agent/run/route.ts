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
import { runAgent } from "@/lib/agent"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const b = await req.json()
    const threadId = Number(b.threadId)
    const parentMessageId = Number(b.parentMessageId ?? 0)
    const message = String(b.message ?? "").trim().slice(0, 4000)
    if (!Number.isInteger(threadId) || threadId <= 0) return Response.json({ error: "threadId is required" }, { status: 400 })
    if (!Number.isInteger(parentMessageId) || parentMessageId < 0) return Response.json({ error: "Invalid parentMessageId" }, { status: 400 })
    if (!message) return Response.json({ error: "Message is required" }, { status: 400 })

    const upstream = await runAgent(threadId, parentMessageId, message, req.signal)
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text()
      console.error(new Date().toISOString(), "[agent:run] upstream", upstream.status, text.slice(0, 500))
      let msg = `Agent request failed (${upstream.status})`
      try { msg = JSON.parse(text).message ?? msg } catch { /* not JSON */ }
      return Response.json({ error: msg }, { status: 502 })
    }
    return new Response(upstream.body, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
    })
  } catch (e) {
    console.error(new Date().toISOString(), "[agent:run]", e)
    return Response.json({ error: e instanceof Error ? e.message : "Agent request failed" }, { status: 500 })
  }
}

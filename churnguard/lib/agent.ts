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
import { getRestApiAuthHeader, getSnowflakeBaseUrl } from "@/lib/snowflake"

const AGENT_PATH = "/api/v2/databases/SFQUICKSTART_CHURNGUARD/schemas/PUBLIC/agents/CHURNGUARD_AGENT:run"

function headers(accept = "application/json"): HeadersInit {
  return {
    Authorization: getRestApiAuthHeader(),
    "X-Snowflake-Authorization-Token-Type": "OAUTH",
    "Content-Type": "application/json",
    Accept: accept,
  }
}

function baseUrl(): string {
  const url = getSnowflakeBaseUrl()
  if (!url) throw new Error("Snowflake account URL is not configured")
  return url
}

export async function createThread(): Promise<number> {
  const res = await fetch(`${baseUrl()}/api/v2/cortex/threads`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ origin_application: "churnguard" }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.message ?? `Failed to create thread (${res.status})`)
  return Number(body.thread_id)
}

/** Starts a streaming agent run; returns the upstream SSE response. */
export async function runAgent(threadId: number, parentMessageId: number, text: string, signal?: AbortSignal) {
  return fetch(`${baseUrl()}${AGENT_PATH}`, {
    method: "POST",
    headers: headers("text/event-stream"),
    signal,
    body: JSON.stringify({
      thread_id: threadId,
      parent_message_id: parentMessageId,
      messages: [{ role: "user", content: [{ type: "text", text }] }],
    }),
  })
}

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
import { createThread } from "@/lib/agent"
export const dynamic = "force-dynamic"

export async function POST() {
  try {
    return Response.json({ threadId: await createThread() })
  } catch (e) {
    console.error(new Date().toISOString(), "[agent:thread]", e)
    return Response.json({ error: e instanceof Error ? e.message : "Failed to create thread" }, { status: 500 })
  }
}

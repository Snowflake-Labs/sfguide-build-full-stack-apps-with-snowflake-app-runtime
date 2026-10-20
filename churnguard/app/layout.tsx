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
import type { Metadata } from "next"
import type React from "react"
import { AppHeader } from "@/components/app-header"
import { ThemeProvider } from "@/components/theme-provider"
import { QueryProvider } from "@/components/query-provider"
import { NotificationToaster } from "@/components/notification-toaster"
import { ChatProvider } from "@/components/agent/chat-provider"
import { ChatDrawer } from "@/components/agent/chat-drawer"
import { APP_TITLE, LOGO_SRC } from "@/lib/constants"
import "./globals.css"

export const metadata: Metadata = {
  title: APP_TITLE,
  description: "Customer churn risk dashboard for retention teams",
  icons: { icon: LOGO_SRC },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <QueryProvider>
            <ChatProvider>
              <AppHeader />
              {children}
              <NotificationToaster />
              <ChatDrawer />
            </ChatProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

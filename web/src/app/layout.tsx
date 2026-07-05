import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "@/components/Sidebar"

export const metadata: Metadata = {
  title: "InnoMate — AI Super Agent",
  description: "LG이노텍 G-portal AI Super Agent 포털"
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="flex h-screen p-3 gap-3">
          <Sidebar />
          <main className="flex-1 min-w-0 h-full">{children}</main>
        </div>
      </body>
    </html>
  )
}

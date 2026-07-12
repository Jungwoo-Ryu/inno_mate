#!/usr/bin/env node
import { config as loadEnv } from "dotenv"
import { Command } from "commander"
import path from "node:path"
import fs from "node:fs"

// 루트 .env 우선
loadEnv({ path: path.resolve(__dirname, "../../.env") })
loadEnv()

const WEB_URL = (process.env.INNOMATE_WEB_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
)

const program = new Command()
program
  .name("innomate")
  .description("InnoMate CLI — 웹 레지스트리 기반 Super Agent")
  .version("1.0.0")

program
  .command("agents")
  .description("웹에 등록된 활성 에이전트 목록")
  .action(async () => {
    const res = await fetch(`${WEB_URL}/api/agents?enabled=true`)
    if (!res.ok) {
      console.error(`Registry error (${res.status}). Is web running at ${WEB_URL}?`)
      process.exit(1)
    }
    const agents = (await res.json()) as Array<{
      id: string
      name: string
      runtime: string
      endpointUrl?: string
    }>
    if (!agents.length) {
      console.log("활성 에이전트가 없습니다.")
      return
    }
    for (const a of agents) {
      console.log(
        `- ${a.id.padEnd(16)} ${a.name}  [${a.runtime}]${
          a.endpointUrl ? ` → ${a.endpointUrl}` : ""
        }`
      )
    }
  })

program
  .command("run")
  .description("프롬프트로 Super Agent 실행 (웹 /api/chat)")
  .argument("<prompt>", "사용자 요청")
  .option("-i, --image <path>", "스크린샷/이미지 파일 경로")
  .option("-a, --agent <id>", "에이전트 ID", "super")
  .action(async (prompt: string, opts: { image?: string; agent: string }) => {
    const attachments: Array<Record<string, unknown>> = []
    if (opts.image) {
      const abs = path.resolve(opts.image)
      if (!fs.existsSync(abs)) {
        console.error(`파일을 찾을 수 없습니다: ${abs}`)
        process.exit(1)
      }
      const buf = fs.readFileSync(abs)
      const b64 = buf.toString("base64")
      const ext = path.extname(abs).toLowerCase()
      const mime =
        ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : "image/png"
      attachments.push({
        name: path.basename(abs),
        mimeType: mime,
        size: buf.length,
        kind: "image",
        content: `data:${mime};base64,${b64}`
      })
    }

    process.stdout.write("→ Super Agent…\n\n")
    const res = await fetch(`${WEB_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: opts.agent,
        message: prompt,
        attachments
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error("실패:", (err as { error?: string }).error || res.status)
      process.exit(1)
    }

    const sessionId = res.headers.get("X-Session-Id")
    const reader = res.body?.getReader()
    if (!reader) {
      console.error("응답 스트림 없음")
      process.exit(1)
    }
    const decoder = new TextDecoder()
    let buffer = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data:"))
        if (!line) continue
        const raw = line.replace(/^data:\s*/, "").trim()
        if (!raw) continue
        try {
          const event = JSON.parse(raw) as {
            type: string
            text?: string
            message?: string
            event?: { type: string; message_ko?: string; nodeId?: string }
            status?: string
            runId?: string
          }
          if (event.type === "token" && event.text) {
            process.stdout.write(event.text)
          } else if (event.type === "workflow" && event.event) {
            const we = event.event
            if (we.type === "node_started") {
              process.stderr.write(`\n[workflow] → ${we.nodeId}\n`)
            }
            if (we.type === "run_paused") {
              process.stderr.write(
                `\n[paused] ${(we as { message_ko?: string }).message_ko || ""}\n`
              )
              process.stderr.write(`resume: innomate resume ${event.runId || ""} -f key=value\n`)
            }
            if (we.type === "run_completed") {
              process.stderr.write(`\n[done] ${(we as { result?: { message_ko: string } }).result?.message_ko || ""}\n`)
            }
          } else if (event.type === "error") {
            console.error("\n오류:", event.message)
          } else if (event.type === "done" && event.runId) {
            process.stderr.write(`\n(run: ${event.runId}, status: ${event.status})\n`)
          }
        } catch {
          process.stdout.write(raw)
        }
      }
    }
    process.stdout.write("\n")
    if (sessionId) console.error(`(session: ${sessionId})`)
  })

program
  .command("resume")
  .description("일시 중지된 run 재개 (HITL)")
  .argument("<runId>", "run ID")
  .option(
    "-f, --field <key=value>",
    "누락 필드 (반복 가능)",
    (v: string, prev: string[]) => {
      prev.push(v)
      return prev
    },
    [] as string[]
  )
  .action(async (runId: string, opts: { field: string[] }) => {
    const fields: Record<string, string> = {}
    for (const pair of opts.field) {
      const i = pair.indexOf("=")
      if (i < 0) continue
      fields[pair.slice(0, i)] = pair.slice(i + 1)
    }
    const res = await fetch(`${WEB_URL}/api/runs/${runId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error("실패:", (err as { error?: string }).error || res.status)
      process.exit(1)
    }
    const data = await res.json()
    console.log(JSON.stringify(data, null, 2))
  })

program.parseAsync(process.argv).catch((err) => {
  console.error(err)
  process.exit(1)
})

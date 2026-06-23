import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import dotenv from "dotenv"
import { ENV, type APIProviderEnv } from "./envConfig"

const isDev = process.env.NODE_ENV === "development"

function formatEnvValue(value: string): string {
  if (/[\s#'"]/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
  }
  return value
}

function upsertEnvFile(filePath: string, entries: Record<string, string>): void {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : ""

  for (const [key, rawValue] of Object.entries(entries)) {
    const line = `${key}=${formatEnvValue(rawValue)}`
    const regex = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=.*$`, "m")

    if (regex.test(content)) {
      content = content.replace(regex, line)
    } else {
      if (content.length > 0 && !content.endsWith("\n")) {
        content += "\n"
      }
      content += `${line}\n`
    }
  }

  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filePath, content)
}

export function getEnvLoadPaths(userDataPath?: string): string[] {
  const paths: string[] = []

  if (isDev) {
    paths.push(path.join(process.cwd(), ".env"))
  }
  if (userDataPath) {
    paths.push(path.join(userDataPath, ".env"))
  }
  if (!isDev) {
    paths.push(path.join(process.resourcesPath, ".env"))
  }

  return paths
}

export function getWritableEnvPaths(): string[] {
  const paths: string[] = []

  try {
    paths.push(path.join(app.getPath("userData"), ".env"))
  } catch {
    // app not ready
  }

  if (isDev) {
    paths.push(path.join(process.cwd(), ".env"))
  }

  return [...new Set(paths)]
}

export function loadEnvVariables(userDataPath?: string): void {
  for (const envPath of getEnvLoadPaths(userDataPath)) {
    if (fs.existsSync(envPath)) {
      console.log("Loading env from:", envPath)
      dotenv.config({ path: envPath, override: true })
    }
  }
}

function resolveUserDataPath(): string | undefined {
  try {
    return app.getPath("userData")
  } catch {
    return undefined
  }
}

export function reloadEnvVariables(userDataPath?: string): void {
  loadEnvVariables(userDataPath ?? resolveUserDataPath())
}

function apiKeyEnvName(provider: APIProviderEnv): string {
  switch (provider) {
    case "openai":
      return ENV.OPENAI_API_KEY
    case "gemini":
      return ENV.GEMINI_API_KEY
    case "anthropic":
      return ENV.ANTHROPIC_API_KEY
  }
}

export function saveApiCredentialsToEnvFiles(
  apiKey: string,
  provider: APIProviderEnv,
  agentModel?: string
): string[] {
  const entries: Record<string, string> = {
    [apiKeyEnvName(provider)]: apiKey,
    [ENV.INNOMATE_API_PROVIDER]: provider
  }

  if (agentModel?.trim()) {
    entries[ENV.INNOMATE_AGENT_MODEL] = agentModel.trim()
  }

  const written: string[] = []
  for (const envPath of getWritableEnvPaths()) {
    upsertEnvFile(envPath, entries)
    written.push(envPath)
    console.log("Saved API credentials to:", envPath)
  }

  reloadEnvVariables(resolveUserDataPath())
  return written
}

export function saveGportalToEnvFiles(
  gportalUrl: string,
  gportalUsername: string,
  gportalPassword?: string
): string[] {
  const entries: Record<string, string> = {
    [ENV.GPORTAL_URL]: gportalUrl,
    [ENV.GPORTAL_USERNAME]: gportalUsername
  }

  if (gportalPassword?.trim()) {
    entries[ENV.GPORTAL_PASSWORD] = gportalPassword.trim()
  }

  const written: string[] = []
  for (const envPath of getWritableEnvPaths()) {
    upsertEnvFile(envPath, entries)
    written.push(envPath)
  }

  reloadEnvVariables(resolveUserDataPath())
  return written
}

/**
 * Environment variable keys for InnoMate.
 * API 키는 .env, 하드코딩, config.json 순으로 해석됩니다.
 * UI에서 저장하면 로컬 .env 파일에 기록됩니다.
 */
export const ENV = {
  OPENAI_API_KEY: "OPENAI_API_KEY",
  OPENAI_BASE_URL: "OPENAI_BASE_URL",
  GEMINI_API_KEY: "GEMINI_API_KEY",
  ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY",
  INNOMATE_API_PROVIDER: "INNOMATE_API_PROVIDER",
  GPORTAL_URL: "GPORTAL_URL",
  GPORTAL_USERNAME: "GPORTAL_USERNAME",
  GPORTAL_PASSWORD: "GPORTAL_PASSWORD",
  GPORTAL_ADAPTER: "GPORTAL_ADAPTER",
  GPORTAL_API_BASE_URL: "GPORTAL_API_BASE_URL",
  INNOMATE_AGENT_MODEL: "INNOMATE_AGENT_MODEL",
  GH_TOKEN: "GH_TOKEN"
} as const

export type APIProviderEnv = "openai" | "gemini" | "anthropic"

export interface EnvOverrides {
  apiKey?: string
  apiProvider?: APIProviderEnv
  gportalUrl?: string
  gportalUsername?: string
  gportalPassword?: string
  agentModel?: string
}

/**
 * 개발용 하드코딩 fallback.
 * 커밋하지 않을 키를 여기에 넣거나, 빈 채로 두고 .env / UI 입력을 사용하세요.
 */
export const HARDCODED_SECRETS: EnvOverrides = {
  // apiKey: "your-api-key",
  // apiProvider: "gemini",
}

export function readHardcodedSecrets(): EnvOverrides {
  const out: EnvOverrides = {}
  const key = HARDCODED_SECRETS.apiKey?.trim()
  if (key) {
    out.apiKey = key
    out.apiProvider = HARDCODED_SECRETS.apiProvider
  }
  if (HARDCODED_SECRETS.gportalUrl?.trim()) {
    out.gportalUrl = HARDCODED_SECRETS.gportalUrl.trim()
  }
  if (HARDCODED_SECRETS.gportalUsername?.trim()) {
    out.gportalUsername = HARDCODED_SECRETS.gportalUsername.trim()
  }
  if (HARDCODED_SECRETS.gportalPassword?.trim()) {
    out.gportalPassword = HARDCODED_SECRETS.gportalPassword.trim()
  }
  if (HARDCODED_SECRETS.agentModel?.trim()) {
    out.agentModel = HARDCODED_SECRETS.agentModel.trim()
  }
  return out
}

function parseProvider(value: string | undefined): APIProviderEnv | undefined {
  if (value === "gemini" || value === "anthropic" || value === "openai") {
    return value
  }
  return undefined
}

export function readEnvOverrides(): EnvOverrides {
  const overrides: EnvOverrides = {}

  const geminiKey = process.env[ENV.GEMINI_API_KEY]?.trim()
  const openaiKey = process.env[ENV.OPENAI_API_KEY]?.trim()
  const anthropicKey = process.env[ENV.ANTHROPIC_API_KEY]?.trim()
  const envProvider = parseProvider(
    process.env[ENV.INNOMATE_API_PROVIDER]?.trim().toLowerCase()
  )

  if (envProvider === "openai" && openaiKey) {
    overrides.apiKey = openaiKey
    overrides.apiProvider = "openai"
  } else if (envProvider === "gemini" && geminiKey) {
    overrides.apiKey = geminiKey
    overrides.apiProvider = "gemini"
  } else if (envProvider === "anthropic" && anthropicKey) {
    overrides.apiKey = anthropicKey
    overrides.apiProvider = "anthropic"
  } else if (geminiKey) {
    overrides.apiKey = geminiKey
    overrides.apiProvider = "gemini"
  } else if (openaiKey) {
    overrides.apiKey = openaiKey
    overrides.apiProvider = "openai"
  } else if (anthropicKey) {
    overrides.apiKey = anthropicKey
    overrides.apiProvider = "anthropic"
  }

  if (envProvider) {
    overrides.apiProvider = envProvider
  }

  const gportalUrl = process.env[ENV.GPORTAL_URL]?.trim()
  if (gportalUrl) overrides.gportalUrl = gportalUrl

  const gportalUsername = process.env[ENV.GPORTAL_USERNAME]?.trim()
  if (gportalUsername) overrides.gportalUsername = gportalUsername

  const gportalPassword = process.env[ENV.GPORTAL_PASSWORD]?.trim()
  if (gportalPassword) overrides.gportalPassword = gportalPassword

  const agentModel = process.env[ENV.INNOMATE_AGENT_MODEL]?.trim()
  if (agentModel) overrides.agentModel = agentModel

  return overrides
}

/** 사내 OpenAI 게이트웨이 URL (.env OPENAI_BASE_URL). 없으면 undefined → 공식 API */
export function getOpenAIBaseUrl(): string | undefined {
  const url = process.env[ENV.OPENAI_BASE_URL]?.trim()
  return url ? url.replace(/\/$/, "") : undefined
}

export function hasEnvApiKey(): boolean {
  return Boolean(
    process.env[ENV.GEMINI_API_KEY]?.trim() ||
      process.env[ENV.OPENAI_API_KEY]?.trim() ||
      process.env[ENV.ANTHROPIC_API_KEY]?.trim()
  )
}

export function hasHardcodedApiKey(): boolean {
  return Boolean(HARDCODED_SECRETS.apiKey?.trim())
}

export function hasEnvGportalConfig(): boolean {
  return Boolean(
    process.env[ENV.GPORTAL_URL]?.trim() &&
      process.env[ENV.GPORTAL_USERNAME]?.trim() &&
      process.env[ENV.GPORTAL_PASSWORD]?.trim()
  )
}

export function getEnvSourceLabels(): string[] {
  const labels: string[] = []
  if (process.env[ENV.GEMINI_API_KEY]?.trim()) labels.push("GEMINI_API_KEY")
  if (process.env[ENV.OPENAI_API_KEY]?.trim()) labels.push("OPENAI_API_KEY")
  if (process.env[ENV.ANTHROPIC_API_KEY]?.trim()) labels.push("ANTHROPIC_API_KEY")
  if (process.env[ENV.INNOMATE_API_PROVIDER]?.trim()) labels.push("INNOMATE_API_PROVIDER")
  if (process.env[ENV.GPORTAL_URL]?.trim()) labels.push("GPORTAL_URL")
  if (process.env[ENV.GPORTAL_USERNAME]?.trim()) labels.push("GPORTAL_USERNAME")
  if (process.env[ENV.GPORTAL_PASSWORD]?.trim()) labels.push("GPORTAL_PASSWORD")
  if (process.env[ENV.INNOMATE_AGENT_MODEL]?.trim()) labels.push("INNOMATE_AGENT_MODEL")
  return labels
}

export type ApiKeySource = "env" | "hardcoded" | "config" | null

export function resolveApiKeySource(): ApiKeySource {
  if (hasEnvApiKey()) return "env"
  if (hasHardcodedApiKey()) return "hardcoded"
  return null
}

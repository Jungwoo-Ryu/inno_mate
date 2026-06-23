/**
 * Environment variable keys for InnoMate.
 * Copy `.env.example` to `.env` and fill in values.
 * Env vars take precedence over config.json / UI settings.
 */
export const ENV = {
  OPENAI_API_KEY: "OPENAI_API_KEY",
  GPORTAL_URL: "GPORTAL_URL",
  GPORTAL_USERNAME: "GPORTAL_USERNAME",
  GPORTAL_PASSWORD: "GPORTAL_PASSWORD",
  GPORTAL_ADAPTER: "GPORTAL_ADAPTER",
  GPORTAL_API_BASE_URL: "GPORTAL_API_BASE_URL",
  INNOMATE_AGENT_MODEL: "INNOMATE_AGENT_MODEL",
  GH_TOKEN: "GH_TOKEN"
} as const

export interface EnvOverrides {
  apiKey?: string
  gportalUrl?: string
  gportalUsername?: string
  gportalPassword?: string
  agentModel?: string
}

export function readEnvOverrides(): EnvOverrides {
  const overrides: EnvOverrides = {}

  const apiKey = process.env[ENV.OPENAI_API_KEY]?.trim()
  if (apiKey) overrides.apiKey = apiKey

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

export function hasEnvApiKey(): boolean {
  return Boolean(process.env[ENV.OPENAI_API_KEY]?.trim())
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
  if (hasEnvApiKey()) labels.push("OPENAI_API_KEY")
  if (process.env[ENV.GPORTAL_URL]?.trim()) labels.push("GPORTAL_URL")
  if (process.env[ENV.GPORTAL_USERNAME]?.trim()) labels.push("GPORTAL_USERNAME")
  if (process.env[ENV.GPORTAL_PASSWORD]?.trim()) labels.push("GPORTAL_PASSWORD")
  if (process.env[ENV.INNOMATE_AGENT_MODEL]?.trim()) labels.push("INNOMATE_AGENT_MODEL")
  return labels
}

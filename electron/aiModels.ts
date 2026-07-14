export type APIProvider = "openai" | "azure" | "anthropic"

export type AIModelOption = {
  id: string
  name: string
  description: string
}

export const OPENAI_MODELS: AIModelOption[] = [
  { id: "gpt-5.5", name: "GPT-5.5", description: "최신 플래그십 — 복잡한 추론·에이전트 작업" },
  { id: "gpt-5.4", name: "GPT-5.4", description: "고성능 범용 모델" },
  { id: "gpt-5.4-mini", name: "GPT-5.4 Mini", description: "빠르고 비용 효율적" },
  { id: "gpt-5.4-nano", name: "GPT-5.4 Nano", description: "최저 비용 · 경량 작업" },
  { id: "gpt-5", name: "GPT-5", description: "이전 세대 추론 모델" },
  { id: "gpt-4o", name: "GPT-4o", description: "레거시 멀티모달 모델" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "레거시 경량 모델" }
]

/** Azure는 deployment 이름을 model로 사용 — 예시 값 */
export const AZURE_MODELS: AIModelOption[] = [
  { id: "gpt-5.5", name: "gpt-5.5 (deployment)", description: "Azure 배포 이름 예시" },
  { id: "gpt-4o", name: "gpt-4o (deployment)", description: "Azure 배포 이름 예시" },
  { id: "gpt-4o-mini", name: "gpt-4o-mini (deployment)", description: "Azure 배포 이름 예시" }
]

export const ANTHROPIC_MODELS: AIModelOption[] = [
  { id: "claude-opus-4-8", name: "Claude Opus 4.8", description: "최고 성능 Opus — 복잡한 추론" },
  { id: "claude-opus-4-7", name: "Claude Opus 4.7", description: "에이전트 코딩 · SWE-bench 최적" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "속도·성능 균형 (권장)" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", description: "최고속 · 분류/추출용" },
  { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", description: "레거시 Sonnet" }
]

export const ALLOWED_MODELS: Record<APIProvider, string[]> = {
  openai: OPENAI_MODELS.map((m) => m.id),
  azure: AZURE_MODELS.map((m) => m.id),
  anthropic: ANTHROPIC_MODELS.map((m) => m.id)
}

export const DEFAULT_MODELS: Record<
  APIProvider,
  { extraction: string; solution: string; debugging: string; agent: string; classifier: string }
> = {
  openai: {
    extraction: "gpt-5.4-mini",
    solution: "gpt-5.5",
    debugging: "gpt-5.5",
    agent: "gpt-5.5",
    classifier: "gpt-5.4-mini"
  },
  azure: {
    extraction: "gpt-4o-mini",
    solution: "gpt-4o",
    debugging: "gpt-4o",
    agent: "gpt-4o",
    classifier: "gpt-4o-mini"
  },
  anthropic: {
    extraction: "claude-haiku-4-5",
    solution: "claude-sonnet-4-6",
    debugging: "claude-sonnet-4-6",
    agent: "claude-sonnet-4-6",
    classifier: "claude-haiku-4-5"
  }
}

export const DEFAULT_AZURE_API_VERSION = "2024-10-21"

export function sanitizeModelSelection(
  model: string,
  provider: APIProvider,
  role: "extraction" | "solution" | "debugging" | "agent" = "solution"
): string {
  const trimmed = model?.trim()
  if (!trimmed) return DEFAULT_MODELS[provider][role]

  // Azure deployment 이름은 자유 형식
  if (provider === "azure") return trimmed

  if (ALLOWED_MODELS[provider].includes(trimmed)) {
    return trimmed
  }
  const fallback = DEFAULT_MODELS[provider][role]
  console.warn(`Invalid ${provider} model '${model}'. Using ${fallback}.`)
  return fallback
}

export function getDefaultModelsForProvider(provider: APIProvider) {
  return DEFAULT_MODELS[provider]
}

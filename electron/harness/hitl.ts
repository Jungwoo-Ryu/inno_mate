export type FieldType = "string" | "date" | "enum" | "number"

export interface InputField {
  key: string
  label: string
  type: FieldType
  required: boolean
  enumValues?: string[]
  extractHints?: string[]
}

export interface InputSchema {
  fields: InputField[]
}

export function missingRequiredFields(
  schema: InputSchema | undefined,
  collected: Record<string, unknown>
): InputField[] {
  const fields = schema?.fields ?? []
  return fields.filter((f) => {
    if (!f.required) return false
    const v = collected[f.key]
    return v === undefined || v === null || String(v).trim() === ""
  })
}

/** LLM이 string[]로 준 missingFields를 스키마 정의로 승격 */
export function resolveMissingFieldDefs(
  schema: InputSchema | undefined,
  missing: string[] | InputField[] | undefined
): InputField[] {
  if (!missing?.length) return []
  if (typeof missing[0] !== "string") {
    return missing as InputField[]
  }
  const keys = missing as string[]
  const byKey = new Map((schema?.fields ?? []).map((f) => [f.key, f]))
  return keys.map(
    (key) =>
      byKey.get(key) ?? {
        key,
        label: key,
        type: "string" as const,
        required: true
      }
  )
}

export function formatMissingMessage(fields: InputField[]): string {
  if (!fields.length) return "추가 정보가 필요합니다."
  return `다음 정보가 필요합니다: ${fields.map((f) => f.label).join(", ")}`
}

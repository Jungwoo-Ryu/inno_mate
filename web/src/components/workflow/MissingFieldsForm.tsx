"use client"

import { useState } from "react"
import type { InputField } from "@/lib/types"

export default function MissingFieldsForm({
  fields,
  initial,
  onSubmit,
  submitting
}: {
  fields: InputField[]
  initial?: Record<string, unknown>
  onSubmit: (values: Record<string, string>) => void
  submitting?: boolean
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    for (const f of fields) {
      v[f.key] = initial?.[f.key] != null ? String(initial[f.key]) : ""
    }
    return v
  })

  return (
    <form
      className="mt-3 space-y-2.5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(values)
      }}
    >
      <p className="text-[12px] font-medium text-amber-200/90">
        누락된 정보를 입력해 주세요
      </p>
      {fields.map((f) => (
        <label key={f.key} className="block">
          <span className="mb-1 block text-[11px] text-white/55">{f.label}</span>
          {f.type === "enum" && f.enumValues?.length ? (
            <select
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              className="glass-input w-full"
              required={f.required}
            >
              <option value="">선택</option>
              {f.enumValues.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              className="glass-input w-full"
              required={f.required}
            />
          )}
        </label>
      ))}
      <button
        type="submit"
        disabled={submitting}
        className="glass-button-primary w-full disabled:opacity-40"
      >
        {submitting ? "재개 중…" : "입력하고 계속"}
      </button>
    </form>
  )
}

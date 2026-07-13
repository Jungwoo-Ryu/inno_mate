import React, { useState } from "react"
import type { InputField } from "../../types/chat"

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
      className="mt-2 space-y-2 rounded-xl border border-amber-400/25 bg-amber-400/5 p-2.5"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(values)
      }}
    >
      <p className="text-[11px] font-medium text-amber-200/90">
        누락된 정보를 입력해 주세요
      </p>
      {fields.map((f) => (
        <label key={f.key} className="block">
          <span className="mb-0.5 block text-[10px] text-white/50">{f.label}</span>
          {f.type === "enum" && f.enumValues?.length ? (
            <select
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] text-white/90 outline-none focus:border-white/25"
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
              type={
                f.type === "date" ? "date" : f.type === "number" ? "number" : "text"
              }
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] text-white/90 outline-none focus:border-white/25"
              required={f.required}
            />
          )}
        </label>
      ))}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-amber-400/20 py-1.5 text-[11px] font-medium text-amber-100 hover:bg-amber-400/30 disabled:opacity-40"
      >
        {submitting ? "재개 중…" : "입력하고 계속"}
      </button>
    </form>
  )
}

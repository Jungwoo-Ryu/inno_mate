import fs from "node:fs"
import path from "node:path"

const TEXT_EXT = new Set([".txt", ".md", ".csv", ".json", ".xml", ".html", ".log"])
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"])

export interface AttachmentMeta {
  path: string
  name: string
  size: number
  mimeType: string
  kind: "text" | "image" | "other"
  preview?: string
}

export interface AttachmentPayload {
  name: string
  mimeType: string
  kind: "text" | "image" | "other"
  content: string
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".json": "application/json",
    ".csv": "text/csv"
  }
  return map[ext] ?? "application/octet-stream"
}

export function getAttachmentMeta(filePath: string): AttachmentMeta | null {
  try {
    if (!fs.existsSync(filePath)) return null
    const stat = fs.statSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const name = path.basename(filePath)
    const mimeType = mimeFromExt(ext)
    let kind: AttachmentMeta["kind"] = "other"
    if (TEXT_EXT.has(ext)) kind = "text"
    else if (IMAGE_EXT.has(ext)) kind = "image"

    const meta: AttachmentMeta = {
      path: filePath,
      name,
      size: stat.size,
      mimeType,
      kind
    }

    if (kind === "image" && stat.size <= 5 * 1024 * 1024) {
      const data = fs.readFileSync(filePath).toString("base64")
      meta.preview = `data:${mimeType};base64,${data}`
    }

    return meta
  } catch {
    return null
  }
}

export function loadAttachmentPayload(filePath: string): AttachmentPayload | null {
  const meta = getAttachmentMeta(filePath)
  if (!meta) return null

  try {
    if (meta.kind === "text") {
      const content = fs.readFileSync(filePath, "utf8").slice(0, 32_000)
      return { name: meta.name, mimeType: meta.mimeType, kind: "text", content }
    }
    if (meta.kind === "image") {
      const content = fs.readFileSync(filePath).toString("base64")
      return { name: meta.name, mimeType: meta.mimeType, kind: "image", content }
    }
    return {
      name: meta.name,
      mimeType: meta.mimeType,
      kind: "other",
      content: `[첨부 파일: ${meta.name} (${meta.mimeType}, ${meta.size} bytes)]`
    }
  } catch {
    return null
  }
}

export function loadAttachments(filePaths: string[]): AttachmentPayload[] {
  return filePaths
    .map(loadAttachmentPayload)
    .filter((a): a is AttachmentPayload => a !== null)
}

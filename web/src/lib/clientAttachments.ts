import type { ChatAttachment } from "./types"

const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8MB

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "yaml", "yml", "xml", "html",
  "css", "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "h", "cs", "go",
  "rs", "rb", "php", "sh", "sql", "log", "ini", "toml", "env", "properties"
])

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".")
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ""
}

function isTextLike(file: File): boolean {
  if (file.type.startsWith("text/")) return true
  if (
    file.type === "application/json" ||
    file.type === "application/xml" ||
    file.type === "application/x-yaml"
  ) {
    return true
  }
  return TEXT_EXTENSIONS.has(extensionOf(file.name))
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * 브라우저에서 파일을 ChatAttachment로 변환.
 * - 이미지: base64 data URL (vision 입력)
 * - 텍스트류: 본문 인라인
 * - 그 외(pdf, xlsx 등): 메타데이터만 전달
 */
export async function fileToAttachment(file: File): Promise<ChatAttachment> {
  const base = {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size
  }

  if (file.size > MAX_FILE_BYTES) {
    return { ...base, kind: "binary" }
  }

  if (file.type.startsWith("image/")) {
    return { ...base, kind: "image", content: await readAsDataUrl(file) }
  }

  if (isTextLike(file)) {
    return { ...base, kind: "text", content: await readAsText(file) }
  }

  return { ...base, kind: "binary" }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

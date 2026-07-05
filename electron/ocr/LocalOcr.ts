import fs from "node:fs"
import path from "node:path"
import { app, nativeImage } from "electron"
import { createWorker, PSM, type Worker } from "tesseract.js"

let sharedWorker: Worker | null = null

/** Vite 번들 후에도 node_modules 기준으로 worker 경로를 찾도록 고정 */
function getTesseractOptions() {
  const pkgRoot = path.dirname(require.resolve("tesseract.js/package.json"))
  return {
    workerPath: path.join(pkgRoot, "src/worker-script/node/index.js"),
    // 한국어 traineddata를 userData에 캐시 (최초 1회 다운로드)
    cachePath: path.join(app.getPath("userData"), "tesseract-cache"),
    logger: (msg: { status?: string; progress?: number }) => {
      if (msg.status === "recognizing text") {
        console.log(`[OCR] ${Math.round((msg.progress ?? 0) * 100)}%`)
      } else if (msg.status === "loading language traineddata") {
        console.log(`[OCR] 언어 데이터 로딩 ${Math.round((msg.progress ?? 0) * 100)}%`)
      }
    }
  }
}

/** UI 스크린샷용 — 작은 한글 글자 인식을 위해 업스케일 */
function prepareImageForOcr(filePath: string): Buffer {
  const img = nativeImage.createFromPath(filePath)
  if (img.isEmpty()) {
    return fs.readFileSync(filePath)
  }

  const { width, height } = img.getSize()
  // 해상도가 낮으면 2배 확대 (한글 획 인식률 향상)
  const minWidth = 1920
  if (width >= minWidth) {
    return fs.readFileSync(filePath)
  }

  const scale = Math.min(2, minWidth / width)
  const upscaled = img.resize({
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    quality: "best"
  })
  console.log(
    `[OCR] Image upscale ${width}x${height} → ${Math.round(width * scale)}x${Math.round(height * scale)}`
  )
  return upscaled.toPNG()
}

async function getWorker(): Promise<Worker> {
  if (sharedWorker) return sharedWorker

  // kor 우선 + eng (UI에 영문·숫자 혼재)
  const worker = await createWorker("kor+eng", 1, getTesseractOptions())

  await worker.setParameters({
    // UI 스크린샷: 자동 레이아웃 분석 (기본 SINGLE_BLOCK보다 한글 UI에 유리)
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300"
  })

  sharedWorker = worker
  return worker
}

export async function terminateOcrWorker(): Promise<void> {
  if (sharedWorker) {
    await sharedWorker.terminate()
    sharedWorker = null
  }
}

export async function extractTextFromScreenshotPaths(
  paths: string[]
): Promise<string> {
  if (paths.length === 0) {
    return "(OCR: 스크린샷이 없습니다)"
  }

  const worker = await getWorker()
  const sections: string[] = []

  for (let i = 0; i < paths.length; i++) {
    const filePath = paths[i]
    console.log(`[OCR] Processing: ${filePath}`)
    const imageBuffer = prepareImageForOcr(filePath)
    const {
      data: { text }
    } = await worker.recognize(imageBuffer, { rotateAuto: true })
    const trimmed = text.trim()
    if (trimmed) {
      sections.push(
        paths.length > 1 ? `[스크린샷 ${i + 1}]\n${trimmed}` : trimmed
      )
    }
  }

  if (sections.length === 0) {
    return "(OCR: 화면에서 텍스트를 찾지 못했습니다)"
  }

  return sections.join("\n\n")
}

/** PoC: 스크린샷 실행 시 LLM 대신 로컬 OCR만 사용 (기본 활성) */
export function isPocOcrMode(): boolean {
  const value = process.env.INNOMATE_POC_OCR?.trim().toLowerCase()
  if (value === "0" || value === "false" || value === "off" || value === "no") {
    return false
  }
  return true
}

import Store from "electron-store"
import type { McpServerConfig } from "./mcp/McpStore"

interface StoreSchema {
  mcpServers?: McpServerConfig[]
}

// ConfigHelper도 userData/config.json을 쓰므로 파일명을 분리한다.
// (encryptionKey 사용 시 electron-store가 config.json을 바이너리로 덮어써 LLM 설정을 깨뜨림)
const store = new Store<StoreSchema>({
  name: "mcp-store",
  defaults: {},
  clearInvalidConfig: true
}) as Store<StoreSchema> & {
  store: StoreSchema
  get: <K extends keyof StoreSchema>(key: K) => StoreSchema[K]
  set: <K extends keyof StoreSchema>(key: K, value: StoreSchema[K]) => void
}

export { store }

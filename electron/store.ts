import Store from "electron-store"
import type { McpServerConfig } from "./mcp/McpStore"

interface StoreSchema {
  mcpServers?: McpServerConfig[]
}

const store = new Store<StoreSchema>({
  defaults: {},
  encryptionKey: "your-encryption-key"
}) as Store<StoreSchema> & {
  store: StoreSchema
  get: <K extends keyof StoreSchema>(key: K) => StoreSchema[K]
  set: <K extends keyof StoreSchema>(key: K, value: StoreSchema[K]) => void
}

export { store }

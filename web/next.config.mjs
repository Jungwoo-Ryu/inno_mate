import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingRoot: __dirname
}

export default nextConfig

import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Apple SD Gothic Neo",
          "Pretendard",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
}

export default config

import {defineConfig} from "vitest/config"
export default defineConfig({test:{environment:"edge-runtime",include:["__tests__/convex/**/*.test.ts"]}})
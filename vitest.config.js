import path from 'path'
import { loadEnv } from 'payload/node'
import { fileURLToPath } from 'url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default defineConfig(() => {
  loadEnv(path.resolve(dirname, './dev'))

  return {
    plugins: [
      tsconfigPaths({
        ignoreConfigErrors: true,
      }),
    ],
    test: {
      exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'dev/e2e.spec.ts'],
      environment: 'node',
      hookTimeout: 30_000,
      testTimeout: 30_000,
    },
  }
})

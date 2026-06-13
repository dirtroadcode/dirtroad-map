import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['**/.direnv/**', '**/node_modules/**'],
  },
})

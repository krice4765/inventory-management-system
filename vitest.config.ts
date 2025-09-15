/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
    exclude: ['**/node_modules/**', '**/tests/e2e/**'], // E2Eテストを除外
    // グローバル変数の定義
    define: {
      global: 'globalThis',
    },
  },
})
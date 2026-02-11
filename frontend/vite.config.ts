import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Node.js 内置模块在浏览器环境中的 shim
      'node:async_hooks': path.resolve(__dirname, './src/lib/async-local-storage-shim.ts'),
    },
  },
  // 预留 Tauri 环境支持
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      // Tauri 插件在运行时加载，构建时不打包
      external: ['@tauri-apps/plugin-dialog'],
      output: {
        manualChunks: {
          // AI 模块独立打包，按需加载
          'ai-langchain': ['langchain', '@langchain/core', '@langchain/openai', '@langchain/anthropic'],
          // 图表库独立打包
          'vendor-echarts': ['echarts', 'echarts-for-react'],
        },
      },
    },
  },
})

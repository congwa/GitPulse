/// <reference types="vite/client" />

interface Window {
  /** Tauri 运行时内部 API，仅在 Tauri webview 环境中存在 */
  __TAURI_INTERNALS__?: unknown
}

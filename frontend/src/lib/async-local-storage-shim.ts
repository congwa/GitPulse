/**
 * Browser shim for node:async_hooks AsyncLocalStorage
 *
 * @langchain/langgraph 依赖 Node.js 的 AsyncLocalStorage。
 * 在浏览器环境中不可用，提供一个无操作实现。
 */

export class AsyncLocalStorage<T> {
  private _store: T | undefined

  getStore(): T | undefined {
    return this._store
  }

  run<R>(store: T, callback: () => R): R {
    const prev = this._store
    this._store = store
    try {
      return callback()
    } finally {
      this._store = prev
    }
  }

  enterWith(store: T): void {
    this._store = store
  }

  disable(): void {
    this._store = undefined
  }
}

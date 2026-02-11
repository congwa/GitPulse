/**
 * AbortSignal.any() polyfill
 *
 * Safari 17.4 之前的版本不支持 AbortSignal.any()，
 * 但 LangChain SDK 会使用这个 API，所以需要 polyfill。
 */

if (typeof AbortSignal !== 'undefined' && !('any' in AbortSignal)) {
  // @ts-expect-error - Polyfilling AbortSignal.any
  AbortSignal.any = function (signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController()

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason)
        return controller.signal
      }

      signal.addEventListener(
        'abort',
        () => controller.abort(signal.reason),
        { once: true }
      )
    }

    return controller.signal
  }

  console.log('[Polyfill] AbortSignal.any() polyfilled for browser compatibility')
}

export {}

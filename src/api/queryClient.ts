import { QueryClient } from '@tanstack/vue-query'
import { CanvasError } from './canvas'

export const FIVE_MINUTES_MS = 5 * 60 * 1000

/**
 * Fail-fast retry guard. The spec'd no-retry case: an expired/invalid token
 * (401/403) — the redirect to reconnect has already fired inside
 * canvasFetch, so extra attempts would only hammer Canvas with a known-bad
 * token. Everything else also fails fast, because the uncached canvas layer
 * never retried and views must keep behaving exactly as today
 * (rejections surface immediately; Canvas API failures are deterministic).
 */
export function canvasQueryRetry(
  failureCount: number,
  error: unknown,
): boolean {
  const isAuthFailure =
    error instanceof CanvasError &&
    (error.status === 401 || error.status === 403)
  if (isAuthFailure) {
    return false
  }
  // failureCount is part of the retry-guard signature but unused under
  // fail-fast.
  void failureCount
  return false
}

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: FIVE_MINUTES_MS,
        retry: canvasQueryRetry,
      },
    },
  })
}

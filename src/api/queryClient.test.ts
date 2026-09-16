import { describe, expect, it } from 'vitest'
import { CanvasError } from '../api/canvas'
import {
  canvasQueryRetry,
  createAppQueryClient,
  FIVE_MINUTES_MS,
} from './queryClient'

describe('canvasQueryRetry', () => {
  // The spec's no-retry case: an expired/invalid token must never burn extra
  // attempts against Canvas after the reconnect redirect has fired.
  it.each([401, 403])(
    'returns false for a CanvasError with auth status %i',
    (status) => {
      expect(canvasQueryRetry(0, new CanvasError(status))).toBe(false)
    },
  )

  // Every other failure also fails fast: the uncached canvas layer never
  // retried, and view behavior must not change underneath the cache.
  it('returns false for a CanvasError with a non-auth status', () => {
    expect(canvasQueryRetry(0, new CanvasError(500))).toBe(false)
    expect(canvasQueryRetry(0, new CanvasError(404))).toBe(false)
  })

  it('returns false for any non-Canvas error', () => {
    expect(canvasQueryRetry(0, new Error('network down'))).toBe(false)
  })
})

describe('createAppQueryClient', () => {
  it('defaults every query to the 5-minute staleTime and the canvas retry guard', () => {
    const client = createAppQueryClient()

    const defaulted = client.defaultQueryOptions({ queryKey: ['x'] })

    expect(defaulted.staleTime).toBe(FIVE_MINUTES_MS)
    expect(defaulted.retry).toBe(canvasQueryRetry)
    client.clear()
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { clearToken, loadToken, saveToken, TOKEN_STORAGE_KEY } from './token.ts'

describe('token storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists the token under a single well-known key, in plaintext', () => {
    saveToken('token123')
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('token123')
    expect(loadToken()).toBe('token123')
  })

  it('clearToken removes it', () => {
    saveToken('token123')
    clearToken()
    expect(loadToken()).toBeNull()
  })
})

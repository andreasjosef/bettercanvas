export const TOKEN_STORAGE_KEY = 'canvas.token'

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function loadToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

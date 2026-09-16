import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { loadToken } from '../token'

/**
 * The session's Canvas token plus the shared no-token redirect: every
 * Canvas-data view needs the token and must bounce to Connect when absent.
 */
export function useCanvasToken() {
  const router = useRouter()
  const token = loadToken()

  if (!token) {
    void router.replace({ name: 'connect' })
  }

  const tokenEnabled = computed(() => token !== null)

  return { token, tokenEnabled }
}

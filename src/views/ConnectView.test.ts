import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import App from '../App.vue'
import { createAppRouter } from '../router'
import { TOKEN_STORAGE_KEY } from '../token'

function coursesResponse(): Response {
  return new Response(JSON.stringify([{ id: 585, name: 'Course 585' }]), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

async function mountConnect() {
  const router = createAppRouter()
  await router.push('/connect')
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  return { wrapper, router }
}

async function submitToken(wrapper: ReturnType<typeof mount>) {
  const input = wrapper.find('input[name="token"]')
  await input.setValue('token123')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('ConnectView', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('on success: verifies via proxy, persists token, navigates onward', async () => {
    fetchMock.mockResolvedValue(coursesResponse())
    const { wrapper, router } = await mountConnect()

    await submitToken(wrapper)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/courses')
    expect(url).not.toContain('chasacademy.instructure.com')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token123' })
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('token123')
    expect(router.currentRoute.value.name).toBe('picker')
  })

  it('on failure: shows an inline error and leaves localStorage untouched', async () => {
    fetchMock.mockResolvedValue(
      new Response('Invalid token', { status: 401 }),
    )
    const { wrapper, router } = await mountConnect()

    await submitToken(wrapper)

    expect(fetchMock).toHaveBeenCalledOnce()
    const alert = wrapper.find('[role="alert"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).not.toBe('')
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(router.currentRoute.value.name).toBe('connect')
  })
})

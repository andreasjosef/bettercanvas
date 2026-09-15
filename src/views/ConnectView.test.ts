import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { coursesResponse, mountAppAtPath } from '../test/appHarness'
import { TOKEN_STORAGE_KEY } from '../token'

const mountConnect = () => mountAppAtPath('/connect')

async function submitToken(wrapper: Awaited<ReturnType<typeof mountConnect>>['wrapper']) {
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
    fetchMock.mockImplementation(() =>
      coursesResponse([{ id: 585, name: 'Course 585' }]),
    )
    const { wrapper, router } = await mountConnect()

    await submitToken(wrapper)

    const calls = fetchMock.mock.calls as [string, RequestInit][]
    expect(calls.map(([url]) => url)).toEqual(['/api/v1/courses', '/api/v1/courses'])
    expect(calls[0]![0]).not.toContain('chasacademy.instructure.com')
    expect(calls[0]![1].headers).toMatchObject({ Authorization: 'Bearer token123' })
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

  it('on an unreachable proxy (200 non-JSON, e.g. no deploy/rewrite in front of it): shows a distinct diagnostic message, not "Canvas rejected"', async () => {
    fetchMock.mockResolvedValue(
      new Response('<!doctype html><html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    )
    const { wrapper, router } = await mountConnect()

    await submitToken(wrapper)

    const alert = wrapper.find('[role="alert"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).not.toContain('Canvas rejected this token')
    expect(alert.text()).toContain('Could not reach the Canvas proxy')
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(router.currentRoute.value.name).toBe('connect')
  })
})

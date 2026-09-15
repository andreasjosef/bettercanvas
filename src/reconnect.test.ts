import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  coursesResponse,
  mountAppAtPath,
} from './test/appHarness'
import { PROGRAMS_STORAGE_KEY } from './programs'
import { TOKEN_STORAGE_KEY } from './token'

describe('reconnect-on-expired-token flow', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stale-token')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('routes to the reconnect screen with a clear reason on a 401 from the picker load', async () => {
    fetchMock.mockResolvedValue(
      new Response('Invalid token', { status: 401 }),
    )
    const { wrapper, router } = await mountAppAtPath('/picker')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('connect')
    expect(router.currentRoute.value.query).toMatchObject({
      reason: 'token-invalid',
    })
    expect(wrapper.find('h1').text()).toBe('Reconnect')
    const notice = wrapper.find('[role="status"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain('invalid or has expired')
    expect(notice.text()).toContain('reconnect')
  })

  it('routes to the reconnect screen on a 403 from the home next-due call', async () => {
    localStorage.setItem(
      PROGRAMS_STORAGE_KEY,
      JSON.stringify([{ courseId: 585, name: 'Program 585', archived: false }]),
    )
    fetchMock.mockResolvedValue(
      new Response('Forbidden', { status: 403 }),
    )
    const { wrapper, router } = await mountAppAtPath('/')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('connect')
    expect(router.currentRoute.value.query).toMatchObject({
      reason: 'token-invalid',
    })
    const notice = wrapper.find('[role="status"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain('invalid or has expired')
  })

  it('pasting a fresh token on the reconnect screen overwrites the stored one and resumes normal use', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Invalid token', { status: 401 }),
    )
    const { wrapper, router } = await mountAppAtPath('/picker')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('connect')

    fetchMock.mockImplementation(() =>
      coursesResponse([{ id: 585, name: 'Course 585' }]),
    )
    const input = wrapper.find('input[name="token"]')
    await input.setValue('fresh-token')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('fresh-token')
    expect(router.currentRoute.value.name).toBe('picker')
    const calls = fetchMock.mock.calls as [string, RequestInit][]
    expect(calls[calls.length - 1]![1].headers).toMatchObject({
      Authorization: 'Bearer fresh-token',
    })
  })
})

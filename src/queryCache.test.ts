import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  assignmentsResponse,
  modulesResponse,
  mountAppAtPath,
} from './test/appHarness'
import { savePrograms } from './programs'
import { TOKEN_STORAGE_KEY } from './token'

/**
 * Issue #45: the acceptance criterion the whole ticket exists for —
 * navigating between a Program's tabs (and Home) within a session must
 * not re-issue network requests for data Query already holds.
 */
describe('Query-backed session cache', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token123')
    savePrograms([{ courseId: 585, name: 'Vue & the Modern Web', archived: false }])
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('navigating Modules → Assignments → Modules fetches the modules list once', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/modules')) {
        return Promise.resolve(
          modulesResponse([
            {
              id: 101,
              name: 'Module 01',
              position: 1,
              items: [
                {
                  id: 2,
                  type: 'Page',
                  title: 'Intro to Vue',
                  page_url: 'intro-to-vue',
                },
              ],
            },
          ]),
        )
      }
      return Promise.resolve(
        assignmentsResponse([
          { id: 9, name: 'Lab 2', due_at: '2026-09-20T13:00:00Z' },
        ]),
      )
    })

    const { wrapper, router } = await mountAppAtPath('/programs/585/modules')
    expect(wrapper.text()).toContain('Module 01')

    await router.push({ name: 'program-assignments', params: { programId: '585' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Lab 2')

    await router.push({ name: 'program-modules', params: { programId: '585' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Module 01')

    const urls = (fetchMock.mock.calls as [string][]).map(([url]) => url)
    const moduleCalls = urls.filter((url) => url.includes('/modules'))
    const assignmentCalls = urls.filter(
      (url) => url.includes('/assignments') && !url.includes('bucket=future'),
    )
    expect(moduleCalls).toHaveLength(1)
    expect(assignmentCalls).toHaveLength(1)
  })

  it('navigating Program → Home → Program does not re-fetch the next-due summary', async () => {
    fetchMock.mockResolvedValue(
      assignmentsResponse([
        { id: 9, name: 'Lab 2', due_at: '2026-09-20T13:00:00Z' },
      ]),
    )

    const { wrapper, router } = await mountAppAtPath('/')
    expect(wrapper.text()).toContain('Next due: Lab 2')

    await router.push({ name: 'program-modules', params: { programId: '585' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Vue & the Modern Web')

    await router.push({ name: 'home' })
    await flushPromises()
    expect(wrapper.text()).toContain('Next due: Lab 2')

    const urls = (fetchMock.mock.calls as [string][]).map(([url]) => url)
    const nextDueCalls = urls.filter((url) => url.includes('bucket=future'))
    expect(nextDueCalls).toHaveLength(1)
  })
})

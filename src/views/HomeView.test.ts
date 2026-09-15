import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { assignmentsResponse, mountAppAtPath } from '../test/appHarness'
import { savePrograms } from '../programs'
import { TOKEN_STORAGE_KEY } from '../token'

describe('HomeView', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token123')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists only Active Programs, each with its next-due summary fetched through the proxy', async () => {
    savePrograms([
      { courseId: 585, name: 'Programmeringäsning', archived: false },
      { courseId: 612, name: 'Administration Materials Bank', archived: true },
    ])
    fetchMock.mockResolvedValue(
      assignmentsResponse([
        { id: 9, name: 'Lab 2', due_at: '2026-09-20T13:00:00Z' },
      ]),
    )
    const { wrapper } = await mountAppAtPath('/')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      '/api/v1/courses/585/assignments?bucket=future&order_by=due_at&per_page=1',
    )
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token123' })

    const listText = wrapper.find('ul').text()
    expect(listText).toContain('Programmeringäsning')
    expect(listText).toContain('Lab 2')
    expect(listText).toMatch(/20 Sep\w* 2026/)
    expect(listText).not.toContain('Administration Materials Bank')
  })

  it('shows a no-upcoming-assignments summary for an Active Program with nothing due', async () => {
    savePrograms([{ courseId: 585, name: 'Programmeringäsning', archived: false }])
    fetchMock.mockResolvedValue(assignmentsResponse([]))
    const { wrapper } = await mountAppAtPath('/')

    expect(wrapper.find('ul').text()).toContain('No upcoming assignments')
  })

  it('with no Active Programs: shows an empty state and fetches nothing', async () => {
    savePrograms([
      { courseId: 612, name: 'Administration Materials Bank', archived: true },
    ])
    const { wrapper } = await mountAppAtPath('/')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.find('ul').exists()).toBe(false)
    expect(wrapper.text()).toContain('No active Programs')
  })

  it('a failed next-due fetch marks that entry as failed without breaking the rest of the list', async () => {
    savePrograms([
      { courseId: 585, name: 'Programmeringäsning', archived: false },
      { courseId: 619, name: 'CodeForGood', archived: false },
    ])
    fetchMock.mockImplementation((url: string) =>
      url.includes('/619/')
        ? Promise.resolve(assignmentsResponse([]))
        : Promise.reject(new Error('network down')),
    )
    const { wrapper } = await mountAppAtPath('/')

    const listText = wrapper.find('ul').text()
    expect(listText).toContain('Programmeringäsning')
    expect(listText).toContain('CodeForGood')
    expect(listText).toContain('Could not load upcoming assignments')
  })

  it('links to the Settings/Manage Programs route', async () => {
    savePrograms([{ courseId: 585, name: 'Programmeringäsning', archived: false }])
    fetchMock.mockResolvedValue(assignmentsResponse([]))
    const { wrapper } = await mountAppAtPath('/')

    // Scope to the view's main: the app shell's sidebar also links to /settings.
    const settingsLink = wrapper.find('main a[href="/settings"]')
    expect(settingsLink.exists()).toBe(true)
    expect(settingsLink.text()).toContain('Manage Programs')
  })

  it('each Active Program opens its Modules view', async () => {
    savePrograms([{ courseId: 585, name: 'Programmeringäsning', archived: false }])
    fetchMock.mockResolvedValue(assignmentsResponse([]))
    const { wrapper } = await mountAppAtPath('/')

    const rowLink = wrapper.find('ul a[href="/programs/585/modules"]')
    expect(rowLink.exists()).toBe(true)
    expect(rowLink.text()).toContain('Programmeringäsning')

    await rowLink.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Modules')
  })
})

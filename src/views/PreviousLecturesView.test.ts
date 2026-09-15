import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountAppAtPath } from '../test/appHarness'
import { savePrograms } from '../programs'
import { TOKEN_STORAGE_KEY } from '../token'

describe('PreviousLecturesView', () => {
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

  it('with a mixed Active/Archived fixture: only Archived Programs render and are navigable', async () => {
    savePrograms([
      { courseId: 585, name: 'Programmeringäsning', archived: false },
      { courseId: 612, name: 'Administration Materials Bank', archived: true },
      { courseId: 640, name: 'Game Design Fall 2025', archived: true },
    ])
    const { wrapper } = await mountAppAtPath('/previous-lectures')

    expect(fetchMock).not.toHaveBeenCalled()
    const listText = wrapper.find('ul').text()
    expect(listText).toContain('Administration Materials Bank')
    expect(listText).toContain('Game Design Fall 2025')
    expect(listText).not.toContain('Programmeringäsning')
    expect(wrapper.findAll('ul a')).toHaveLength(2)

    const archivedLink = wrapper.find('ul a[href="/programs/640/modules"]')
    await archivedLink.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Modules')
  })

  it('renders Archived Programs as plain divider-separated rows, not cards', async () => {
    savePrograms([
      { courseId: 612, name: 'Administration Materials Bank', archived: true },
      { courseId: 640, name: 'Game Design Fall 2025', archived: true },
    ])
    const { wrapper } = await mountAppAtPath('/previous-lectures')

    const rows = wrapper.findAll('ul > li')
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.classes()).not.toContain('rounded-md')
      expect(row.classes()).not.toContain('bg-surface')
      expect(row.classes()).not.toContain('border')
      const link = row.find('a')
      expect(link.exists()).toBe(true)
      expect(link.classes()).toContain('border-b')
      expect(link.classes()).toContain('py-2')
    }
  })

  it('an Archived Program opens its Modules view the same as an Active one', async () => {
    savePrograms([
      { courseId: 640, name: 'Game Design Fall 2025', archived: true },
    ])
    const { wrapper } = await mountAppAtPath('/previous-lectures')

    const rowLink = wrapper.find('ul a[href="/programs/640/modules"]')
    expect(rowLink.exists()).toBe(true)
    expect(rowLink.text()).toContain('Game Design Fall 2025')

    await rowLink.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Modules')
  })

  it('with no Archived Programs: shows an empty state', async () => {
    savePrograms([{ courseId: 585, name: 'Programmeringäsning', archived: false }])
    const { wrapper } = await mountAppAtPath('/previous-lectures')

    expect(wrapper.find('ul').exists()).toBe(false)
    expect(wrapper.text()).toContain('No Archived Programs')
  })

  it('links back to Home', async () => {
    savePrograms([{ courseId: 612, name: 'Administration Materials Bank', archived: true }])
    const { wrapper } = await mountAppAtPath('/previous-lectures')

    // Scope to the view's main: the app shell's wordmark also links to /.
    const homeLink = wrapper.find('main a[href="/"]')
    expect(homeLink.exists()).toBe(true)
  })
})
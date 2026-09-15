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

  it('with a mixed Active/Archived fixture: lists only Archived Programs and fetches nothing', async () => {
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

    const homeLink = wrapper.find('a[href="/"]')
    expect(homeLink.exists()).toBe(true)
  })
})
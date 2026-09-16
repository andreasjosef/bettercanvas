import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { coursesResponse, mountAppAtPath } from '../test/appHarness'
import { DONE_STORAGE_KEY } from '../done'
import { PROGRAMS_STORAGE_KEY } from '../programs'
import { TOKEN_STORAGE_KEY } from '../token'

async function confirmSelection(
  wrapper: Awaited<ReturnType<typeof mountAppAtPath>>['wrapper'],
) {
  const button = wrapper
    .findAll('button')
    .find((b) => b.text() === 'Confirm')
  expect(button).toBeDefined()
  await button?.trigger('submit')
  await flushPromises()
}

describe('PickerView', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the Courses the stored token has access to, fetched through the proxy', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token123')
    fetchMock.mockResolvedValue(
      coursesResponse([
        { id: 585, name: 'Programmeringäsning' },
        { id: 612, name: 'Administration Materials Bank' },
      ]),
    )
    const { wrapper } = await mountAppAtPath('/picker')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/courses')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token123' })
    const listText = wrapper.find('ul').text()
    expect(listText).toContain('Programmeringäsning')
    expect(listText).toContain('Administration Materials Bank')
  })

  it('persisting a non-empty selection: stores the picked Courses as Active Programs and navigates home', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token123')
    fetchMock.mockResolvedValue(
      coursesResponse([
        { id: 585, name: 'Programmeringäsning' },
        { id: 612, name: 'Administration Materials Bank' },
      ]),
    )
    const { wrapper, router } = await mountAppAtPath('/picker')

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes).toHaveLength(2)
    await checkboxes[0]!.setValue(true)
    await confirmSelection(wrapper)

    const stored = JSON.parse(
      localStorage.getItem(PROGRAMS_STORAGE_KEY) ?? 'null',
    ) as unknown
    expect(stored).toEqual([
      { courseId: 585, name: 'Programmeringäsning', archived: false },
    ])
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('zero selection is accepted: persists no Programs and reaches a working empty app', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token123')
    fetchMock.mockResolvedValue(coursesResponse([{ id: 585, name: 'Programmeringäsning' }]))
    const { wrapper, router } = await mountAppAtPath('/picker')

    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(1)
    await confirmSelection(wrapper)

    const stored = JSON.parse(
      localStorage.getItem(PROGRAMS_STORAGE_KEY) ?? 'null',
    ) as unknown
    expect(stored).toEqual([])
    expect(router.currentRoute.value.name).toBe('home')
    expect(wrapper.find('h1').text()).toBe('Home')
  })

  it('confirming a selection purges the Done state of fully-deselected Programs, keeping picked ones', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token123')
    localStorage.setItem(
      DONE_STORAGE_KEY,
      JSON.stringify({
        '585': { lessons: [101], assignments: [77] },
        '612': { lessons: [202], assignments: [] },
      }),
    )
    fetchMock.mockResolvedValue(
      coursesResponse([
        { id: 585, name: 'Programmeringäsning' },
        { id: 612, name: 'Administration Materials Bank' },
      ]),
    )
    const { wrapper } = await mountAppAtPath('/picker')

    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(true)
    await confirmSelection(wrapper)

    expect(JSON.parse(localStorage.getItem(DONE_STORAGE_KEY) ?? 'null')).toEqual({
      '612': { lessons: [202], assignments: [] },
    })
  })

  it('on a failed Courses fetch: shows an inline error and persists nothing', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token123')
    fetchMock.mockResolvedValue(new Response('Boom', { status: 500 }))
    const { wrapper, router } = await mountAppAtPath('/picker')

    const alert = wrapper.find('[role="alert"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).not.toBe('')
    expect(localStorage.getItem(PROGRAMS_STORAGE_KEY)).toBeNull()
    expect(router.currentRoute.value.name).toBe('picker')
  })

  it('with no stored token: sends the user back to connect instead of fetching', async () => {
    const { router } = await mountAppAtPath('/picker')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('connect')
  })
})

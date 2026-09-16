import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { coursesResponse, mountAppAtPath } from '../test/appHarness'
import { DONE_STORAGE_KEY } from '../done'
import { PROGRAMS_STORAGE_KEY, type Program } from '../programs'
import { TOKEN_STORAGE_KEY } from '../token'

function seedPrograms(programs: Program[]): void {
  localStorage.setItem(PROGRAMS_STORAGE_KEY, JSON.stringify(programs))
}

function courseCheckbox(
  wrapper: Awaited<ReturnType<typeof mountAppAtPath>>['wrapper'],
  name: string,
) {
  return wrapper.find(`input[aria-label="${name}"]`)
}

function archiveToggle(
  wrapper: Awaited<ReturnType<typeof mountAppAtPath>>['wrapper'],
  name: string,
) {
  return wrapper.find(`input[aria-label="Archive ${name}"]`)
}

async function confirmSelection(
  wrapper: Awaited<ReturnType<typeof mountAppAtPath>>['wrapper'],
) {
  const button = wrapper.findAll('button').find((b) => b.text() === 'Confirm')
  expect(button).toBeDefined()
  await button?.trigger('submit')
  await flushPromises()
}

describe('SettingsView (Manage Programs)', () => {
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

  it('renders the same picker flow, pre-populated with the current selection', async () => {
    seedPrograms([{ courseId: 585, name: 'Programmeringäsning', archived: false }])
    fetchMock.mockResolvedValue(
      coursesResponse([
        { id: 585, name: 'Programmeringäsning' },
        { id: 612, name: 'Administration Materials Bank' },
      ]),
    )
    const { wrapper, router } = await mountAppAtPath('/settings')

    expect(router.currentRoute.value.name).toBe('settings')
    expect(wrapper.find('h1').text()).toBe('Manage Programs')
    const selection585 = courseCheckbox(wrapper, 'Programmeringäsning')
    expect(selection585.exists()).toBe(true)
    expect((selection585.element as HTMLInputElement).checked).toBe(true)
    const selection612 = courseCheckbox(wrapper, 'Administration Materials Bank')
    expect((selection612.element as HTMLInputElement).checked).toBe(false)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/courses')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token123' })
  })

  it('exposes an Active/Archived toggle for each currently-selected Program', async () => {
    seedPrograms([
      { courseId: 585, name: 'Programmeringäsning', archived: false },
      { courseId: 612, name: 'Administration Materials Bank', archived: true },
    ])
    fetchMock.mockResolvedValue(
      coursesResponse([
        { id: 585, name: 'Programmeringäsning' },
        { id: 612, name: 'Administration Materials Bank' },
      ]),
    )
    const { wrapper } = await mountAppAtPath('/settings')

    const active585 = archiveToggle(wrapper, 'Programmeringäsning')
    expect(active585.exists()).toBe(true)
    expect((active585.element as HTMLInputElement).checked).toBe(false)
    const archived612 = archiveToggle(wrapper, 'Administration Materials Bank')
    expect(archived612.exists()).toBe(true)
    expect((archived612.element as HTMLInputElement).checked).toBe(true)
  })

  it('toggling a Program to Archived persists it and drops it from a subsequently-rendered Home', async () => {
    seedPrograms([
      { courseId: 585, name: 'Programmeringäsning', archived: false },
      { courseId: 612, name: 'Administration Materials Bank', archived: false },
    ])
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/v1/courses') {
        return Promise.resolve(
          coursesResponse([
            { id: 585, name: 'Programmeringäsning' },
            { id: 612, name: 'Administration Materials Bank' },
          ]),
        )
      }
      return Promise.resolve(coursesResponse([]))
    })
    const { wrapper, router } = await mountAppAtPath('/settings')

    const toggle = archiveToggle(wrapper, 'Programmeringäsning')
    await toggle.setValue(true)
    await confirmSelection(wrapper)

    const stored = JSON.parse(
      localStorage.getItem(PROGRAMS_STORAGE_KEY) ?? 'null',
    ) as unknown
    expect(stored).toEqual([
      { courseId: 585, name: 'Programmeringäsning', archived: true },
      { courseId: 612, name: 'Administration Materials Bank', archived: false },
    ])

    await router.push({ name: 'home' })
    await flushPromises()
    const listText = wrapper.find('ul').text()
    expect(listText).toContain('Administration Materials Bank')
    expect(listText).not.toContain('Programmeringäsning')
  })

  it('toggling a Program to Archived leaves its Done state untouched', async () => {
    seedPrograms([
      { courseId: 585, name: 'Programmeringäsning', archived: false },
      { courseId: 612, name: 'Administration Materials Bank', archived: false },
    ])
    localStorage.setItem(
      DONE_STORAGE_KEY,
      JSON.stringify({
        '585': { lessons: [101], assignments: [77], modules: [] },
        '612': { lessons: [202], assignments: [], modules: [] },
      }),
    )
    fetchMock.mockResolvedValue(
      coursesResponse([
        { id: 585, name: 'Programmeringäsning' },
        { id: 612, name: 'Administration Materials Bank' },
      ]),
    )
    const { wrapper } = await mountAppAtPath('/settings')

    await archiveToggle(wrapper, 'Programmeringäsning').setValue(true)
    await confirmSelection(wrapper)

    expect(JSON.parse(localStorage.getItem(DONE_STORAGE_KEY) ?? 'null')).toEqual({
      '585': { lessons: [101], assignments: [77], modules: [] },
      '612': { lessons: [202], assignments: [], modules: [] },
    })
  })

  it('fully deselecting a Program purges its Done state, keeping the rest', async () => {
    seedPrograms([
      { courseId: 585, name: 'Programmeringäsning', archived: false },
      { courseId: 612, name: 'Administration Materials Bank', archived: false },
    ])
    localStorage.setItem(
      DONE_STORAGE_KEY,
      JSON.stringify({
        '585': { lessons: [101], assignments: [77], modules: [] },
        '612': { lessons: [202], assignments: [], modules: [] },
      }),
    )
    fetchMock.mockResolvedValue(
      coursesResponse([
        { id: 585, name: 'Programmeringäsning' },
        { id: 612, name: 'Administration Materials Bank' },
      ]),
    )
    const { wrapper } = await mountAppAtPath('/settings')

    await courseCheckbox(wrapper, 'Programmeringäsning').setValue(false)
    await confirmSelection(wrapper)

    expect(JSON.parse(localStorage.getItem(DONE_STORAGE_KEY) ?? 'null')).toEqual({
      '612': { lessons: [202], assignments: [], modules: [] },
    })
  })

  it('newly-picked Courses default to Active and unpicked Courses are dropped from storage', async () => {
    seedPrograms([{ courseId: 585, name: 'Programmeringäsning', archived: false }])
    fetchMock.mockResolvedValue(
      coursesResponse([
        { id: 585, name: 'Programmeringäsning' },
        { id: 612, name: 'Administration Materials Bank' },
      ]),
    )
    const { wrapper } = await mountAppAtPath('/settings')

    await courseCheckbox(wrapper, 'Administration Materials Bank').setValue(true)
    await courseCheckbox(wrapper, 'Programmeringäsning').setValue(false)
    await confirmSelection(wrapper)

    const stored = JSON.parse(
      localStorage.getItem(PROGRAMS_STORAGE_KEY) ?? 'null',
    ) as unknown
    expect(stored).toEqual([
      { courseId: 612, name: 'Administration Materials Bank', archived: false },
    ])
  })

  it('re-picking a stored Archived Program in the same session resets it to Active', async () => {
    seedPrograms([{ courseId: 585, name: 'Programmeringäsning', archived: true }])
    fetchMock.mockResolvedValue(
      coursesResponse([{ id: 585, name: 'Programmeringäsning' }]),
    )
    const { wrapper } = await mountAppAtPath('/settings')

    await courseCheckbox(wrapper, 'Programmeringäsning').setValue(false)
    await courseCheckbox(wrapper, 'Programmeringäsning').setValue(true)
    expect((archiveToggle(wrapper, 'Programmeringäsning').element as HTMLInputElement).checked).toBe(false)
    await confirmSelection(wrapper)

    const stored = JSON.parse(
      localStorage.getItem(PROGRAMS_STORAGE_KEY) ?? 'null',
    ) as unknown
    expect(stored).toEqual([
      { courseId: 585, name: 'Programmeringäsning', archived: false },
    ])
  })

  it('a stored Program no longer returned by Canvas stays manageable with its archived flag', async () => {
    seedPrograms([
      { courseId: 585, name: 'Programmeringäsning', archived: true },
    ])
    fetchMock.mockResolvedValue(
      coursesResponse([{ id: 612, name: 'Administration Materials Bank' }]),
    )
    const { wrapper } = await mountAppAtPath('/settings')

    const archivedRow = archiveToggle(wrapper, 'Programmeringäsning')
    expect(archivedRow.exists()).toBe(true)
    expect((archivedRow.element as HTMLInputElement).checked).toBe(true)

    await archivedRow.setValue(false)
    await confirmSelection(wrapper)

    const stored = JSON.parse(
      localStorage.getItem(PROGRAMS_STORAGE_KEY) ?? 'null',
    ) as unknown
    expect(stored).toEqual([
      { courseId: 585, name: 'Programmeringäsning', archived: false },
    ])
  })

  it('with no stored token: sends the user back to connect instead of fetching', async () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    const { router } = await mountAppAtPath('/settings')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('connect')
  })

  it('on a failed Courses fetch: shows an inline error and changes nothing', async () => {
    seedPrograms([{ courseId: 585, name: 'Programmeringäsning', archived: false }])
    fetchMock.mockResolvedValue(new Response('Boom', { status: 500 }))
    const { wrapper, router } = await mountAppAtPath('/settings')

    const alert = wrapper.find('[role="alert"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).not.toBe('')
    const stored = JSON.parse(
      localStorage.getItem(PROGRAMS_STORAGE_KEY) ?? 'null',
    ) as unknown
    expect(stored).toEqual([
      { courseId: 585, name: 'Programmeringäsning', archived: false },
    ])
    expect(router.currentRoute.value.name).toBe('settings')
  })
})

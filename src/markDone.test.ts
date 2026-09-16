import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import {
  assignmentsResponse,
  modulesResponse,
  mountAppAtPath,
  type FakeModule,
} from './test/appHarness'
import { DONE_STORAGE_KEY } from './done'
import { PROGRAMS_STORAGE_KEY, savePrograms } from './programs'
import { TOKEN_STORAGE_KEY } from './token'

vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-09-15T10:00:00Z'))

const PROGRAMS = [{ courseId: 585, name: 'Vue & the Modern Web', archived: false }]

const MODULES: FakeModule[] = [
  {
    id: 101,
    name: 'Week 1',
    position: 1,
    items: [
      { id: 1, type: 'Page', title: 'Syllabus', page_url: 'syllabus' },
      { id: 2, type: 'Assignment', title: 'Problem Set 1', content_id: 900 },
    ],
  },
  {
    id: 102,
    name: 'Week 2',
    position: 2,
    items: [
      { id: 3, type: 'Page', title: 'Arrays vs Linked Lists', page_url: 'arrays' },
      // Same Canvas Assignment linked into a second Module.
      { id: 4, type: 'Assignment', title: 'Problem Set 1', content_id: 900 },
    ],
  },
]

const ASSIGNMENTS = [
  { id: 900, name: 'Problem Set 1', due_at: '2026-09-16T10:00:00Z' },
  { id: 901, name: 'Reading response', due_at: '2026-09-16T11:00:00Z' },
]

function stubProgramFetch(fetchMock: ReturnType<typeof vi.fn>): void {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes('/modules')) {
      return Promise.resolve(modulesResponse(MODULES))
    }
    return Promise.resolve(assignmentsResponse(ASSIGNMENTS))
  })
}

function sidebarModuleLabels(wrapper: VueWrapper): string[] {
  const sidebar = wrapper.find('[data-testid="program-sidebar"]')
  return sidebar
    .findAll('a')
    .map((link) => link.text())
    .filter((label) => label.startsWith('Week'))
}

async function click(wrapper: VueWrapper, testid: string): Promise<void> {
  const button = wrapper.find(`[data-testid="${testid}"]`)
  expect(button.exists(), `expected ${testid} to exist`).toBe(true)
  await button.trigger('click')
  await flushPromises()
}

async function navigateTo(wrapper: VueWrapper, label: string): Promise<void> {
  const link = wrapper
    .find('[data-testid="program-sidebar"]')
    .findAll('a')
    .find((candidate) => candidate.text() === label)
  expect(link, `expected sidebar link ${label} to exist`).toBeDefined()
  await link!.trigger('click')
  await flushPromises()
}

describe('Mark Done: Lessons, Assignments, and Modules', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token123')
    savePrograms(PROGRAMS)
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks a Lesson Done from its Module\'s Lessons tab, and it disappears from the tab', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    await click(wrapper, 'mark-done-1')

    expect(wrapper.text()).not.toContain('Syllabus')
    expect(wrapper.find('[data-testid="mark-done-1"]').exists()).toBe(false)
  })

  it('marks an Assignment Done from its Module\'s Assignments tab, and it disappears from the tab', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    await click(wrapper, 'module-tab-assignments')
    await click(wrapper, 'mark-done-2')

    expect(wrapper.text()).not.toContain('Problem Set 1')
    expect(wrapper.text()).toContain('No Assignments in this Module.')
  })

  it('marks an Assignment Done from the landing due-soon aggregate, and it disappears from both the aggregate and the Module tab', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585')
    expect(wrapper.find('[data-testid="assignments-this-week"]').text()).toContain('Problem Set 1')

    await click(wrapper, 'mark-done-900')

    const thisWeek = wrapper.find('[data-testid="assignments-this-week"]')
    expect(thisWeek.exists()).toBe(true)
    expect(thisWeek.text()).not.toContain('Problem Set 1')
    expect(thisWeek.text()).toContain('Reading response')
    expect(wrapper.text()).not.toContain('Nothing due — or everything due is already Done.')

    await navigateTo(wrapper, 'Week 1')
    await click(wrapper, 'module-tab-assignments')

    expect(wrapper.text()).toContain('No Assignments in this Module.')
  })

  it('marks a whole Module Done in one action: every leaf Done, Module gone from the sidebar, tabs empty', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    await click(wrapper, 'mark-module-done')

    expect(sidebarModuleLabels(wrapper)).toEqual(['Week 2'])
    expect(wrapper.text()).toContain('No Lessons in this Module.')

    const stored = JSON.parse(localStorage.getItem(DONE_STORAGE_KEY) ?? '{}') as Record<
      string,
      { lessons: number[]; assignments: number[]; modules: number[] }
    >
    expect(stored['585']).toEqual({ lessons: [1], assignments: [900], modules: [] })
  })

  it('a Module becomes Done automatically once all of its leaves are individually Done', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/102')

    await click(wrapper, 'mark-done-3')
    expect(sidebarModuleLabels(wrapper)).toEqual(['Week 1', 'Week 2'])

    await click(wrapper, 'module-tab-assignments')
    await click(wrapper, 'mark-done-4')

    expect(sidebarModuleLabels(wrapper)).toEqual(['Week 1'])
  })

  it('marking one leaf Done leaves a partially-finished Module visible in the sidebar', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/102')

    await click(wrapper, 'mark-done-3')

    expect(sidebarModuleLabels(wrapper)).toEqual(['Week 1', 'Week 2'])
  })

  it('an Assignment linked into multiple Modules is marked Done everywhere once marked Done anywhere', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    await click(wrapper, 'module-tab-assignments')
    await click(wrapper, 'mark-done-2')

    await navigateTo(wrapper, 'Week 2')
    await click(wrapper, 'module-tab-assignments')
    expect(wrapper.text()).toContain('No Assignments in this Module.')

    await navigateTo(wrapper, 'Due soon')
    expect(wrapper.find('[data-testid="assignments-this-week"]').text()).not.toContain('Problem Set 1')
  })

  it('marking Done never issues a Canvas API request', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')
    const callsAfterMount = fetchMock.mock.calls.length

    await click(wrapper, 'mark-done-1')
    await click(wrapper, 'module-tab-assignments')
    await click(wrapper, 'mark-done-2')
    await click(wrapper, 'mark-module-done')

    expect(fetchMock.mock.calls).toHaveLength(callsAfterMount)
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith('/api/v1/'))).toBe(true)
  })

  it('marking every item in a Program Done leaves the Program\'s Archived state untouched', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    await click(wrapper, 'mark-module-done')
    await navigateTo(wrapper, 'Week 2')
    await click(wrapper, 'mark-module-done')

    expect(sidebarModuleLabels(wrapper)).toEqual([])
    const stored = JSON.parse(
      localStorage.getItem(PROGRAMS_STORAGE_KEY) ?? '[]',
    ) as Array<{ courseId: number; archived: boolean }>
    expect(stored).toEqual([{ courseId: 585, name: 'Vue & the Modern Web', archived: false }])
  })
})

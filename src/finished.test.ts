import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import {
  assignmentsResponse,
  modulesResponse,
  mountAppAtPath,
  type FakeModule,
} from './test/appHarness'
import { PROGRAMS_STORAGE_KEY, savePrograms, type Program } from './programs'
import { TOKEN_STORAGE_KEY } from './token'

vi.useFakeTimers({ toFake: ['Date'] })

const PROGRAMS: Program[] = [
  { courseId: 585, name: 'Vue & the Modern Web', archived: false },
]

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

function sectionLabels(wrapper: VueWrapper, testid: string): string[] {
  const sec = wrapper.find(`[data-testid="${testid}"]`)
  if (!sec.exists()) return []
  return sec
    .findAll('li')
    .map((li) => li.find('span').text())
}

async function click(wrapper: VueWrapper, testid: string): Promise<void> {
  const button = wrapper.find(`[data-testid="${testid}"]`)
  expect(button.exists(), `expected ${testid} to exist`).toBe(true)
  await button.trigger('click')
  await flushPromises()
}

async function clickLink(wrapper: VueWrapper, label: string): Promise<void> {
  const link = wrapper
    .findAll('a')
    .find((candidate) => candidate.text().trim() === label)
  expect(link, `expected link ${label} to exist`).toBeDefined()
  await link!.trigger('click')
  await flushPromises()
}

function sidebarModuleLabels(wrapper: VueWrapper): string[] {
  const sidebar = wrapper.find('[data-testid="program-sidebar"]')
  return sidebar
    .findAll('a')
    .map((link) => link.text())
    .filter((label) => label.startsWith('Week'))
}

describe('Finished view', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token123')
    savePrograms(PROGRAMS)
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.setSystemTime(new Date('2026-09-15T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('lists every Done Module, Lesson, and Assignment flatly, including ones Done only via the Module cascade', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    await click(wrapper, 'mark-module-done')
    await clickLink(wrapper, 'Finished')

    expect(wrapper.find('h1').text()).toBe('Finished')
    expect(sectionLabels(wrapper, 'finished-modules')).toEqual(['Week 1'])
    expect(sectionLabels(wrapper, 'finished-lessons')).toEqual(['Syllabus'])
    expect(sectionLabels(wrapper, 'finished-assignments')).toEqual(['Problem Set 1'])
  })

  it('un-marking a Lesson from a cascade-Done Module pulls the Module back out of Done and keeps the sibling Done', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    await click(wrapper, 'mark-module-done')
    await clickLink(wrapper, 'Finished')

    await click(wrapper, 'unmark-done-1')

    expect(sectionLabels(wrapper, 'finished-modules')).toEqual([])
    expect(sectionLabels(wrapper, 'finished-lessons')).toEqual([])
    expect(sectionLabels(wrapper, 'finished-assignments')).toEqual(['Problem Set 1'])
    expect(sidebarModuleLabels(wrapper)).toEqual(['Week 1', 'Week 2'])

    await clickLink(wrapper, 'Week 1')
    expect(wrapper.text()).toContain('Syllabus')
    await click(wrapper, 'module-tab-assignments')
    expect(wrapper.text()).toContain('No Assignments in this Module.')
  })

  it('un-marking an Assignment from Finished returns it to its Module tab without touching the Module', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    await click(wrapper, 'mark-done-1')
    await click(wrapper, 'module-tab-assignments')
    await click(wrapper, 'mark-done-2')
    await clickLink(wrapper, 'Finished')

    expect(sectionLabels(wrapper, 'finished-assignments')).toEqual(['Problem Set 1'])
    await click(wrapper, 'unmark-done-900')

    expect(sectionLabels(wrapper, 'finished-assignments')).toEqual([])
    expect(sectionLabels(wrapper, 'finished-lessons')).toEqual(['Syllabus'])
    expect(sidebarModuleLabels(wrapper)).toEqual(['Week 1', 'Week 2'])

    await clickLink(wrapper, 'Week 1')
    await click(wrapper, 'module-tab-assignments')
    expect(wrapper.text()).toContain('Problem Set 1')
  })

  it('un-marking a whole Module from Finished un-marks every one of its leaves', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    await click(wrapper, 'mark-module-done')
    await clickLink(wrapper, 'Finished')

    await click(wrapper, 'unmark-module-101')

    expect(sectionLabels(wrapper, 'finished-modules')).toEqual([])
    expect(sectionLabels(wrapper, 'finished-lessons')).toEqual([])
    expect(sectionLabels(wrapper, 'finished-assignments')).toEqual([])
    expect(sidebarModuleLabels(wrapper)).toEqual(['Week 1', 'Week 2'])
    const stored = JSON.parse(
      localStorage.getItem('canvas.done') ?? 'null',
    ) as { '585': { lessons: number[]; assignments: number[] } } | null
    expect(stored?.['585']).toEqual({ lessons: [], assignments: [] })
  })

  it('an Assignment shared across Modules lists as one Done Assignment, and un-marking it clears it everywhere', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    await click(wrapper, 'mark-module-done')
    await clickLink(wrapper, 'Week 2')
    await click(wrapper, 'mark-module-done')
    await clickLink(wrapper, 'Finished')

    expect(sectionLabels(wrapper, 'finished-modules')).toEqual(['Week 1', 'Week 2'])
    // One Done fact per Canvas Assignment id, however many Modules link it.
    expect(sectionLabels(wrapper, 'finished-assignments')).toEqual(['Problem Set 1'])

    await click(wrapper, 'unmark-done-900')

    expect(sectionLabels(wrapper, 'finished-assignments')).toEqual([])
    expect(sectionLabels(wrapper, 'finished-lessons')).toEqual([
      'Syllabus',
      'Arrays vs Linked Lists',
    ])
    expect(sidebarModuleLabels(wrapper)).toEqual(['Week 1', 'Week 2'])
  })

  it('an Assignment marked Done from the landing aggregate appears in Finished even when linked into no Module', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585')
    await click(wrapper, 'mark-done-901')

    await clickLink(wrapper, 'Finished')
    expect(sectionLabels(wrapper, 'finished-assignments')).toEqual(['Reading response'])

    await click(wrapper, 'unmark-done-901')
    expect(sectionLabels(wrapper, 'finished-assignments')).toEqual([])

    await clickLink(wrapper, 'Due soon')
    expect(wrapper.find('[data-testid="assignments-this-week"]').text()).toContain(
      'Reading response',
    )
  })

  it('archiving then unarchiving the Program leaves its Done/Finished state exactly as it was', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    await click(wrapper, 'mark-module-done')
    await clickLink(wrapper, 'Finished')
    expect(sectionLabels(wrapper, 'finished-modules')).toEqual(['Week 1'])

    async function toggleArchive(checked: boolean): Promise<void> {
      // Inside a Program the sidebar shows Program nav; Settings is only
      // reachable after leaving via the wordmark back to Home.
      await clickLink(wrapper, 'Better Canvas')
      await clickLink(wrapper, 'Settings')
      const toggle = wrapper.find('input[aria-label="Archive Vue & the Modern Web"]')
      expect(toggle.exists()).toBe(true)
      await toggle.setValue(checked)
      const confirm = wrapper.findAll('button').find((b) => b.text() === 'Confirm')
      expect(confirm).toBeDefined()
      await confirm!.trigger('submit')
      await flushPromises()
    }

    await toggleArchive(true)
    const stored = JSON.parse(
      localStorage.getItem(PROGRAMS_STORAGE_KEY) ?? '[]',
    ) as Program[]
    expect(stored).toEqual([{ courseId: 585, name: 'Vue & the Modern Web', archived: true }])

    await toggleArchive(false)
    const restored = JSON.parse(
      localStorage.getItem(PROGRAMS_STORAGE_KEY) ?? '[]',
    ) as Program[]
    expect(restored).toEqual([{ courseId: 585, name: 'Vue & the Modern Web', archived: false }])

    // Unarchived: back under main navigation (Home lists it again), then
    // re-check Finished directly through the Program's sidebar.
    const homeRow = wrapper
      .findAll('a')
      .find((candidate) => candidate.text().includes('Vue & the Modern Web'))
    expect(homeRow, 'expected Home to list the unarchived Program').toBeDefined()
    await homeRow!.trigger('click')
    await flushPromises()
    await clickLink(wrapper, 'Finished')
    expect(sectionLabels(wrapper, 'finished-modules')).toEqual(['Week 1'])
    expect(sectionLabels(wrapper, 'finished-lessons')).toEqual(['Syllabus'])
    expect(sectionLabels(wrapper, 'finished-assignments')).toEqual(['Problem Set 1'])
  })
})

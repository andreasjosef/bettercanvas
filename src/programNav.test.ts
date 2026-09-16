import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import {
  assignmentsResponse,
  modulesResponse,
  mountAppAtPath,
  type FakeModule,
} from './test/appHarness'
import { DONE_STORAGE_KEY } from './done'
import { savePrograms } from './programs'
import { TOKEN_STORAGE_KEY } from './token'

const CANVAS_ORIGIN = 'https://chasacademy.instructure.com'

const PROGRAM_FIXTURE: FakeModule[] = [
  {
    id: 101,
    name: 'Module 01',
    position: 1,
    items_count: 5,
    items: [
      { id: 1, type: 'SubHeader', title: 'Getting started' },
      {
        id: 2,
        type: 'Page',
        title: 'Intro to Vue',
        page_url: 'intro-to-vue',
        html_url: `${CANVAS_ORIGIN}/courses/585/modules/items/2`,
      },
      {
        id: 3,
        type: 'Assignment',
        title: 'Lab 1',
        content_id: 3,
        html_url: `${CANVAS_ORIGIN}/courses/585/modules/items/3`,
      },
      {
        id: 4,
        type: 'ExternalUrl',
        title: 'Useful docs',
        external_url: 'https://developer.mozilla.org/en-US/docs/Web',
      },
      {
        id: 5,
        type: 'Quiz',
        title: 'Chapter check',
        html_url: `${CANVAS_ORIGIN}/courses/585/modules/items/5`,
      },
    ],
  },
  {
    id: 102,
    name: 'Module 02',
    position: 2,
    items_count: 1,
    items: [
      {
        id: 7,
        type: 'Page',
        title: 'Components in depth',
        page_url: 'components-in-depth',
        html_url: `${CANVAS_ORIGIN}/courses/585/modules/items/7`,
      },
    ],
  },
]

const ASSIGNMENTS_FIXTURE = [
  { id: 30, name: 'Capstone brief', due_at: '2026-10-15T10:00:00Z' },
  { id: 27, name: 'Undated placeholder', due_at: null },
  { id: 21, name: 'Lab report', due_at: '2026-09-18T10:00:00Z' },
  { id: 18, name: 'Reading quiz', due_at: '2026-09-15T11:00:00Z' },
  { id: 15, name: 'Overdue worksheet', due_at: '2026-09-13T10:00:00Z' },
]

function stubProgramFetch(fetchMock: ReturnType<typeof vi.fn>): void {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes('/modules')) {
      return Promise.resolve(modulesResponse(PROGRAM_FIXTURE))
    }
    return Promise.resolve(assignmentsResponse(ASSIGNMENTS_FIXTURE))
  })
}

/** Seeds a leaf-only canvas.done entry, as the Done-state module stores it. */
function seedDoneState(
  courseId: number,
  entry: { lessons?: number[]; assignments?: number[] },
): void {
  localStorage.setItem(
    DONE_STORAGE_KEY,
    JSON.stringify({
      [courseId]: { lessons: entry.lessons ?? [], assignments: entry.assignments ?? [] },
    }),
  )
}

function programSidebar(wrapper: VueWrapper) {
  // The Program nav must live in AppShell's single aside — no second sidebar.
  expect(wrapper.findAll('aside')).toHaveLength(1)
  const sidebar = wrapper.find('[data-testid="program-sidebar"]')
  expect(sidebar.exists()).toBe(true)
  return sidebar
}

describe('Program nav: persistent sidebar', () => {
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

  it('renders the sidebar on the Program landing: a Finished entry above the Module list', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585')

    const sidebar = programSidebar(wrapper)
    const links = sidebar.findAll('a')
    const labels = links.map((link) => link.text())
    expect(labels).toContain('Finished')
    expect(labels).toContain('Module 01')
    expect(labels).toContain('Module 02')

    const finishedIndex = labels.indexOf('Finished')
    const firstModuleIndex = labels.indexOf('Module 01')
    expect(finishedIndex).toBeGreaterThan(-1)
    expect(firstModuleIndex).toBeGreaterThan(finishedIndex)
  })

  it('keeps the sidebar present and pointing at the same Modules when a Module or Finished is open', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper, router } = await mountAppAtPath('/programs/585')

    const moduleLink = programSidebar(wrapper)
      .findAll('a')
      .find((link) => link.text() === 'Module 01')
    await moduleLink!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('program-module')
    expect(programSidebar(wrapper).findAll('a').map((link) => link.text()))
      .toEqual(expect.arrayContaining(['Finished', 'Module 01', 'Module 02']))

    const finishedLink = programSidebar(wrapper)
      .findAll('a')
      .find((link) => link.text() === 'Finished')
    await finishedLink!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('program-finished')
    expect(programSidebar(wrapper).findAll('a').map((link) => link.text()))
      .toEqual(expect.arrayContaining(['Finished', 'Module 01', 'Module 02']))
  })

  it('returns to the landing aggregate from the sidebar', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper, router } = await mountAppAtPath('/programs/585/modules/101')

    const landingLink = programSidebar(wrapper)
      .findAll('a')
      .find((link) => link.text() === 'Due soon')
    await landingLink!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('program')
    expect(wrapper.find('h1').text()).toBe('Vue & the Modern Web')
  })

  it('excludes Done Modules from the sidebar Module list (nothing can be marked Done yet, so all show today)', async () => {
    seedDoneState(585, { lessons: [7] })
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585')

    const labels = programSidebar(wrapper).findAll('a').map((link) => link.text())
    expect(labels).toContain('Module 01')
    expect(labels).not.toContain('Module 02')
  })

  it('marks the active sidebar entry with aria-current', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper, router } = await mountAppAtPath('/programs/585/finished')

    const finishedLink = programSidebar(wrapper)
      .findAll('a')
      .find((link) => link.text() === 'Finished')
    expect(finishedLink!.attributes()['aria-current']).toBe('page')

    await router.push({ name: 'program-module', params: { programId: '585', moduleId: '101' } })
    await flushPromises()
    const moduleLink = programSidebar(wrapper)
      .findAll('a')
      .find((link) => link.text() === 'Module 01')
    expect(moduleLink!.attributes()['aria-current']).toBe('page')
    const otherModuleLink = programSidebar(wrapper)
      .findAll('a')
      .find((link) => link.text() === 'Module 02')
    expect(otherModuleLink!.attributes()['aria-current']).toBeUndefined()
  })
})

describe('Program nav: landing due-soon aggregate', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-15T10:00:00Z'))
    localStorage.clear()
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token123')
    savePrograms([{ courseId: 585, name: 'Vue & the Modern Web', archived: false }])
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows the Program name as the hero heading when no Module is selected', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585')

    expect(wrapper.find('h1').text()).toBe('Vue & the Modern Web')
  })

  it('falls back to a generic heading when the Program is not in the stored list', async () => {
    fetchMock.mockResolvedValue(assignmentsResponse([]))
    const { wrapper } = await mountAppAtPath('/programs/999')

    expect(wrapper.find('h1').text()).toBe('Program')
  })

  it('aggregates the whole Program\'s Assignments into today / this-week / later / undated groups, fetched through the proxy with the token', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585')

    expect(fetchMock).toHaveBeenCalled()
    const calls = fetchMock.mock.calls as [string, RequestInit][]
    const assignmentCall = calls.find(([url]) => url.includes('/assignments'))
    expect(assignmentCall![0]).toBe(
      '/api/v1/courses/585/assignments?order_by=due_at&per_page=100',
    )
    expect(assignmentCall![1].headers).toMatchObject({ Authorization: 'Bearer token123' })

    const today = wrapper.find('[data-testid="assignments-today"]')
    expect(today.exists()).toBe(true)
    expect(today.text()).toContain('Reading quiz')
    expect(today.text()).toContain('Overdue worksheet')
    expect(today.text()).not.toContain('Lab report')

    const thisWeek = wrapper.find('[data-testid="assignments-this-week"]')
    expect(thisWeek.exists()).toBe(true)
    expect(thisWeek.text()).toContain('Lab report')

    const later = wrapper.find('[data-testid="assignments-later"]')
    expect(later.exists()).toBe(true)
    expect(later.text()).toContain('Capstone brief')

    const undated = wrapper.find('[data-testid="assignments-undated"]')
    expect(undated.exists()).toBe(true)
    expect(undated.text()).toContain('Undated placeholder')
  })

  it('shows counts on the due-date group headings', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585')

    expect(wrapper.find('[data-testid="assignments-today"] h2').text()).toBe('Today (2)')
    expect(wrapper.find('[data-testid="assignments-this-week"] h2').text()).toBe('This week (1)')
    expect(wrapper.find('[data-testid="assignments-later"] h2').text()).toBe('Later (1)')
    expect(wrapper.find('[data-testid="assignments-undated"] h2').text()).toBe('No due date')
  })

  it('excludes Done Assignments from the landing aggregate', async () => {
    seedDoneState(585, { assignments: [18] })
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585')

    const today = wrapper.find('[data-testid="assignments-today"]')
    expect(today.text()).toContain('Overdue worksheet')
    expect(today.text()).not.toContain('Reading quiz')
    expect(wrapper.find('[data-testid="assignments-today"] h2').text()).toBe('Today (1)')
  })

  it('follows Link-header pagination when fetching the landing aggregate', async () => {
    let assignmentCalls = 0
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/modules')) {
        return Promise.resolve(modulesResponse(PROGRAM_FIXTURE))
      }
      if (url.includes('/assignments')) {
        if (url.includes('page=2')) {
          return Promise.resolve(
            assignmentsResponse([
              { id: 30, name: 'Capstone brief', due_at: '2026-10-15T10:00:00Z' },
            ]),
          )
        }
        assignmentCalls += 1
        if (assignmentCalls === 1) {
          return Promise.resolve(
            assignmentsResponse(
              [{ id: 18, name: 'Reading quiz', due_at: '2026-09-15T11:00:00Z' }],
              `<${CANVAS_ORIGIN}/api/v1/courses/585/assignments?order_by=due_at&per_page=100&page=2>; rel="next"`,
            ),
          )
        }
        return Promise.resolve(assignmentsResponse([]))
      }
      return Promise.resolve(assignmentsResponse([]))
    })
    const { wrapper } = await mountAppAtPath('/programs/585')

    const calls = fetchMock.mock.calls as [string][]
    expect(calls.filter(([url]) => url.includes('/assignments')).map(([url]) => url))
      .toEqual([
        '/api/v1/courses/585/assignments?order_by=due_at&per_page=100',
        '/api/v1/courses/585/assignments?order_by=due_at&per_page=100&page=2',
      ])
    expect(wrapper.find('[data-testid="assignments-today"]').text()).toContain('Reading quiz')
    expect(wrapper.find('[data-testid="assignments-later"]').text()).toContain('Capstone brief')
  })
})

describe('Program nav: Module tabbed view', () => {
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

  it('shows the Module name as the hero heading and defaults to the Lessons tab, scoped to that Module only', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    expect(wrapper.find('h1').text()).toBe('Module 01')
    const lessons = wrapper.find('[data-testid="module-tab-lessons"]')
    expect(lessons.attributes()['aria-current']).toBe('page')

    expect(wrapper.text()).toContain('Intro to Vue')
    expect(wrapper.text()).not.toContain('Components in depth')
  })

  it('renders Page items as reading links within the Lessons tab', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper, router } = await mountAppAtPath('/programs/585/modules/101')

    const pageLink = wrapper.find('a[href="/programs/585/read/2"]')
    expect(pageLink.exists()).toBe(true)
    expect(pageLink.text()).toBe('Intro to Vue')

    await pageLink.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('reading')
  })

  it('renders SubHeader items as dividers and link-out item types as external Canvas links inside the Lessons tab', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    const divider = wrapper.findAll('[data-testid="subheader-divider"]')[0]
    expect(divider).toBeDefined()
    expect(divider!.text()).toContain('Getting started')
    expect(divider!.find('a').exists()).toBe(false)

    const docsLink = wrapper.find('a[href="https://developer.mozilla.org/en-US/docs/Web"]')
    expect(docsLink.text()).toContain('Useful docs')
    expect(docsLink.attributes()['target']).toBe('_blank')

    const quizLink = wrapper.find('a[href*="/courses/585/modules/items/5"]')
    expect(quizLink.text()).toContain('Chapter check')
    expect(quizLink.attributes()['target']).toBe('_blank')
  })

  it('the Assignments tab lists only that Module\'s Assignment items, and tab switching preserves the Module', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper, router } = await mountAppAtPath('/programs/585/modules/101')

    const assignmentsTab = wrapper.find('[data-testid="module-tab-assignments"]')
    await assignmentsTab.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('program-module')
    expect(
      (router.currentRoute.value.params as Record<string, string>).moduleId,
    ).toBe('101')
    expect(wrapper.text()).toContain('Lab 1')
    expect(wrapper.text()).not.toContain('Intro to Vue')
    expect(wrapper.text()).not.toContain('Components in depth')
    expect(wrapper.find('[data-testid="module-tab-assignments"]').attributes()['aria-current']).toBe('page')
  })

  it('an empty tab shows an explicit empty state', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/102')

    const assignmentsTab = wrapper.find('[data-testid="module-tab-assignments"]')
    await assignmentsTab.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('No Assignments in this Module.')
  })

  it('excludes Done Lessons and Done Assignments from the Module tabs', async () => {
    seedDoneState(585, { lessons: [2], assignments: [3] })
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/modules/101')

    expect(wrapper.text()).not.toContain('Intro to Vue')
    // non-Page items are not Done-able; they stay put in the Lessons tab
    expect(wrapper.text()).toContain('Useful docs')

    const assignmentsTab = wrapper.find('[data-testid="module-tab-assignments"]')
    await assignmentsTab.trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('Lab 1')
    expect(wrapper.text()).toContain('No Assignments in this Module.')
  })
})

describe('Program nav: Finished', () => {
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

  it('selecting Finished shows the currently empty flat Done list for the Program', async () => {
    stubProgramFetch(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/finished')

    expect(wrapper.find('h1').text()).toBe('Finished')
    expect(wrapper.text()).toContain('Nothing Done yet.')
    expect(wrapper.findAll('li')).toHaveLength(0)
  })
})

describe('Program nav: deep links and legacy routes', () => {
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

  it('a deep link straight into a Lesson\'s reading view works unchanged', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/modules')) {
        return Promise.resolve(modulesResponse(PROGRAM_FIXTURE))
      }
      if (url.endsWith('/pages/intro-to-vue')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ url: 'intro-to-vue', title: 'Intro to Vue', body: '<p>A composable owns state.</p>' }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        )
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })
    const { wrapper } = await mountAppAtPath('/programs/585/read/2')

    expect(wrapper.find('h1').text()).toBe('Intro to Vue')
    expect(wrapper.find('article').text()).toContain('A composable owns state.')
    const backLink = wrapper.find('a[href="/programs/585/modules/101"]')
    expect(backLink.exists()).toBe(true)
    expect(backLink.text()).toContain('Module 01')
  })

  it.each([
    '/programs/585/modules',
    '/programs/585/assignments',
  ])('the legacy flat route %s lands on the Program landing aggregate', async (legacyPath) => {
    stubProgramFetch(fetchMock)
    const { wrapper, router } = await mountAppAtPath(legacyPath)

    expect(router.currentRoute.value.name).toBe('program')
    expect(wrapper.find('h1').text()).toBe('Vue & the Modern Web')
    expect(wrapper.find('[data-testid="assignments-today"]').exists()).toBe(true)
  })
})

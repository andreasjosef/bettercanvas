import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { modulesResponse, mountAppAtPath } from '../test/appHarness'
import { savePrograms } from '../programs'
import { TOKEN_STORAGE_KEY } from '../token'

const CANVAS_ORIGIN = 'https://chasacademy.instructure.com'

const SIX_ITEM_TYPES_FIXTURE = [
  {
    id: 101,
    name: 'Module 01',
    position: 1,
    items_count: 8,
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
      {
        id: 6,
        type: 'ExternalTool',
        title: 'Playground',
        html_url: `${CANVAS_ORIGIN}/courses/585/modules/items/6`,
      },
      {
        id: 8,
        type: 'File',
        title: 'Slide deck',
        html_url: `${CANVAS_ORIGIN}/courses/585/files/8`,
      },
      {
        id: 9,
        type: 'Discussion',
        title: 'Q&A thread',
        html_url: `${CANVAS_ORIGIN}/courses/585/discussion_topics/9`,
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

describe('ProgramModulesView', () => {
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

  it('lists the Program\'s Modules in Canvas order, fetching through the proxy with the token', async () => {
    fetchMock.mockResolvedValue(modulesResponse(SIX_ITEM_TYPES_FIXTURE))
    const { wrapper } = await mountAppAtPath('/programs/585/modules')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/courses/585/modules?include[]=items&per_page=100')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token123' })

    const text = wrapper.text()
    const firstModuleIndex = text.indexOf('Module 01')
    const secondModuleIndex = text.indexOf('Module 02')
    expect(firstModuleIndex).toBeGreaterThan(-1)
    expect(secondModuleIndex).toBeGreaterThan(firstModuleIndex)
  })

  it('shows the Program\'s name as the hero heading instead of a generic "Modules" label', async () => {
    fetchMock.mockResolvedValue(modulesResponse(SIX_ITEM_TYPES_FIXTURE))
    const { wrapper } = await mountAppAtPath('/programs/585/modules')

    expect(wrapper.find('h1').text()).toBe('Vue & the Modern Web')
  })

  it('offers a tab bar under the heading with Modules active and navigation to Assignments, preserving the Program', async () => {
    fetchMock.mockResolvedValue(modulesResponse(SIX_ITEM_TYPES_FIXTURE))
    const { wrapper, router } = await mountAppAtPath('/programs/585/modules')

    const tabs = wrapper.find('[data-testid="program-tabs"]')
    expect(tabs.exists()).toBe(true)

    const modulesTab = tabs.find('[data-testid="tab-modules"]')
    const assignmentsTab = tabs.find('[data-testid="tab-assignments"]')
    expect(modulesTab.text()).toBe('Modules')
    expect(assignmentsTab.text()).toBe('Assignments')
    expect(modulesTab.attributes('aria-current')).toBe('page')
    expect(assignmentsTab.attributes('aria-current')).toBeUndefined()

    await assignmentsTab.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('program-assignments')
    expect(
      (router.currentRoute.value.params as Record<string, string>).programId,
    ).toBe('585')
  })

  it('routes Page and Assignment items toward the reading view', async () => {
    fetchMock.mockResolvedValue(modulesResponse(SIX_ITEM_TYPES_FIXTURE))
    const { wrapper, router } = await mountAppAtPath('/programs/585/modules')

    const pageLink = wrapper.find('a[href="/programs/585/read/2"]')
    const assignmentLink = wrapper.find('a[href="/programs/585/read/3"]')
    expect(pageLink.text()).toBe('Intro to Vue')
    expect(assignmentLink.text()).toBe('Lab 1')

    await assignmentLink.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('reading')
    expect(
      (router.currentRoute.value.params as Record<string, string>).itemId,
    ).toBe('3')
  })

  it('renders File, Discussion, Quiz, ExternalTool and ExternalUrl items as external links to Canvas, not inline content', async () => {
    fetchMock.mockResolvedValue(modulesResponse(SIX_ITEM_TYPES_FIXTURE))
    const { wrapper } = await mountAppAtPath('/programs/585/modules')

    const quizLink = wrapper.find('a[href*="/courses/585/modules/items/5"]')
    const toolLink = wrapper.find('a[href*="/courses/585/modules/items/6"]')
    const fileLink = wrapper.find('a[href*="/courses/585/files/8"]')
    const discussionLink = wrapper.find(
      'a[href*="/courses/585/discussion_topics/9"]',
    )
    const urlLink = wrapper.find(
      'a[href="https://developer.mozilla.org/en-US/docs/Web"]',
    )
    expect(quizLink.text()).toContain('Chapter check')
    expect(toolLink.text()).toContain('Playground')
    expect(fileLink.text()).toContain('Slide deck')
    expect(discussionLink.text()).toContain('Q&A thread')
    expect(urlLink.text()).toContain('Useful docs')
    for (const link of [quizLink, toolLink, fileLink, discussionLink, urlLink]) {
      expect(link.attributes('target')).toBe('_blank')
    }
    expect(wrapper.text()).not.toContain('Reading')
  })

  it('renders SubHeader items as plain dividers with no content', async () => {
    fetchMock.mockResolvedValue(modulesResponse(SIX_ITEM_TYPES_FIXTURE))
    const { wrapper } = await mountAppAtPath('/programs/585/modules')

    const divider = wrapper.findAll('[data-testid="subheader-divider"]').at(0)
    expect(divider).toBeDefined()
    expect(divider!.text()).toContain('Getting started')
    expect(divider!.find('a').exists()).toBe(false)
  })
})

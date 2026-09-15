import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assignmentsResponse,
  mountAppAtPath,
  type FakeAssignment,
} from '../test/appHarness'
import { TOKEN_STORAGE_KEY } from '../token'

const FIXED_NOW = new Date('2026-09-15T10:00:00Z')

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function dueIn(ms: number): string {
  return new Date(FIXED_NOW.getTime() + ms).toISOString()
}

const DUE_DATE_GROUPING_FIXTURE: FakeAssignment[] = [
  { id: 30, name: 'Capstone brief', due_at: dueIn(30 * DAY) },
  { id: 27, name: 'Undated placeholder', due_at: null },
  { id: 21, name: 'Lab report', due_at: dueIn(3 * DAY) },
  { id: 24, name: 'Essay draft', due_at: dueIn(14 * DAY) },
  { id: 18, name: 'Reading quiz', due_at: dueIn(2 * HOUR) },
  { id: 15, name: 'Overdue worksheet', due_at: dueIn(-2 * DAY) },
]

function sectionText(
  wrapper: { find: (selector: string) => { exists(): boolean; text(): string } },
  group: string,
): string {
  const section = wrapper.find(`[data-testid="assignments-${group}"]`)
  expect(section.exists()).toBe(true)
  return section.text()
}

describe('ProgramAssignmentsView', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_NOW)
    localStorage.clear()
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token123')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('groups the Program\'s Assignments into today / this-week / later by due_at, fetching through the proxy with the token', async () => {
    fetchMock.mockResolvedValue(assignmentsResponse(DUE_DATE_GROUPING_FIXTURE))
    const { wrapper } = await mountAppAtPath('/programs/585/assignments')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/courses/585/assignments?order_by=due_at&per_page=100')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token123' })

    const today = sectionText(wrapper, 'today')
    expect(today).toContain('Reading quiz')
    expect(today).not.toContain('Lab report')
    expect(today).not.toContain('Essay draft')
    expect(today).not.toContain('Capstone brief')

    const thisWeek = sectionText(wrapper, 'this-week')
    expect(thisWeek).toContain('Lab report')
    expect(thisWeek).not.toContain('Reading quiz')
    expect(thisWeek).not.toContain('Essay draft')

    const later = sectionText(wrapper, 'later')
    expect(later).toContain('Essay draft')
    expect(later).toContain('Capstone brief')
    expect(later).not.toContain('Reading quiz')
  })

  it('sorts each due-date group by due date', async () => {
    fetchMock.mockResolvedValue(assignmentsResponse(DUE_DATE_GROUPING_FIXTURE))
    const { wrapper } = await mountAppAtPath('/programs/585/assignments')

    const later = sectionText(wrapper, 'later')
    const essayIndex = later.indexOf('Essay draft')
    const capstoneIndex = later.indexOf('Capstone brief')
    expect(essayIndex).toBeGreaterThan(-1)
    expect(capstoneIndex).toBeGreaterThan(essayIndex)
  })

  it('renders undated Assignments in their own section, excluded from the three due-date groups', async () => {    fetchMock.mockResolvedValue(assignmentsResponse(DUE_DATE_GROUPING_FIXTURE))
    const { wrapper } = await mountAppAtPath('/programs/585/assignments')

    const undated = sectionText(wrapper, 'undated')
    expect(undated).toContain('Undated placeholder')

    for (const group of ['today', 'this-week', 'later']) {
      expect(sectionText(wrapper, group)).not.toContain('Undated placeholder')
    }
  })

  it('treats past-due Assignments as urgent, grouping them with today', async () => {
    fetchMock.mockResolvedValue(assignmentsResponse(DUE_DATE_GROUPING_FIXTURE))
    const { wrapper } = await mountAppAtPath('/programs/585/assignments')

    expect(sectionText(wrapper, 'today')).toContain('Overdue worksheet')
    expect(sectionText(wrapper, 'later')).not.toContain('Overdue worksheet')
  })

  it('shows counts on the three due-date groups, with the undated section excluded from counts', async () => {
    fetchMock.mockResolvedValue(assignmentsResponse(DUE_DATE_GROUPING_FIXTURE))
    const { wrapper } = await mountAppAtPath('/programs/585/assignments')

    expect(
      wrapper.find('[data-testid="assignments-today"] h2').text(),
    ).toBe('Today (2)')
    expect(
      wrapper.find('[data-testid="assignments-this-week"] h2').text(),
    ).toBe('This week (1)')
    expect(wrapper.find('[data-testid="assignments-later"] h2').text()).toBe(
      'Later (2)',
    )
    expect(
      wrapper.find('[data-testid="assignments-undated"] h2').text(),
    ).toBe('No due date')
  })

  it('follows Link-header pagination when fetching the Program\'s Assignments', async () => {
    fetchMock
      .mockResolvedValueOnce(
        assignmentsResponse(
          [{ id: 18, name: 'Reading quiz', due_at: dueIn(2 * HOUR) }],
          `<https://chasacademy.instructure.com/api/v1/courses/585/assignments?order_by=due_at&per_page=100&page=2>; rel="next"`,
        ),
      )
      .mockResolvedValueOnce(
        assignmentsResponse([
          { id: 30, name: 'Capstone brief', due_at: dueIn(30 * DAY) },
        ]),
      )
    const { wrapper } = await mountAppAtPath('/programs/585/assignments')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/v1/courses/585/assignments?order_by=due_at&per_page=100&page=2',
    )
    expect(sectionText(wrapper, 'today')).toContain('Reading quiz')
    expect(sectionText(wrapper, 'later')).toContain('Capstone brief')
  })
})

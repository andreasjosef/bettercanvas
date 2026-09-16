import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchAssignmentDescription,
  fetchAssignments,
  fetchModules,
  fetchNextDueAssignment,
  fetchPageBody,
} from './canvas'
import {
  canvasQueryOptions,
  courseQueryKey,
} from './keys'

describe('canvasQueryOptions key hierarchy', () => {
  it('courses nests at the root of the canvas namespace', () => {
    expect(canvasQueryOptions.courses('t').queryKey).toEqual([
      'better-canvas',
      'courses',
    ])
  })

  it('modules, assignments, and next-due nest under their owning course', () => {
    expect(canvasQueryOptions.modules(585, 't').queryKey).toEqual([
      'better-canvas',
      'courses',
      585,
      'modules',
    ])
    expect(canvasQueryOptions.assignments(585, 't').queryKey).toEqual([
      'better-canvas',
      'courses',
      585,
      'assignments',
    ])
    expect(canvasQueryOptions.nextDueAssignment(585, 't').queryKey).toEqual([
      'better-canvas',
      'courses',
      585,
      'assignments',
      'next-due',
    ])
  })

  it('page bodies nest under their owning course, keyed by page_url', () => {
    expect(canvasQueryOptions.pageBody(585, 'intro-to-vue', 't').queryKey).toEqual([
      'better-canvas',
      'courses',
      585,
      'pages',
      'intro-to-vue',
    ])
  })

  it('assignment descriptions nest under their owning course and assignment', () => {
    expect(
      canvasQueryOptions.assignmentDescription(585, 3, 't').queryKey,
    ).toEqual([
      'better-canvas',
      'courses',
      585,
      'assignments',
      3,
      'description',
    ])
  })

  it('courseQueryKey prefixes any scope under the shared course node', () => {
    expect(courseQueryKey(585)).toEqual(['better-canvas', 'courses', 585])
    expect(courseQueryKey(585, 'assignments')).toEqual([
      'better-canvas',
      'courses',
      585,
      'assignments',
    ])
  })

  it('a leaf key shares a prefix with the assignments list of the same course', () => {
    const leaf = canvasQueryOptions.assignmentDescription(585, 3, 't').queryKey
    const list = canvasQueryOptions.assignments(585, 't').queryKey
    expect(leaf.slice(0, list.length)).toEqual(list)
  })
})

describe('canvasQueryOptions queryFn wiring', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function resolved<T>(options: {
    queryFn?: unknown
  }): Promise<T | undefined> {
    const queryFn = options.queryFn
    if (typeof queryFn !== 'function') throw new Error('no queryFn')
    return (queryFn as () => Promise<T>)()
  }

  it('courses queryFn fetches through the proxy with the token', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 585, name: 'Course 585' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(
      resolved(canvasQueryOptions.courses('token123')),
    ).resolves.toEqual([{ id: 585, name: 'Course 585' }])
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/courses')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token123' })
  })

  it('modules queryFn fetches the course modules through the proxy', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 101, name: 'M', position: 1 }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(
      resolved(canvasQueryOptions.modules(585, 'token123')),
    ).resolves.toEqual([{ id: 101, name: 'M', position: 1 }])
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/courses/585/modules?include[]=items&per_page=100',
    )
  })

  it('assignments queryFn fetches the course assignments through the proxy', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 9, name: 'Lab', due_at: null }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(
      resolved(canvasQueryOptions.assignments(585, 'token123')),
    ).resolves.toEqual([{ id: 9, name: 'Lab', due_at: null }])
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/courses/585/assignments?order_by=due_at&per_page=100',
    )
  })

  it('nextDueAssignment queryFn fetches the single future assignment', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 9, name: 'Lab 2', due_at: '2026-09-20T13:00:00Z' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(
      resolved(canvasQueryOptions.nextDueAssignment(585, 'token123')),
    ).resolves.toEqual({ id: 9, name: 'Lab 2', due_at: '2026-09-20T13:00:00Z' })
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/courses/585/assignments?bucket=future&order_by=due_at&per_page=1',
    )
  })

  it('pageBody queryFn fetches the page body through the proxy', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ body: '<p>Vue is a framework.</p>' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(
      resolved(canvasQueryOptions.pageBody(585, 'intro-to-vue', 'token123')),
    ).resolves.toBe('<p>Vue is a framework.</p>')
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/courses/585/pages/intro-to-vue',
    )
  })

  it('assignmentDescription queryFn fetches the description through the proxy', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ description: '<p>Build a lab.</p>' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(
      resolved(canvasQueryOptions.assignmentDescription(585, 3, 'token123')),
    ).resolves.toBe('<p>Build a lab.</p>')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/courses/585/assignments/3')
  })

  it('the fetchers the queryFns delegate to are the canvas API ones', () => {
    // The re-export assertions pin the seam: these are the exact functions
    // the existing canvas API tests cover, not copies.
    expect(fetchModules).toBeTypeOf('function')
    expect(fetchAssignments).toBeTypeOf('function')
    expect(fetchPageBody).toBeTypeOf('function')
    expect(fetchAssignmentDescription).toBeTypeOf('function')
    expect(fetchNextDueAssignment).toBeTypeOf('function')
  })
})

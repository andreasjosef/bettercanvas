import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  fetchAssignmentDescription,
  fetchCourses,
  fetchModules,
  fetchNextDueAssignment,
  fetchPageBody,
  locateModuleItem,
  parseNextLink,
  setAuthFailureHandler,
} from './canvas.ts'

function htmlSpaFallbackResponse(): Response {
  return new Response(
    '<!doctype html><html><body><div id="app"></div></body></html>',
    { status: 200, headers: { 'content-type': 'text/html' } },
  )
}

const UPSTREAM_ORIGIN = 'https://chasacademy.instructure.com'

function jsonResponse(
  body: unknown,
  { status = 200, link }: { status?: number; link?: string } = {},
): Response {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (link) headers.set('link', link)
  return new Response(JSON.stringify(body), { status, headers })
}

describe('fetchCourses', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GETs /api/v1/courses through the proxy path only, relaying the token', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: 585, name: 'Course 585' }]))

    const courses = await fetchCourses('token123')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/courses')
    expect(url).not.toContain(UPSTREAM_ORIGIN)
    expect(init.method).toBe('GET')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token123' })
    expect(courses).toEqual([{ id: 585, name: 'Course 585' }])
  })

  it('follows the Link header rel="next" through the proxy until no next remains', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          [{ id: 1 }],
          {
            link: `<${UPSTREAM_ORIGIN}/api/v1/courses?page=2&per_page=5>; rel="next"`,
          },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          [{ id: 2 }],
          {
            link: `<${UPSTREAM_ORIGIN}/api/v1/courses?page=2&per_page=5>; rel="current", <${UPSTREAM_ORIGIN}/api/v1/courses?page=3&per_page=5>; rel="next"`,
          },
        ),
      )
      .mockResolvedValueOnce(jsonResponse([{ id: 3 }]))

    const courses = await fetchCourses('token123')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const [, secondInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ]
    const [thirdUrl] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(secondInit.headers).toMatchObject({ Authorization: 'Bearer token123' })
    expect(thirdUrl).toBe('/api/v1/courses?page=3&per_page=5')
    expect(thirdUrl).not.toContain(UPSTREAM_ORIGIN)
    expect(courses).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
  })

  it('throws a CanvasError carrying the status for a 401 response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'Invalid token' }, { status: 401 }),
    )

    await expect(fetchCourses('bad-token')).rejects.toMatchObject({
      name: 'CanvasError',
      status: 401,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('throws ProxyUnreachableError on a 200 non-JSON response (e.g. the SPA fallback when no proxy/rewrite is in front of it, as with plain `vite dev` and no deploy)', async () => {
    fetchMock.mockResolvedValue(htmlSpaFallbackResponse())

    await expect(fetchCourses('token123')).rejects.toMatchObject({
      name: 'ProxyUnreachableError',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe('fetchNextDueAssignment', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GETs the Course\'s future assignments, soonest due first, one per page, through the proxy', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { id: 9, name: 'Lab 2', due_at: '2026-09-20T13:00:00Z' },
      ]),
    )

    const nextDue = await fetchNextDueAssignment('token123', 585)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      '/api/v1/courses/585/assignments?bucket=future&order_by=due_at&per_page=1',
    )
    expect(url).not.toContain(UPSTREAM_ORIGIN)
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token123' })
    expect(nextDue).toEqual({
      id: 9,
      name: 'Lab 2',
      due_at: '2026-09-20T13:00:00Z',
    })
  })

  it('returns null when the Course has no future-dated Assignments', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    await expect(fetchNextDueAssignment('token123', 585)).resolves.toBeNull()
  })

  it('throws a CanvasError carrying the status for a 401 response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'Invalid token' }, { status: 401 }),
    )

    await expect(
      fetchNextDueAssignment('bad-token', 585),
    ).rejects.toMatchObject({ name: 'CanvasError', status: 401 })
  })
})

describe('fetchModules', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GETs the Course\'s Modules with their items included, through the proxy, relaying the token', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        {
          id: 101,
          name: 'Module 01',
          position: 1,
          items_count: 2,
          items: [
            { id: 1, type: 'SubHeader', title: 'Getting started' },
            { id: 2, type: 'Page', title: 'Intro to Vue', page_url: 'intro-to-vue' },
          ],
        },
      ]),
    )

    const modules = await fetchModules('token123', 585)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/courses/585/modules?include[]=items&per_page=100')
    expect(url).not.toContain(UPSTREAM_ORIGIN)
    expect(init.method).toBe('GET')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token123' })
    expect(modules).toEqual([
      {
        id: 101,
        name: 'Module 01',
        position: 1,
        items_count: 2,
        items: [
          { id: 1, type: 'SubHeader', title: 'Getting started' },
          { id: 2, type: 'Page', title: 'Intro to Vue', page_url: 'intro-to-vue' },
        ],
      },
    ])
  })

  it('follows the Link header rel="next" through the proxy until no next remains', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([{ id: 101, name: 'Module 01', position: 1, items: [] }], {
          link: `<${UPSTREAM_ORIGIN}/api/v1/courses/585/modules?page=2&per_page=100>; rel="next"`,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse([{ id: 102, name: 'Module 02', position: 2, items: [] }]),
      )

    const modules = await fetchModules('token123', 585)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [secondUrl] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(secondUrl).toBe('/api/v1/courses/585/modules?page=2&per_page=100')
    expect(secondUrl).not.toContain(UPSTREAM_ORIGIN)
    expect(modules).toEqual([
      { id: 101, name: 'Module 01', position: 1, items: [] },
      { id: 102, name: 'Module 02', position: 2, items: [] },
    ])
  })

  it('throws a CanvasError carrying the status for a 401 response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'Invalid token' }, { status: 401 }),
    )

    await expect(fetchModules('bad-token', 585)).rejects.toMatchObject({
      name: 'CanvasError',
      status: 401,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe('fetchPageBody', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GETs the Course Page by its page_url through the proxy, relaying the token', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ url: 'intro-to-vue', title: 'Intro to Vue', body: '<p>Vue is a framework.</p>' }),
    )

    const body = await fetchPageBody('token123', 585, 'intro-to-vue')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/courses/585/pages/intro-to-vue')
    expect(url).not.toContain(UPSTREAM_ORIGIN)
    expect(init.method).toBe('GET')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token123' })
    expect(body).toBe('<p>Vue is a framework.</p>')
  })

  it('URL-encodes the page_url slug in the proxy path', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ body: '<p>x</p>' }))

    await fetchPageBody('token123', 585, 'spaces & weird chars')

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/courses/585/pages/spaces%20%26%20weird%20chars')
  })

  it('returns null for an unpublished Page with no body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ url: 'draft', title: 'Draft', body: null }))

    await expect(fetchPageBody('token123', 585, 'draft')).resolves.toBeNull()
  })

  it('throws a CanvasError carrying the status for a 401 response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'Invalid token' }, { status: 401 }),
    )

    await expect(
      fetchPageBody('bad-token', 585, 'intro-to-vue'),
    ).rejects.toMatchObject({ name: 'CanvasError', status: 401 })
  })
})

describe('fetchAssignmentDescription', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GETs the Assignment detail by content id through the proxy, relaying the token', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: 3, name: 'Lab 1', description: '<p>Build a lab.</p>' }),
    )

    const description = await fetchAssignmentDescription('token123', 585, 3)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/courses/585/assignments/3')
    expect(url).not.toContain(UPSTREAM_ORIGIN)
    expect(init.method).toBe('GET')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token123' })
    expect(description).toBe('<p>Build a lab.</p>')
  })

  it('returns null for an Assignment with no description', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 3, name: 'Lab 1', description: null }))

    await expect(
      fetchAssignmentDescription('token123', 585, 3),
    ).resolves.toBeNull()
  })

  it('throws a CanvasError carrying the status for a 401 response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'Invalid token' }, { status: 401 }),
    )

    await expect(
      fetchAssignmentDescription('bad-token', 585, 3),
    ).rejects.toMatchObject({ name: 'CanvasError', status: 401 })
  })
})

describe('locateModuleItem', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('finds an item by id across all of the Course\'s Modules and returns the Module that contains it', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        {
          id: 101,
          name: 'Module 01',
          position: 1,
          items: [
            { id: 1, type: 'SubHeader', title: 'Getting started' },
            {
              id: 2,
              type: 'Page',
              title: 'Intro to Vue',
              page_url: 'intro-to-vue',
              content_id: 400,
            },
          ],
        },
        {
          id: 102,
          name: 'Module 02',
          position: 2,
          items: [
            { id: 7, type: 'Assignment', title: 'Lab 1', content_id: 3 },
          ],
        },
      ]),
    )

    const found = await locateModuleItem('token123', 585, 7)

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/courses/585/modules?include[]=items&per_page=100')
    expect(found).toEqual({
      item: { id: 7, type: 'Assignment', title: 'Lab 1', content_id: 3 },
      module: { id: 102, name: 'Module 02', position: 2, items: [{ id: 7, type: 'Assignment', title: 'Lab 1', content_id: 3 }] },
    })
  })

  it('resolves to null when no Module item with that id exists', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { id: 101, name: 'Module 01', position: 1, items: [{ id: 1, type: 'SubHeader', title: 'x' }] },
      ]),
    )

    await expect(locateModuleItem('token123', 585, 999)).resolves.toBeNull()
  })
})

describe('auth-failure handler', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let handler: Mock<() => void>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    handler = vi.fn()
    setAuthFailureHandler(handler)
  })

  afterEach(() => {
    setAuthFailureHandler(null)
    vi.unstubAllGlobals()
  })

  it('invokes the handler once for a 401 and still throws CanvasError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'Invalid token' }, { status: 401 }),
    )

    await expect(fetchCourses('bad-token')).rejects.toMatchObject({
      name: 'CanvasError',
      status: 401,
    })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('invokes the handler for a 403 as well', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'Forbidden' }, { status: 403 }),
    )

    await expect(fetchNextDueAssignment('bad-token', 585)).rejects.toMatchObject(
      { name: 'CanvasError', status: 403 },
    )
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not invoke the handler for other error statuses', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'Boom' }, { status: 500 }),
    )

    await expect(fetchCourses('token123')).rejects.toMatchObject({
      name: 'CanvasError',
      status: 500,
    })
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('parseNextLink', () => {
  it('extracts the rel="next" URL from a Canvas Link header', () => {
    const header = [
      `<${UPSTREAM_ORIGIN}/api/v1/courses?page=1&per_page=5>; rel="current"`,
      `<${UPSTREAM_ORIGIN}/api/v1/courses?page=2&per_page=5>; rel="next"`,
      `<${UPSTREAM_ORIGIN}/api/v1/courses?page=1&per_page=5>; rel="first"`,
    ].join(', ')

    expect(parseNextLink(header)).toBe(
      `${UPSTREAM_ORIGIN}/api/v1/courses?page=2&per_page=5`,
    )
  })

  it('extracts rel="next" regardless of parameter order or quote style', () => {
    const header = `<${UPSTREAM_ORIGIN}/api/v1/courses?page=2>; title="Page 2"; rel='next'`

    expect(parseNextLink(header)).toBe(
      `${UPSTREAM_ORIGIN}/api/v1/courses?page=2`,
    )
  })

  it('returns null when there is no rel="next"', () => {
    expect(
      parseNextLink(`<${UPSTREAM_ORIGIN}/api/v1/courses?page=1>; rel="current"`),
    ).toBeNull()
    expect(parseNextLink(null)).toBeNull()
  })
})

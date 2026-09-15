import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCourses, parseNextLink } from './canvas.ts'

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

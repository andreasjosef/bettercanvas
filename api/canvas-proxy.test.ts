// @vitest-environment node
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './canvas-proxy.ts'

const UPSTREAM = 'https://chasacademy.instructure.com'

interface CapturedResponse {
  statusCode?: number
  headers: Record<string, string>
  body?: unknown
  ended: boolean
}

function makeReq(
  method: string,
  url: string,
  headers: Record<string, string> = {},
): VercelRequest {
  return { method, url, headers } as unknown as VercelRequest
}

function makeRes(): { res: VercelResponse; captured: CapturedResponse } {
  const captured: CapturedResponse = { headers: {}, ended: false }
  const res = {
    setHeader(name: string, value: string) {
      captured.headers[name.toLowerCase()] = value
    },
    status(code: number) {
      captured.statusCode = code
      return this
    },
    json(body: unknown) {
      captured.body = body
      captured.ended = true
      return this
    },
    send(body: unknown) {
      captured.body = body
      captured.ended = true
      return this
    },
    end() {
      captured.ended = true
      return this
    },
  }
  return { res: res as unknown as VercelResponse, captured }
}

describe('canvas proxy handler', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let res: VercelResponse
  let captured: CapturedResponse

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    ;({ res, captured } = makeRes())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects requests with no Authorization header with 401, without proxying', async () => {
    await handler(makeReq('GET', '/api/v1/courses'), res)

    expect(captured.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects empty Authorization headers too', async () => {
    await handler(makeReq('GET', '/api/v1/courses', { authorization: '' }), res)

    expect(captured.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards path and query string unchanged, relaying Authorization', async () => {
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))
    await handler(
      makeReq('GET', '/api/v1/courses?page=2&per_page=50', {
        authorization: 'Bearer token123',
      }),
      res,
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toBe(`${UPSTREAM}/api/v1/courses?page=2&per_page=50`)
    expect(init.method).toBe('GET')
    expect(init.headers).toMatchObject({ authorization: 'Bearer token123' })
  })

  it('forwards the HTTP method unchanged for non-GET requests', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"id":1}', { status: 201 }),
    )
    await handler(
      makeReq('POST', '/api/v1/courses/1/enrollments', {
        authorization: 'Bearer token123',
      }),
      res,
    )

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
  })

  it('relays upstream status, body and content-type, with CORS headers set', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"courses":[]}', {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    )
    await handler(
      makeReq('GET', '/api/v1/courses', { authorization: 'Bearer t' }),
      res,
    )

    expect(captured.statusCode).toBe(200)
    expect(captured.body).toEqual(Buffer.from('{"courses":[]}'))
    expect(captured.headers['content-type']).toBe(
      'application/json; charset=utf-8',
    )
    expect(captured.headers['access-control-allow-origin']).toBe('*')
    expect(captured.headers['access-control-allow-methods']).toContain('GET')
    expect(captured.headers['access-control-allow-headers']).toContain(
      'Authorization',
    )
  })

  it('relays upstream error statuses (e.g. 401 from Canvas)', async () => {
    fetchMock.mockResolvedValue(
      new Response('Invalid token', { status: 401 }),
    )
    await handler(
      makeReq('GET', '/api/v1/courses', { authorization: 'Bearer bad' }),
      res,
    )

    expect(captured.statusCode).toBe(401)
    expect(captured.body).toEqual(Buffer.from('Invalid token'))
  })

  it('answers CORS preflight (OPTIONS) itself without proxying', async () => {
    await handler(
      makeReq('OPTIONS', '/api/v1/courses', {
        authorization: 'Bearer t',
      }),
      res,
    )

    expect(captured.statusCode).toBe(204)
    expect(captured.headers['access-control-allow-origin']).toBe('*')
    expect(captured.headers['access-control-allow-headers']).toContain(
      'Authorization',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects paths outside /api/v1 with 404, without proxying', async () => {
    await handler(
      makeReq('GET', '/other/path', { authorization: 'Bearer t' }),
      res,
    )

    expect(captured.statusCode).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

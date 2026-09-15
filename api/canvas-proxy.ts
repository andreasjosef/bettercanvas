import type { VercelRequest, VercelResponse } from '@vercel/node'

export const UPSTREAM_BASE_URL = 'https://chasacademy.instructure.com'

const RELAYED_RESPONSE_HEADERS = ['content-type', 'link']

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

function setCorsHeaders(res: VercelResponse): void {
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(name, value)
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const authorization = req.headers.authorization
  if (!authorization) {
    res.status(401).json({ error: 'Missing Authorization header' })
    return
  }

  const url = new URL(req.url ?? '/', 'https://proxy.invalid')
  if (!url.pathname.startsWith('/api/v1/')) {
    res.status(404).json({ error: 'Only /api/v1/* paths are proxied' })
    return
  }

  const headers: Record<string, string> = {
    authorization,
    accept: req.headers.accept ?? 'application/json',
  }
  if (req.headers['content-type']) {
    headers['content-type'] = req.headers['content-type']
  }
  const init: RequestInit = { method: req.method, headers }

  const body = serializeBody(req.body)
  if (body !== undefined) {
    init.body = body
    if (!headers['content-type']) {
      headers['content-type'] = 'application/json'
    }
  }

  const upstream = await fetch(
    `${UPSTREAM_BASE_URL}${url.pathname}${url.search}`,
    init,
  )

  res.status(upstream.status)
  for (const name of RELAYED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) {
      res.setHeader(name, value)
    }
  }
  res.send(Buffer.from(await upstream.arrayBuffer()))
}

function serializeBody(body: unknown): string | undefined {
  if (body === undefined || body === null) {
    return undefined
  }
  if (typeof body === 'string') {
    return body
  }
  return JSON.stringify(body)
}

import type { VercelRequest, VercelResponse } from '@vercel/node'

const UPSTREAM_BASE_URL = 'https://chasacademy.instructure.com'

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

  const upstream = await fetch(`${UPSTREAM_BASE_URL}${url.pathname}${url.search}`, {
    method: req.method,
    headers: { authorization, accept: req.headers.accept ?? 'application/json' },
  })

  res.status(upstream.status)
  const contentType = upstream.headers.get('content-type')
  if (contentType) {
    res.setHeader('Content-Type', contentType)
  }
  res.send(Buffer.from(await upstream.arrayBuffer()))
}

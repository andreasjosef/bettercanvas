const PROXY_API_PREFIX = '/api/v1/'

export class CanvasError extends Error {
  readonly status: number

  constructor(status: number, message?: string) {
    super(message ?? `Canvas API request failed with status ${status}`)
    this.name = 'CanvasError'
    this.status = status
  }
}

export interface Course {
  id: number
  name: string
  workflow_state?: string
}

async function canvasFetch(token: string, proxyPath: string): Promise<Response> {
  const response = await fetch(proxyPath, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  if (!response.ok) {
    throw new CanvasError(response.status)
  }
  return response
}

export async function fetchCourses(token: string): Promise<Course[]> {
  const courses: Course[] = []
  let path: string | null = '/api/v1/courses'
  while (path) {
    const response = await canvasFetch(token, path)
    const page = (await response.json()) as Course[]
    courses.push(...page)
    path = proxyPathFromNextLink(response.headers.get('link'))
  }
  return courses
}

export function proxyPathFromNextLink(linkHeader: string | null): string | null {
  const next = parseNextLink(linkHeader)
  if (!next) return null
  const url = new URL(next, 'https://proxy.invalid')
  if (!url.pathname.startsWith(PROXY_API_PREFIX)) {
    throw new CanvasError(0, `Refusing to follow next link outside /api/v1: ${next}`)
  }
  return `${url.pathname}${url.search}`
}

export function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  for (const part of linkHeader.split(',')) {
    const match = /<([^>]*)>\s*;\s*rel="([^"]*)"/.exec(part.trim())
    if (match && match[2] === 'next') {
      return match[1]
    }
  }
  return null
}

const PROXY_API_PREFIX = '/api/v1/'

export class CanvasError extends Error {
  readonly status: number

  constructor(status: number, message?: string) {
    super(message ?? `Canvas API request failed with status ${status}`)
    this.name = 'CanvasError'
    this.status = status
  }
}

export class ProxyUnreachableError extends Error {
  constructor() {
    super('Canvas proxy returned a non-JSON response')
    this.name = 'ProxyUnreachableError'
  }
}

export interface Course {
  id: number
  name: string
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
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new ProxyUnreachableError()
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

export interface Assignment {
  id: number
  name: string
  due_at: string | null
}

export async function fetchNextDueAssignment(
  token: string,
  courseId: number,
): Promise<Assignment | null> {
  const response = await canvasFetch(
    token,
    `/api/v1/courses/${courseId}/assignments?bucket=future&order_by=due_date&per_page=1`,
  )
  const page = (await response.json()) as Assignment[]
  return page[0] ?? null
}

export function proxyPathFromNextLink(linkHeader: string | null): string | null {
  const next = parseNextLink(linkHeader)
  if (!next) return null
  const url = new URL(next, 'https://proxy.invalid')
  if (!url.pathname.startsWith(PROXY_API_PREFIX)) {
    throw new Error(`Refusing to follow next link outside /api/v1: ${next}`)
  }
  return `${url.pathname}${url.search}`
}

export function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  for (const part of linkHeader.split(',')) {
    const url = /<([^>]*)>/.exec(part)
    if (url && /;\s*rel\s*=\s*(?:"next"|'next')/.test(part)) {
      return url[1]
    }
  }
  return null
}

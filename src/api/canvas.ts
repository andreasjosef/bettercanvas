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

export type AuthFailureHandler = () => void

let authFailureHandler: AuthFailureHandler | null = null

export function setAuthFailureHandler(handler: AuthFailureHandler | null): void {
  authFailureHandler = handler
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
    if (response.status === 401 || response.status === 403) {
      authFailureHandler?.()
    }
    throw new CanvasError(response.status)
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new ProxyUnreachableError()
  }
  return response
}

export async function fetchCourses(token: string): Promise<Course[]> {
  return fetchAllPages<Course>(token, '/api/v1/courses')
}

export interface ModuleItem {
  id: number
  type: ModuleItemType
  title: string
  page_url?: string
  html_url?: string
  external_url?: string
}

export type ModuleItemType =
  | 'Page'
  | 'Assignment'
  | 'SubHeader'
  | 'ExternalUrl'
  | 'Quiz'
  | 'ExternalTool'
  | 'File'
  | 'Discussion'

export interface CourseModule {
  id: number
  name: string
  position: number
  items?: ModuleItem[]
}

export async function fetchModules(
  token: string,
  courseId: number,
): Promise<CourseModule[]> {
  return fetchAllPages<CourseModule>(
    token,
    `/api/v1/courses/${courseId}/modules?include[]=items&per_page=100`,
  )
}

async function fetchAllPages<T>(token: string, startPath: string): Promise<T[]> {
  const results: T[] = []
  let path: string | null = startPath
  while (path) {
    const response = await canvasFetch(token, path)
    const page = (await response.json()) as T[]
    results.push(...page)
    path = proxyPathFromNextLink(response.headers.get('link'))
  }
  return results
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
    `/api/v1/courses/${courseId}/assignments?bucket=future&order_by=due_at&per_page=1`,
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

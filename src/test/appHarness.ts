import { flushPromises, mount } from '@vue/test-utils'
import App from '../App.vue'
import { createAppRouter } from '../router'

export interface FakeCourse {
  id: number
  name: string
}

export interface FakeAssignment {
  id: number
  name: string
  due_at: string | null
}

export function coursesResponse(courses: FakeCourse[], link?: string): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (link) headers.link = link
  return new Response(JSON.stringify(courses), { status: 200, headers })
}

export function assignmentsResponse(assignments: FakeAssignment[]): Response {
  return new Response(JSON.stringify(assignments), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

export interface FakeModuleItem {
  id: number
  type: string
  title: string
  page_url?: string
  html_url?: string
  external_url?: string
}

export interface FakeModule {
  id: number
  name: string
  position: number
  items_count?: number
  items?: FakeModuleItem[]
}

export function modulesResponse(modules: FakeModule[]): Response {
  return new Response(JSON.stringify(modules), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

export async function mountAppAtPath(path: string) {
  const router = createAppRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

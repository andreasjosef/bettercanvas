import { flushPromises, mount, type DOMWrapper } from '@vue/test-utils'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { expect } from 'vitest'
import App from '../App.vue'
import { createAppRouter } from '../router'
import { createAppQueryClient } from '../api/queryClient'

/** Router + Query plugin tuple shared by every full-app mount in tests. */
export function appPlugins() {
  return [
    createAppRouter(),
    [VueQueryPlugin, { queryClient: createAppQueryClient() }],
  ] as [ReturnType<typeof createAppRouter>, [typeof VueQueryPlugin, unknown]]
}

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

export function assignmentsResponse(
  assignments: FakeAssignment[],
  link?: string,
): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (link) headers.link = link
  return new Response(JSON.stringify(assignments), { status: 200, headers })
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
  const [router, queryPlugin] = appPlugins()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router, queryPlugin] } })
  await flushPromises()
  return { wrapper, router }
}

export function expectPlainListRows(
  wrapper: { findAll(selector: string): DOMWrapper<Element>[] },
  selector: string,
  count: number,
): void {
  const rows = wrapper.findAll(selector)
  expect(rows).toHaveLength(count)
  for (const row of rows) {
    const link = row.find('a')
    expect(link.exists()).toBe(true)
    const linkClasses = link.classes()
    expect(linkClasses).not.toContain('rounded-md')
    expect(linkClasses).not.toContain('bg-surface')
    expect(linkClasses).not.toContain('p-3')
    expect(linkClasses).toContain('border-b')
    expect(linkClasses).toContain('py-2')
  }
}

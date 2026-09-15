import { flushPromises, mount } from '@vue/test-utils'
import App from '../App.vue'
import { createAppRouter } from '../router'

export interface FakeCourse {
  id: number
  name: string
}

export function coursesResponse(courses: FakeCourse[], link?: string): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (link) headers.link = link
  return new Response(JSON.stringify(courses), { status: 200, headers })
}

export async function mountAppAtPath(path: string) {
  const router = createAppRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

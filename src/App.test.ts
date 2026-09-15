import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from './App.vue'
import { createAppRouter } from './router'
import { TOKEN_STORAGE_KEY } from './token'

const mountAt = async (path: string) => {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  return wrapper
}

describe('App routing', () => {
  beforeEach(() => {
    localStorage.clear()
    // HomeView fetches with the stored token; seed one so the '/' route
    // renders Home rather than redirecting to Connect.
    localStorage.setItem(TOKEN_STORAGE_KEY, 'routing-test-token')
  })

  it.each([
    ['/', 'Home'],
    ['/connect', 'Connect'],
    ['/picker', 'Pick your Programs'],
    ['/programs/p1/modules', 'Modules'],
    ['/programs/p1/assignments', 'Assignments'],
    ['/programs/p1/read/item1', 'Reading'],
  ])('renders the %s screen for %s', async (path, expectedHeading) => {
    const wrapper = await mountAt(path)
    expect(wrapper.find('h1').text()).toBe(expectedHeading)
  })

  it('redirects unknown paths to home', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/nowhere')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('home')
  })
})

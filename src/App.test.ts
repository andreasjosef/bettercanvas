import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from './App.vue'
import { createAppRouter } from './router'

const mountAt = async (path: string) => {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  return wrapper
}

describe('App routing', () => {
  it.each([
    ['/', 'Home'],
    ['/connect', 'Connect'],
    ['/picker', 'Picker'],
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

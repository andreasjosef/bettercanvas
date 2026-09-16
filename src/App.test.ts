import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from './App.vue'
import { createAppRouter } from './router'
import { appPlugins } from './test/appHarness'
import { TOKEN_STORAGE_KEY } from './token'

const mountAt = async (path: string) => {
  const [router, queryPlugin] = appPlugins()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router, queryPlugin] } })
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
  ])('renders the %s screen for %s', async (path, expectedHeading) => {
    const wrapper = await mountAt(path)
    expect(wrapper.find('h1').text()).toBe(expectedHeading)
  })

  it('renders the reading screen for /programs/p1/read/item1', async () => {
    // The reading view loads its content asynchronously (no fetch stub
    // here), so assert on its deterministic initial state.
    const wrapper = await mountAt('/programs/p1/read/item1')
    expect(wrapper.text()).toContain('Loading…')
  })

  it('redirects unknown paths to home', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/nowhere')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('home')
  })
})

describe('App shell (persistent sidebar)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(TOKEN_STORAGE_KEY, 'shell-test-token')
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const mountAt = async (path: string) => {
    const [router, queryPlugin] = appPlugins()
    await router.push(path)
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router, queryPlugin] } })
    await flushPromises()
    return { wrapper, router }
  }

  const postConnectPaths = [
    '/',
    '/programs/p1/modules',
    '/programs/p1/assignments',
    '/programs/p1/read/item1',
    '/settings',
    '/previous-lectures',
  ]

  it.each(postConnectPaths)('wraps %s in the sidebar shell', async (path) => {
    const { wrapper } = await mountAt(path)
    const sidebar = wrapper.find('aside')
    expect(sidebar.exists()).toBe(true)
    const links = sidebar.findAll('a')
    expect(links.map((link) => link.text())).toEqual([
      'Better Canvas',
      'Previous Lectures',
      'Settings',
    ])
  })

  it.each([
    ['/connect', 'Connect'],
    ['/picker', 'Pick your Programs'],
  ])('renders %s without the sidebar', async (path) => {
    const { wrapper } = await mountAt(path)
    expect(wrapper.find('aside').exists()).toBe(false)
  })

  it.each(postConnectPaths)(
    'navigates to Home from the sidebar wordmark on %s',
    async (path) => {
      const { wrapper, router } = await mountAt(path)
      const wordmark = wrapper
        .find('aside')
        .findAll('a')
        .find((link) => link.text() === 'Better Canvas')
      await wordmark?.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('home')
    },
  )

  it.each([
    '/programs/p1/modules',
    '/programs/p1/read/item1',
    '/previous-lectures',
  ])(
    'navigates to Settings and Previous Lectures from the sidebar on %s',
    async (path) => {
      const { wrapper, router } = await mountAt(path)
      const sidebar = wrapper.find('aside')
      const settings = sidebar
        .findAll('a')
        .find((link) => link.text() === 'Settings')
      await settings?.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('settings')

      const previousLectures = sidebar
        .findAll('a')
        .find((link) => link.text() === 'Previous Lectures')
      await previousLectures?.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('previous-lectures')
    },
  )
})

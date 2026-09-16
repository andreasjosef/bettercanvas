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
    ['/programs/p1', 'Program'],
    ['/programs/p1/finished', 'Finished'],
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

  const globalNavPaths = ['/', '/settings', '/previous-lectures']

  it.each(globalNavPaths)(
    'wraps %s in the sidebar shell with the global nav',
    async (path) => {
      const { wrapper } = await mountAt(path)
      const sidebar = wrapper.find('aside')
      expect(sidebar.exists()).toBe(true)
      const links = sidebar.findAll('a')
      expect(links.map((link) => link.text())).toEqual([
        'Better Canvas',
        'Previous Lectures',
        'Settings',
      ])
    },
  )

  it.each([
    ['/connect', 'Connect'],
    ['/picker', 'Pick your Programs'],
  ])('renders %s without the sidebar', async (path) => {
    const { wrapper } = await mountAt(path)
    expect(wrapper.find('aside').exists()).toBe(false)
  })

  it.each(globalNavPaths)(
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

  it('the Program route reuses AppShell\'s single aside with Program nav instead of the global nav', async () => {
    const { wrapper } = await mountAt('/programs/p1')

    // Exactly one sidebar element on the page, not two side by side.
    const asides = wrapper.findAll('aside')
    expect(asides).toHaveLength(1)

    const links = asides[0]!.findAll('a')
    // Wordmark stays; global nav is swapped out for Program nav (Finished,
    // then the Module list — Modules fetch fails here, so none render).
    expect(links.map((link) => link.text())).toEqual([
      'Better Canvas',
      'Due soon',
      'Finished',
    ])
  })

  it('leaving the Program reverts the aside to the global nav', async () => {
    const { wrapper, router } = await mountAt('/programs/p1')
    expect(wrapper.findAll('aside')).toHaveLength(1)
    expect(wrapper.find('aside').findAll('a').map((link) => link.text()))
      .toEqual(['Better Canvas', 'Due soon', 'Finished'])

    await router.push('/previous-lectures')
    await flushPromises()

    const links = wrapper.find('aside').findAll('a')
    expect(links.map((link) => link.text())).toEqual([
      'Better Canvas',
      'Previous Lectures',
      'Settings',
    ])
  })

  it('the wordmark persists across the Program-nav swap and links back to Home', async () => {
    const { wrapper, router } = await mountAt('/programs/p1/finished')

    const wordmark = wrapper
      .find('aside')
      .findAll('a')
      .find((link) => link.text() === 'Better Canvas')
    expect(wordmark).toBeDefined()

    await wordmark!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('home')
    expect(wrapper.find('aside').findAll('a').map((link) => link.text()))
      .toEqual(['Better Canvas', 'Previous Lectures', 'Settings'])
  })

  it('navigates to Settings and Previous Lectures from the sidebar on a non-Program route', async () => {
    const { wrapper, router } = await mountAt('/previous-lectures')
    const sidebar = wrapper.find('aside')
    const settings = sidebar.findAll('a').find((link) => link.text() === 'Settings')
    await settings?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('settings')

    const previousLectures = sidebar
      .findAll('a')
      .find((link) => link.text() === 'Previous Lectures')
    await previousLectures?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('previous-lectures')
  })
})

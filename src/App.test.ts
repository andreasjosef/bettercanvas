import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from './App.vue'
import { createAppRouter } from './router'
import { ANTI_FLASH_MS, useLoadingStore, wireLoadingSignals } from './stores/loading'
import { appPlugins } from './test/appHarness'
import { PROGRAMS_STORAGE_KEY } from './programs'
import { TOKEN_STORAGE_KEY } from './token'

const mountAt = async (path: string) => {
  const { pinia, router, queryPlugin } = appPlugins()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, {
    global: { plugins: [pinia, router, queryPlugin] },
  })
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
    const { pinia, router, queryPlugin } = appPlugins()
    await router.push(path)
    await router.isReady()
    const wrapper = mount(App, {
      global: { plugins: [pinia, router, queryPlugin] },
    })
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

describe('Root-mounted loading bar', () => {
  // Fake timers make the store's anti-flash window (100ms) deterministic
  // without waiting in real time. flushMicrotasks deliberately avoids
  // flushPromises, which resolves via setTimeout and would deadlock under
  // fake timers.
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    localStorage.setItem(TOKEN_STORAGE_KEY, 'loading-bar-test-token')
    // HomeView only fetches when an active Program exists, so seed one to
    // make the fetch-driven scenarios exercise the real query path.
    localStorage.setItem(
      PROGRAMS_STORAGE_KEY,
      JSON.stringify([{ courseId: 585, name: 'Programming', archived: false }]),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  async function flushMicrotasks() {
    for (let i = 0; i < 20; i++) {
      await Promise.resolve()
    }
  }

  async function mountLoadingApp(path: string, fetchImpl?: () => Promise<unknown>) {
    if (fetchImpl) vi.stubGlobal('fetch', vi.fn(fetchImpl))
    const { pinia, router, queryClient, queryPlugin } = appPlugins()
    // Mirror main.ts: the bar is driven by the same wiring the real app uses.
    wireLoadingSignals(pinia, router, queryClient)
    await router.push(path)
    await router.isReady()
    const wrapper = mount(App, {
      global: { plugins: [pinia, router, queryPlugin] },
    })
    await flushMicrotasks()
    return { wrapper, router, pinia }
  }

  const jsonResponse = () =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

  it('stays hidden when nothing is loading', async () => {
    const { wrapper } = await mountLoadingApp('/', () =>
      Promise.resolve(jsonResponse()),
    )
    vi.advanceTimersByTime(ANTI_FLASH_MS + 1)
    await flushMicrotasks()
    expect(wrapper.find('[data-testid="loading-bar"]').exists()).toBe(false)
  })

  it('is visible above the sidebar on a shelled route while a fetch is in flight', async () => {
    const { wrapper } = await mountLoadingApp('/', () => new Promise(() => {}))
    const aside = wrapper.find('aside')
    expect(aside.exists()).toBe(true)
    // Let vue-query's batched fetch-start notification land (it schedules
    // via setTimeout), then cross the anti-flash window.
    vi.advanceTimersByTime(1)
    await flushMicrotasks()
    vi.advanceTimersByTime(ANTI_FLASH_MS)
    await flushMicrotasks()

    const bar = wrapper.find('[data-testid="loading-bar"]')
    expect(bar.exists()).toBe(true)
    // Above the sidebar: outside the aside entirely, and preceding it in
    // document order — one mount above both shell branches.
    expect(bar.element.closest('aside')).toBeNull()
    const position = bar.element.compareDocumentPosition(aside.element)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each([
    ['/connect', 'Connect'],
    ['/picker', 'Pick your Programs'],
  ])('is visible on the bare %s route without a sidebar', async (path) => {
    // Neither bare view fetches on mount, so drive the store through the
    // app's pinia directly.
    const { wrapper, pinia } = await mountLoadingApp(path)
    expect(wrapper.find('aside').exists()).toBe(false)
    useLoadingStore(pinia).setFetchCount(1)
    vi.advanceTimersByTime(ANTI_FLASH_MS)
    await flushMicrotasks()

    expect(wrapper.find('[data-testid="loading-bar"]').exists()).toBe(true)
  })

  it('is visible while a navigation is in flight, then hides when it settles', async () => {
    let release: () => void = () => {}
    const { wrapper, router } = await mountLoadingApp('/previous-lectures')
    // Block the next navigation the way a slow guard would.
    router.beforeEach(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const push = router.push('/picker')
    await flushMicrotasks()
    expect(wrapper.find('[data-testid="loading-bar"]').exists()).toBe(false)

    vi.advanceTimersByTime(ANTI_FLASH_MS)
    await flushMicrotasks()
    expect(wrapper.find('[data-testid="loading-bar"]').exists()).toBe(true)

    release()
    await push
    await flushMicrotasks()
    expect(wrapper.find('[data-testid="loading-bar"]').exists()).toBe(false)
  })

  it('becomes visible during a deliberately delayed fetch, then disappears once it resolves', async () => {
    let resolveFetch: (response: Response) => void = () => {}
    const { wrapper } = await mountLoadingApp(
      '/',
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.advanceTimersByTime(1)
    await flushMicrotasks()
    expect(wrapper.find('[data-testid="loading-bar"]').exists()).toBe(false)

    vi.advanceTimersByTime(ANTI_FLASH_MS)
    await flushMicrotasks()
    expect(wrapper.find('[data-testid="loading-bar"]').exists()).toBe(true)

    resolveFetch(jsonResponse())
    vi.advanceTimersByTime(1)
    await flushMicrotasks()
    expect(wrapper.find('[data-testid="loading-bar"]').exists()).toBe(false)
  })

  it('carries role="progressbar" and aria-valuetext, with no aria-valuenow', async () => {
    const { wrapper, pinia } = await mountLoadingApp('/')
    useLoadingStore(pinia).setFetchCount(1)
    vi.advanceTimersByTime(ANTI_FLASH_MS)
    await flushMicrotasks()

    const bar = wrapper.find('[data-testid="loading-bar"]')
    expect(bar.attributes('role')).toBe('progressbar')
    expect(bar.attributes('aria-valuetext')).toBe('Loading')
    expect(bar.attributes('aria-valuenow')).toBeUndefined()
  })

  it('uses --color-accent for its visual treatment', async () => {
    const { wrapper, pinia } = await mountLoadingApp('/')
    useLoadingStore(pinia).setFetchCount(1)
    vi.advanceTimersByTime(ANTI_FLASH_MS)
    await flushMicrotasks()

    // bg-accent is the Tailwind theme-key mapping of var(--color-accent);
    // the sweep element carries it, per the components-consume-theme-keys
    // convention.
    const sweep = wrapper.find('[data-testid="loading-bar"] .loading-bar-sweep')
    expect(sweep.exists()).toBe(true)
    expect(sweep.classes()).toContain('bg-accent')
  })

  it('clears on a failed fetch with no distinct error styling on the bar', async () => {
    let rejectFetch: (reason: unknown) => void = () => {}
    const { wrapper } = await mountLoadingApp(
      '/',
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectFetch = reject
        }),
    )
    await flushMicrotasks()
    vi.advanceTimersByTime(1)
    await flushMicrotasks()
    vi.advanceTimersByTime(ANTI_FLASH_MS)
    await flushMicrotasks()
    expect(wrapper.find('[data-testid="loading-bar"]').exists()).toBe(true)

    rejectFetch(new Error('network down'))
    vi.advanceTimersByTime(1)
    await flushMicrotasks()
    // Same visible → false transition as a success: the bar unmounts
    // outright, so there is no error variant to style.
    expect(wrapper.find('[data-testid="loading-bar"]').exists()).toBe(false)
  })
})

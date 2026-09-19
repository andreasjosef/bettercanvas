import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createAppQueryClient } from '../api/queryClient.ts'
import { useLoadingStore, wireLoadingSignals } from './loading.ts'

describe('loading store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts hidden', () => {
    const store = useLoadingStore()
    expect(store.visible).toBe(false)
  })

  it('shows after the anti-flash window on navigation alone', () => {
    const store = useLoadingStore()
    store.setNavigating(true)
    expect(store.visible).toBe(false)
    vi.advanceTimersByTime(100)
    expect(store.visible).toBe(true)
  })

  it('shows after the anti-flash window on fetching alone', () => {
    const store = useLoadingStore()
    store.setFetchCount(1)
    expect(store.visible).toBe(false)
    vi.advanceTimersByTime(100)
    expect(store.visible).toBe(true)
  })

  it('shows after the anti-flash window when navigating and fetching', () => {
    const store = useLoadingStore()
    store.setNavigating(true)
    store.setFetchCount(1)
    vi.advanceTimersByTime(100)
    expect(store.visible).toBe(true)
  })

  it('stays hidden when both signals are false', () => {
    const store = useLoadingStore()
    store.setNavigating(true)
    store.setFetchCount(1)
    vi.advanceTimersByTime(100)
    expect(store.visible).toBe(true)
    store.setNavigating(false)
    store.setFetchCount(0)
    expect(store.visible).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(store.visible).toBe(false)
  })

  it('never shows when a fetch resolves before the timer fires', () => {
    const store = useLoadingStore()
    store.setFetchCount(1)
    vi.advanceTimersByTime(50)
    store.setFetchCount(0)
    vi.advanceTimersByTime(100)
    expect(store.visible).toBe(false)
  })

  it('shows when a fetch outlives the timer', () => {
    const store = useLoadingStore()
    store.setFetchCount(1)
    vi.advanceTimersByTime(100)
    expect(store.visible).toBe(true)
  })

  it('hides immediately when both signals clear, with no delay', () => {
    const store = useLoadingStore()
    store.setNavigating(true)
    vi.advanceTimersByTime(100)
    expect(store.visible).toBe(true)
    store.setNavigating(false)
    expect(store.visible).toBe(false)
    vi.advanceTimersByTime(0)
    expect(store.visible).toBe(false)
  })

  it('does not flicker off between overlapping fetches (1->2->1->0)', () => {
    const store = useLoadingStore()
    store.setFetchCount(1)
    vi.advanceTimersByTime(100)
    expect(store.visible).toBe(true)
    store.setFetchCount(2)
    expect(store.visible).toBe(true)
    store.setFetchCount(1)
    vi.advanceTimersByTime(500)
    expect(store.visible).toBe(true)
    store.setFetchCount(0)
    expect(store.visible).toBe(false)
  })

  it('never shows when an aborted navigation settles before the timer', () => {
    const store = useLoadingStore()
    store.setNavigating(true)
    vi.advanceTimersByTime(50)
    store.setNavigating(false)
    vi.advanceTimersByTime(100)
    expect(store.visible).toBe(false)
  })
})

describe('loading signal wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function flushMicrotasks() {
    for (let i = 0; i < 20; i++) {
      await Promise.resolve()
    }
  }

  function wiredHarness() {
    const pinia = createPinia()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/a', component: { template: '<div />' } },
        { path: '/blocked', component: { template: '<div />' } },
      ],
    })
    const queryClient = createAppQueryClient()
    const store = useLoadingStore(pinia)
    wireLoadingSignals(pinia, router, queryClient)
    return { store, router, queryClient }
  }

  it('reflects a pending navigation, then clears when it settles', async () => {
    const { store, router } = wiredHarness()
    let release: () => void = () => {}
    router.beforeEach(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const push = router.push('/a')
    await flushMicrotasks()
    expect(store.visible).toBe(false)
    vi.advanceTimersByTime(100)
    expect(store.visible).toBe(true)
    release()
    await push
    expect(store.visible).toBe(false)
  })

  it('clears when a navigation is aborted by a guard', async () => {
    const { store, router } = wiredHarness()
    let deny: (value: boolean) => void = () => {}
    router.beforeEach(
      () =>
        new Promise<boolean>((resolve) => {
          deny = resolve
        }),
    )
    const push = router.push('/blocked')
    await flushMicrotasks()
    vi.advanceTimersByTime(100)
    expect(store.visible).toBe(true)
    deny(false)
    await push
    expect(store.visible).toBe(false)
  })

  it('reflects a query fetch through the global fetch count', async () => {
    const { store, queryClient } = wiredHarness()
    let resolveFetch: (value: string) => void = () => {}
    const fetch = new Promise<string>((resolve) => {
      resolveFetch = resolve
    })
    void queryClient.fetchQuery({
      queryKey: ['wired-fetch'],
      queryFn: () => fetch,
    })
    vi.advanceTimersByTime(1)
    await flushMicrotasks()
    expect(store.visible).toBe(false)
    vi.advanceTimersByTime(100)
    expect(store.visible).toBe(true)
    resolveFetch('done')
    vi.advanceTimersByTime(1)
    await flushMicrotasks()
    expect(store.visible).toBe(false)
  })
})

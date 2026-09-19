import { computed, effectScope, ref, watch } from 'vue'
import { defineStore, type Pinia } from 'pinia'
import { useIsFetching, type QueryClient } from '@tanstack/vue-query'
import type { Router } from 'vue-router'

export const ANTI_FLASH_MS = 100

/**
 * Shared mechanism behind the app-wide loading bar (ADR-0004). The two
 * driving signals — router navigation and Vue Query's global fetch count —
 * are merged into a single public `visible` boolean with an anti-flash
 * delay on show and an immediate hide.
 */
export const useLoadingStore = defineStore('loading', () => {
  const navigating = ref(false)
  const fetchCount = ref(0)
  const visible = ref(false)
  let antiFlashTimer: ReturnType<typeof setTimeout> | null = null

  const visibleEligible = computed(
    () => navigating.value || fetchCount.value > 0,
  )

  function reconcileVisible() {
    if (visibleEligible.value) {
      if (!visible.value && antiFlashTimer === null) {
        antiFlashTimer = setTimeout(() => {
          antiFlashTimer = null
          if (visibleEligible.value) {
            visible.value = true
          }
        }, ANTI_FLASH_MS)
      }
    } else {
      if (antiFlashTimer !== null) {
        clearTimeout(antiFlashTimer)
        antiFlashTimer = null
      }
      visible.value = false
    }
  }

  function setNavigating(value: boolean) {
    navigating.value = value
    reconcileVisible()
  }

  function setFetchCount(count: number) {
    fetchCount.value = count
    reconcileVisible()
  }

  return { visible, setNavigating, setFetchCount }
})

/**
 * App-lifetime glue: drives the store from vue-router's global navigation
 * guards and Vue Query's global fetch-in-flight count. afterEach fires for
 * settled navigations of every kind (completed, cancelled, aborted), and
 * onError for guard errors, so `navigating` always settles. Call once after
 * the router, query client and Pinia exist, before mounting the app. The
 * effect scope is required by useIsFetching's scope expectations; it is
 * never stopped because the wiring lives for the whole app.
 */
export function wireLoadingSignals(
  pinia: Pinia,
  router: Router,
  queryClient: QueryClient,
): void {
  const store = useLoadingStore(pinia)
  effectScope().run(() => {
    router.beforeEach(() => {
      store.setNavigating(true)
    })
    router.afterEach(() => {
      store.setNavigating(false)
    })
    router.onError(() => {
      store.setNavigating(false)
    })
    watch(
      useIsFetching({}, queryClient),
      (count) => {
        store.setFetchCount(count)
      },
      { immediate: true },
    )
  })
}

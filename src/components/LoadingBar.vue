<script setup lang="ts">
import { useLoadingStore } from '../stores/loading'

// One app-wide mount in App.vue, above both the shelled and bare RouterView
// branches. Visibility comes from the loading-state store's merged,
// anti-flash-delayed `visible` flag (ADR-0004); fetch errors hide the bar
// through the same transition as success — there is no error state here.
const store = useLoadingStore()
</script>

<template>
  <div
    v-if="store.visible"
    data-testid="loading-bar"
    role="progressbar"
    aria-valuetext="Loading"
    class="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
  >
    <span class="loading-bar-sweep block h-full w-1/3 bg-accent" />
  </div>
</template>

<style scoped>
/*
 * Indeterminate sweep: a third-width accent strip gliding across the bar.
 * The accent color is the Tailwind theme-key mapping of the
 * --color-accent token; the keyframes live in scoped CSS because the
 * animation is component-private and Tailwind carries no keyframe for it.
 */
@keyframes loading-bar-sweep {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}
.loading-bar-sweep {
  animation: loading-bar-sweep 1.2s ease-in-out infinite;
}
</style>

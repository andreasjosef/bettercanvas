<!--
  PROTOTYPE — answers issue #5: what should the connect-to-reading flow look
  like, and what semantic token set should back it? Three radically
  different, structurally distinct design systems (VariantA/B/C), each
  covering all six requested screens. Switch design system with the bottom
  pill (or ← / →); jump between screens with the top tab strip. Throwaway:
  capture the winning direction, then delete this whole folder and the
  App.vue wiring below.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import VariantA from './VariantA.vue'
import VariantB from './VariantB.vue'
import VariantC from './VariantC.vue'
import PrototypeSwitcher from './PrototypeSwitcher.vue'
import type { Screen } from './screens'
import { screens } from './screens'

const variantOptions = [
  { key: 'a', label: 'A — Quiet Reader' },
  { key: 'b', label: 'B — Command Dashboard' },
  { key: 'c', label: 'C — Editorial Digest' },
]

function readParam(name: string, fallback: string) {
  return new URLSearchParams(window.location.search).get(name) ?? fallback
}

function writeParam(name: string, value: string) {
  const url = new URL(window.location.href)
  url.searchParams.set(name, value)
  window.history.replaceState({}, '', url)
}

const variant = ref(readParam('variant', 'a'))
const screen = ref(readParam('screen', 'connect') as Screen)

function setVariant(key: string) {
  variant.value = key
  writeParam('variant', key)
}

function setScreen(key: Screen) {
  screen.value = key
  writeParam('screen', key)
}

const variantComponent = computed(() => {
  if (variant.value === 'b') return VariantB
  if (variant.value === 'c') return VariantC
  return VariantA
})

const isDev = !import.meta.env.PROD
</script>

<template>
  <div :data-variant="variant" class="prototype-root">
    <nav v-if="isDev" class="screen-nav">
      <button
        v-for="s in screens"
        :key="s.key"
        type="button"
        :class="{ active: s.key === screen }"
        @click="setScreen(s.key)"
      >
        {{ s.label }}
      </button>
    </nav>

    <component :is="variantComponent" :screen="screen" @navigate="setScreen" />

    <PrototypeSwitcher :variants="variantOptions" :current="variant" @change="setVariant" />
  </div>
</template>

<style scoped>
.prototype-root {
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
}

/* In-flow (not fixed) so it pushes each variant's own chrome down instead
   of overlapping it — variants B and C both put real content flush at the
   top of the viewport. */
.screen-nav {
  position: sticky;
  top: 0;
  z-index: 9999;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
  background: #111;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.screen-nav button {
  all: unset;
  cursor: pointer;
  color: #cbd5e1;
  font: 11px/1 system-ui, sans-serif;
  padding: 6px 8px;
  border-radius: 6px;
}
.screen-nav button:hover {
  background: rgba(255, 255, 255, 0.1);
}
.screen-nav button.active {
  background: #fff;
  color: #111;
  font-weight: 600;
}
</style>

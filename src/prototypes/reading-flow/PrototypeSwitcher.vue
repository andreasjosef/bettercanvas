<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  variants: { key: string; label: string }[]
  current: string
}>()

const emit = defineEmits<{ change: [key: string] }>()

function currentIndex() {
  return props.variants.findIndex((v) => v.key === props.current)
}

function step(delta: number) {
  const i = currentIndex()
  const next = (i + delta + props.variants.length) % props.variants.length
  emit('change', props.variants[next].key)
}

function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return
  }
  if (e.key === 'ArrowLeft') step(-1)
  if (e.key === 'ArrowRight') step(1)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

const isDev = !import.meta.env.PROD
</script>

<template>
  <div v-if="isDev" class="prototype-switcher">
    <button type="button" aria-label="Previous variant" @click="step(-1)">‹</button>
    <span class="label">{{ variants.find((v) => v.key === current)?.label }}</span>
    <button type="button" aria-label="Next variant" @click="step(1)">›</button>
  </div>
</template>

<style scoped>
.prototype-switcher {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 999px;
  background: #111;
  color: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  font: 13px/1 system-ui, sans-serif;
  z-index: 9999;
}

button {
  all: unset;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  font-size: 16px;
}
button:hover {
  background: rgba(255, 255, 255, 0.15);
}
button:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.label {
  white-space: nowrap;
  padding: 0 4px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
</style>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchCourses } from '../api/canvas'
import { saveToken } from '../token'

const router = useRouter()
const token = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

async function connect(): Promise<void> {
  const trimmed = token.value.trim()
  if (!trimmed) {
    error.value = 'Paste your Canvas Personal Access Token first.'
    return
  }
  error.value = null
  submitting.value = true
  try {
    await fetchCourses(trimmed)
    saveToken(trimmed)
    await router.push({ name: 'picker' })
  } catch {
    error.value =
      'Canvas rejected this token. Check that you copied the full token and try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center p-4 text-center gap-2">
    <h1 class="m-0 font-heading text-heading text-2xl">Connect</h1>
    <p class="m-0 text-text-muted">Paste your Canvas Personal Access Token to begin.</p>
    <form class="flex flex-col items-center gap-2 max-w-sm w-full" @submit.prevent="connect">
      <input
        v-model="token"
        name="token"
        type="password"
        autocomplete="off"
        spellcheck="false"
        placeholder="Canvas Personal Access Token"
        class="w-full rounded-md border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-focus-ring"
      />
      <button
        type="submit"
        :disabled="submitting"
        class="rounded-md bg-accent px-4 py-2 font-heading text-accent-text hover:opacity-90 disabled:opacity-50"
      >
        {{ submitting ? 'Connecting…' : 'Connect' }}
      </button>
      <p v-if="error" role="alert" class="m-0 text-sm text-danger">
        {{ error }}
      </p>
    </form>
  </main>
</template>

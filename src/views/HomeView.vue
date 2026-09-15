<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { fetchNextDueAssignment, type Assignment } from '../api/canvas'
import { loadPrograms } from '../programs'
import { loadToken } from '../token'

const router = useRouter()
const loading = ref(true)
const activePrograms = ref(loadPrograms().filter((program) => !program.archived))
const nextDueByProgram = ref<Record<number, Assignment | null>>({})
const failedProgramIds = ref<ReadonlySet<number>>(new Set())
const hasPrograms = computed(() => activePrograms.value.length > 0)

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(async () => {
  const token = loadToken()
  if (!token) {
    await router.replace({ name: 'connect' })
    return
  }
  if (!hasPrograms.value) {
    loading.value = false
    return
  }
  const results = await Promise.allSettled(
    activePrograms.value.map((program) =>
      fetchNextDueAssignment(token, program.courseId),
    ),
  )
  const nextDue: Record<number, Assignment | null> = {}
  const failed: number[] = []
  activePrograms.value.forEach((program, index) => {
    const result = results[index]
    if (result && result.status === 'fulfilled') {
      nextDue[program.courseId] = result.value
    } else {
      failed.push(program.courseId)
    }
  })
  nextDueByProgram.value = nextDue
  failedProgramIds.value = new Set(failed)
  loading.value = false
})
</script>

<template>
  <main class="flex min-h-screen flex-col items-center p-4 gap-4">
    <h1 class="m-0 font-heading text-heading text-2xl">Home</h1>
    <p v-if="loading" class="m-0 text-text-muted">Loading…</p>
    <p v-else-if="!hasPrograms" class="m-0 text-text-muted flex flex-col items-center gap-2">
      No active Programs yet.
      <RouterLink
        :to="{ name: 'picker' }"
        class="text-accent underline hover:opacity-90"
      >
        Pick your Programs
      </RouterLink>
    </p>
    <ul v-else class="m-0 w-full max-w-2xl list-none p-0 flex flex-col gap-3">
      <li
        v-for="program in activePrograms"
        :key="program.courseId"
        class="border border-border rounded-md bg-surface p-3 flex flex-col gap-1 text-left"
      >
        <span class="font-heading text-heading text-lg">{{ program.name }}</span>
        <span
          v-if="failedProgramIds.has(program.courseId)"
          class="text-sm text-danger"
        >
          Could not load upcoming assignments.
        </span>
        <span
          v-else-if="nextDueByProgram[program.courseId]?.due_at"
          class="text-sm text-text-muted"
        >
          Next due: {{ nextDueByProgram[program.courseId]!.name }} —
          {{ formatDueDate(nextDueByProgram[program.courseId]!.due_at!) }}
        </span>
        <span
          v-else-if="nextDueByProgram[program.courseId]"
          class="text-sm text-text-muted"
        >
          Next due: {{ nextDueByProgram[program.courseId]!.name }}
        </span>
        <span v-else class="text-sm text-text-muted">No upcoming assignments.</span>
      </li>
    </ul>
  </main>
</template>

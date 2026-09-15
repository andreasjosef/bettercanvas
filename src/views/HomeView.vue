<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { fetchNextDueAssignment, type Assignment } from '../api/canvas'
import { loadPrograms } from '../programs'
import { loadToken } from '../token'

interface ProgramRow {
  courseId: number
  name: string
  failed: boolean
  nextDueName: string | null
  dueAt: string | null
}

const router = useRouter()
const loading = ref(true)
const activePrograms = ref(loadPrograms().filter((program) => !program.archived))
const nextDueByProgram = ref<Record<number, Assignment | null>>({})
const failedProgramIds = ref<ReadonlySet<number>>(new Set())
const hasPrograms = computed(() => activePrograms.value.length > 0)
const programRows = computed<ProgramRow[]>(() =>
  activePrograms.value.map((program) => {
    const nextDue = nextDueByProgram.value[program.courseId] ?? null
    return {
      courseId: program.courseId,
      name: program.name,
      failed: failedProgramIds.value.has(program.courseId),
      nextDueName: nextDue?.name ?? null,
      dueAt: nextDue?.due_at ?? null,
    }
  }),
)

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
        v-for="row in programRows"
        :key="row.courseId"
        class="border border-border rounded-md bg-surface p-3 flex flex-col gap-1 text-left"
      >
        <span class="font-heading text-heading text-lg">{{ row.name }}</span>
        <span v-if="row.failed" class="text-sm text-danger">
          Could not load upcoming assignments.
        </span>
        <span
          v-else-if="row.nextDueName && row.dueAt"
          class="text-sm text-text-muted"
        >
          Next due: {{ row.nextDueName }} — {{ formatDueDate(row.dueAt) }}
        </span>
        <span v-else-if="row.nextDueName" class="text-sm text-text-muted">
          Next due: {{ row.nextDueName }}
        </span>
        <span v-else class="text-sm text-text-muted">No upcoming assignments.</span>
      </li>
    </ul>
  </main>
</template>

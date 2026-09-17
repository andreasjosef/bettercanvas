<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useQueries } from '@tanstack/vue-query'
import { canvasQueryOptions } from '../api/keys'
import { useCanvasToken } from '../api/useCanvasToken'
import { loadPrograms } from '../programs'

interface ProgramRow {
  courseId: number
  name: string
  failed: boolean
  nextDueName: string | null
  dueAt: string | null
}

const { token, tokenEnabled } = useCanvasToken()

const activePrograms = loadPrograms().filter((program) => !program.archived)
const hasPrograms = activePrograms.length > 0

const nextDueQueries = useQueries({
  queries: () =>
    activePrograms.map((program) => ({
      ...canvasQueryOptions.nextDueAssignment(program.courseId, token ?? ''),
      enabled: tokenEnabled.value && hasPrograms,
    })),
})

const loading = computed(
  () =>
    tokenEnabled.value &&
    hasPrograms &&
    nextDueQueries.value.some((query) => query.isPending),
)

const programRows = computed<ProgramRow[]>(() =>
  activePrograms.map((program, index) => {
    const query = nextDueQueries.value[index]
    const failed = query.isError
    const nextDue = query.data ?? null
    return {
      courseId: program.courseId,
      name: program.name,
      failed,
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
</script>

<template>
  <main class="flex min-h-screen flex-col items-center p-4 gap-4">
    <h1 class="m-0 font-heading text-heading text-2xl">
      Home
    </h1>
    <RouterLink
      :to="{ name: 'settings' }"
      class="no-underline text-sm text-accent hover:opacity-90"
    >
      Manage Programs
    </RouterLink>
    <RouterLink
      :to="{ name: 'previous-lectures' }"
      class="no-underline text-sm text-accent hover:opacity-90"
    >
      Previous Lectures
    </RouterLink>
    <p
      v-if="loading"
      class="m-0 text-text-muted"
    >
      Loading…
    </p>
    <p
      v-else-if="!hasPrograms"
      class="m-0 text-text-muted flex flex-col items-center gap-2"
    >
      No active Programs yet.
      <RouterLink
        :to="{ name: 'picker' }"
        class="text-accent underline hover:opacity-90"
      >
        Pick your Programs
      </RouterLink>
    </p>
    <ul
      v-else
      class="m-0 w-full max-w-2xl list-none p-0 flex flex-col"
    >
      <li
        v-for="row in programRows"
        :key="row.courseId"
      >
        <RouterLink
          :to="{ name: 'program', params: { programId: String(row.courseId) } }"
          class="block py-2 border-b border-border no-underline text-inherit text-left"
        >
          <span class="block font-heading text-heading text-lg">{{ row.name }}</span>
          <span
            v-if="row.failed"
            class="block text-sm text-danger"
          >
            Could not load upcoming assignments.
          </span>
          <span
            v-else-if="row.nextDueName && row.dueAt"
            class="block text-sm text-text-muted"
          >
            Next due: {{ row.nextDueName }} — {{ formatDueDate(row.dueAt) }}
          </span>
          <span
            v-else-if="row.nextDueName"
            class="block text-sm text-text-muted"
          >
            Next due: {{ row.nextDueName }}
          </span>
          <span
            v-else
            class="block text-sm text-text-muted"
          >No upcoming assignments.</span>
        </RouterLink>
      </li>
    </ul>
  </main>
</template>

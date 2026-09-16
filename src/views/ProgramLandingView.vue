<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { Assignment } from '../api/canvas'
import { canvasQueryOptions } from '../api/keys'
import { useCanvasToken } from '../api/useCanvasToken'
import { isAssignmentDone, doneVersion, setAssignmentDone } from '../done'
import { findProgram } from '../programs'

const props = defineProps<{ programId: string }>()

const { token, tokenEnabled } = useCanvasToken()

const courseId = computed(() => Number(props.programId))
const query = useQuery(
  computed(() => ({
    ...canvasQueryOptions.assignments(courseId.value, token ?? ''),
    enabled: tokenEnabled.value,
  })),
)

const loading = computed(() => query.isPending.value)
const failed = computed(() => query.isError.value)
const assignments = computed(() => query.data.value ?? [])

const programName = computed(() => findProgram(props.programId)?.name ?? 'Program')

type DueGroup = 'today' | 'this-week' | 'later' | 'undated'

const DUE_GROUPS: DueGroup[] = ['today', 'this-week', 'later', 'undated']

const GROUP_HEADINGS: Record<DueGroup, string> = {
  today: 'Today',
  'this-week': 'This week',
  later: 'Later',
  undated: 'No due date',
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function dueGroupFor(assignment: Assignment, now: number): DueGroup {
  if (!assignment.due_at) return 'undated'
  const due = new Date(assignment.due_at).getTime()
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  if (due <= endOfToday.getTime()) return 'today'
  if (due <= now + WEEK_MS) return 'this-week'
  return 'later'
}

function dueTime(assignment: Assignment): number {
  return assignment.due_at ? new Date(assignment.due_at).getTime() : Infinity
}

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const sections = computed(() => {
  void doneVersion.value
  const now = Date.now()
  const groups: Record<DueGroup, Assignment[]> = {
    today: [],
    'this-week': [],
    later: [],
    undated: [],
  }
  for (const assignment of assignments.value) {
    if (isAssignmentDone(courseId.value, assignment.id)) continue
    groups[dueGroupFor(assignment, now)].push(assignment)
  }
  return DUE_GROUPS.filter((group) => groups[group].length > 0).map((group) => {
    const sorted = [...groups[group]].sort((a, b) => dueTime(a) - dueTime(b))
    const heading =
      group === 'undated'
        ? GROUP_HEADINGS[group]
        : `${GROUP_HEADINGS[group]} (${groups[group].length})`
    return { group, heading, assignments: sorted }
  })
})
</script>

<template>
  <div class="w-full max-w-2xl mx-auto flex flex-col p-4 gap-4">
    <h1 class="m-0 font-heading text-heading text-2xl">{{ programName }}</h1>
    <p v-if="loading" class="m-0 text-text-muted">Loading…</p>
    <p v-else-if="failed" class="m-0 text-danger">
      Could not load assignments.
    </p>
    <div v-else class="flex flex-col gap-6">
      <p v-if="sections.length === 0" class="m-0 text-text-muted">
        Nothing due — or everything due is already Done.
      </p>
      <section
        v-for="section in sections"
        :key="section.group"
        :data-testid="`assignments-${section.group}`"
        class="flex flex-col gap-2"
      >
        <h2 class="m-0 font-heading text-heading text-lg">
          {{ section.heading }}
        </h2>
        <ol class="m-0 list-none p-0 flex flex-col">
          <li
            v-for="assignment in section.assignments"
            :key="assignment.id"
            class="flex items-center justify-between gap-3 py-2 border-b border-border"
          >
            <span>
              <span class="block text-heading">{{ assignment.name }}</span>
              <span
                v-if="assignment.due_at"
                class="block text-text-muted text-sm"
              >
                Due {{ formatDueDate(assignment.due_at) }}
              </span>
            </span>
            <button
              type="button"
              :data-testid="`mark-done-${assignment.id}`"
              class="flex-none text-sm text-text-muted hover:text-heading"
              @click="setAssignmentDone(courseId, assignment.id, true)"
            >
              Mark Done
            </button>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

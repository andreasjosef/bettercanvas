<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchAssignments, type Assignment } from '../api/canvas'
import { loadToken } from '../token'

const props = defineProps<{ programId: string }>()

const router = useRouter()
const loading = ref(true)
const failed = ref(false)
const assignments = ref<Assignment[]>([])

type DueGroup = 'today' | 'this-week' | 'later' | 'undated'

const DUE_GROUPS: DueGroup[] = ['today', 'this-week', 'later', 'undated']

const GROUP_HEADINGS: Record<DueGroup, string> = {
  today: 'Today',
  'this-week': 'This week',
  later: 'Later',
  undated: 'No due date',
}

function dueGroupFor(assignment: Assignment, now: number): DueGroup {
  if (!assignment.due_at) return 'undated'
  const due = new Date(assignment.due_at).getTime()
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  if (due <= endOfToday.getTime()) return 'today'
  if (due <= now + 7 * 24 * 60 * 60 * 1000) return 'this-week'
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
  const now = Date.now()
  const groups: Record<DueGroup, Assignment[]> = {
    today: [],
    'this-week': [],
    later: [],
    undated: [],
  }
  for (const assignment of assignments.value) {
    groups[dueGroupFor(assignment, now)].push(assignment)
  }
  return DUE_GROUPS.filter((group) => groups[group].length > 0).map((group) => {
    const sorted = [...groups[group]].sort((a, b) => dueTime(a) - dueTime(b))
    return { group, heading: GROUP_HEADINGS[group], assignments: sorted }
  })
})

onMounted(async () => {
  const token = loadToken()
  if (!token) {
    await router.replace({ name: 'connect' })
    return
  }
  try {
    assignments.value = await fetchAssignments(token, Number(props.programId))
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="flex min-h-screen flex-col items-center p-4 gap-4">
    <h1 class="m-0 font-heading text-heading text-2xl">Assignments</h1>
    <p v-if="loading" class="m-0 text-text-muted">Loading…</p>
    <p v-else-if="failed" class="m-0 text-danger">
      Could not load assignments.
    </p>
    <div v-else class="w-full max-w-2xl flex flex-col gap-6">
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
          >
            <span class="block py-2 border-b border-border">
              <span class="block text-heading">{{ assignment.name }}</span>
              <span
                v-if="assignment.due_at"
                class="block text-text-muted text-sm"
              >
                Due {{ formatDueDate(assignment.due_at) }}
              </span>
            </span>
          </li>
        </ol>
      </section>
    </div>
  </main>
</template>

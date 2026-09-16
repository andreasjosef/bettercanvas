<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { Course } from '../api/canvas'
import { canvasQueryOptions } from '../api/keys'
import { useCanvasToken } from '../api/useCanvasToken'
import type { Program } from '../programs'

interface PickerEntry {
  courseId: number
  name: string
  selected: boolean
  archived: boolean
}

const props = defineProps<{
  heading: string
  description: string
  initialPrograms?: Program[]
}>()

const emit = defineEmits<{ confirm: [programs: Program[]] }>()

const { token, tokenEnabled } = useCanvasToken()

const query = useQuery(
  computed(() => ({
    ...canvasQueryOptions.courses(token ?? ''),
    enabled: tokenEnabled.value,
  })),
)

const loadError = computed(() =>
  query.error.value
    ? 'Could not load your Courses from Canvas. Check your connection and reload the page.'
    : null,
)
const loading = computed(() => query.isPending.value)
const courses = computed(() => query.data.value ?? [])

// Entries live in a ref (deep-reactive) rather than a computed: the user's
// checkbox toggles mutate entries in place, and a computed's cached value is
// not deeply reactive, so those mutations would never re-render the form.
const entries = ref<PickerEntry[]>([])

watchEffect(() => {
  entries.value = buildEntries(courses.value, props.initialPrograms ?? [])
})

function buildEntries(courses: Course[], initialPrograms: Program[]): PickerEntry[] {
  const programByCourseId = new Map(
    initialPrograms.map((program) => [program.courseId, program]),
  )
  const entries = courses.map((course) => {
    const program = programByCourseId.get(course.id)
    return {
      courseId: course.id,
      name: course.name,
      selected: program !== undefined,
      archived: program?.archived ?? false,
    }
  })
  for (const program of initialPrograms) {
    if (!courses.some((course) => course.id === program.courseId)) {
      entries.push({
        courseId: program.courseId,
        name: program.name,
        selected: true,
        archived: program.archived,
      })
    }
  }
  return entries
}

function toggle(entry: PickerEntry, checked: boolean): void {
  entry.selected = checked
  if (checked) {
    entry.archived = false
  }
}

function toggleArchived(entry: PickerEntry, checked: boolean): void {
  entry.archived = checked
}

function confirmSelection(): void {
  emit(
    'confirm',
    entries.value
      .filter((entry) => entry.selected)
      .map((entry) => ({
        courseId: entry.courseId,
        name: entry.name,
        archived: entry.archived,
      })),
  )
}
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center p-4 text-center gap-2">
    <h1 class="m-0 font-heading text-heading text-2xl">{{ heading }}</h1>
    <p class="m-0 text-text-muted">
      {{ description }}
    </p>
    <p v-if="loadError" role="alert" class="m-0 text-sm text-danger">
      {{ loadError }}
    </p>
    <p v-else-if="loading" class="m-0 text-text-muted">Loading…</p>
    <form v-else class="flex flex-col items-center gap-2 max-w-sm w-full" @submit.prevent="confirmSelection">
      <p v-if="entries.length === 0" class="m-0 text-text-muted">
        No Canvas courses found on your account.
      </p>
      <ul v-else class="m-0 w-full list-none p-0 flex flex-col gap-1">
        <li
          v-for="entry in entries"
          :key="entry.courseId"
          class="flex items-center justify-between gap-2 text-left"
        >
          <label class="flex items-center gap-2 p-1 cursor-pointer">
            <input
              type="checkbox"
              :aria-label="entry.name"
              :checked="entry.selected"
              @change="toggle(entry, ($event.target as HTMLInputElement).checked)"
              class="accent-accent"
            />
            <span>{{ entry.name }}</span>
          </label>
          <label v-if="entry.selected" class="flex items-center gap-2 p-1 cursor-pointer text-sm text-text-muted">
            <input
              type="checkbox"
              :aria-label="`Archive ${entry.name}`"
              :checked="entry.archived"
              @change="toggleArchived(entry, ($event.target as HTMLInputElement).checked)"
              class="accent-accent"
            />
            <span>Archived</span>
          </label>
        </li>
      </ul>
      <button
        type="submit"
        class="rounded-md bg-accent px-4 py-2 font-heading text-accent-text hover:opacity-90"
      >
        Confirm
      </button>
    </form>
  </main>
</template>

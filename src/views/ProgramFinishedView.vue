<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { Assignment, CourseModule, ModuleItem } from '../api/canvas'
import { canvasQueryOptions } from '../api/keys'
import { useCanvasToken } from '../api/useCanvasToken'
import {
  doneVersion,
  isAssignmentDone,
  isLessonDone,
  isModuleDone,
  setAssignmentDone,
  unmarkItemDone,
  unmarkModuleDone,
} from '../done'

const props = defineProps<{ programId: string }>()

const { token, tokenEnabled } = useCanvasToken()

const courseId = computed(() => Number(props.programId))
const modulesQuery = useQuery(
  computed(() => ({
    ...canvasQueryOptions.modules(courseId.value, token ?? ''),
    enabled: tokenEnabled.value,
  })),
)
const assignmentsQuery = useQuery(
  computed(() => ({
    ...canvasQueryOptions.assignments(courseId.value, token ?? ''),
    enabled: tokenEnabled.value,
  })),
)

const loading = computed(
  () => modulesQuery.isPending.value || assignmentsQuery.isPending.value,
)
const failed = computed(
  () => modulesQuery.isError.value || assignmentsQuery.isError.value,
)
const modules = computed(() => modulesQuery.data.value ?? [])
const assignments = computed(() => assignmentsQuery.data.value ?? [])

const doneModules = computed(() => {
  void doneVersion.value
  return modules.value.filter((module_) => isModuleDone(courseId.value, module_))
})

function doneLessonsOf(module_: CourseModule): ModuleItem[] {
  return (module_.items ?? []).filter(
    (item) => item.type === 'Page' && isLessonDone(courseId.value, item.id),
  )
}

const doneLessons = computed(() => {
  void doneVersion.value
  return modules.value.flatMap(doneLessonsOf)
})

// Done Assignments come from the Program's Assignment list, keyed by the
// shared Canvas Assignment id: one row per Assignment no matter how many
// Modules link it, plus ones marked Done from the landing aggregate.
const doneAssignments = computed(() => {
  void doneVersion.value
  return assignments.value.filter((assignment) =>
    isAssignmentDone(courseId.value, assignment.id),
  )
})

function unmarkAssignmentDone(assignment: Assignment): void {
  setAssignmentDone(courseId.value, assignment.id, false)
}

function unmarkModule(module_: CourseModule): void {
  unmarkModuleDone(courseId.value, module_)
}
</script>

<template>
  <div class="w-full max-w-2xl mx-auto flex flex-col p-4 gap-4">
    <h1 class="m-0 font-heading text-heading text-2xl">
      Finished
    </h1>
    <p
      v-if="!loading && failed"
      class="m-0 text-danger"
    >
      Could not load Finished.
    </p>
    <template v-else-if="!loading">
      <p
        v-if="
          doneModules.length === 0 &&
            doneLessons.length === 0 &&
            doneAssignments.length === 0
        "
        class="m-0 text-text-muted"
      >
        Nothing Done yet.
      </p>
      <section
        v-if="doneModules.length > 0"
        data-testid="finished-modules"
        class="flex flex-col gap-2"
      >
        <h2 class="m-0 font-heading text-heading text-lg">
          Done Modules
        </h2>
        <ol class="m-0 list-none p-0 flex flex-col">
          <li
            v-for="module_ in doneModules"
            :key="module_.id"
            class="flex items-center justify-between gap-3 py-2 border-b border-border"
          >
            <span class="text-heading">{{ module_.name }}</span>
            <button
              type="button"
              :data-testid="`unmark-module-${module_.id}`"
              class="flex-none text-sm text-text-muted hover:text-heading"
              @click="unmarkModule(module_)"
            >
              Un-mark
            </button>
          </li>
        </ol>
      </section>
      <section
        v-if="doneLessons.length > 0"
        data-testid="finished-lessons"
        class="flex flex-col gap-2"
      >
        <h2 class="m-0 font-heading text-heading text-lg">
          Done Lessons
        </h2>
        <ol class="m-0 list-none p-0 flex flex-col">
          <li
            v-for="item in doneLessons"
            :key="item.id"
            class="flex items-center justify-between gap-3 py-2 border-b border-border"
          >
            <span class="text-heading">{{ item.title }}</span>
            <button
              type="button"
              :data-testid="`unmark-done-${item.id}`"
              class="flex-none text-sm text-text-muted hover:text-heading"
              @click="unmarkItemDone(courseId, item)"
            >
              Un-mark
            </button>
          </li>
        </ol>
      </section>
      <section
        v-if="doneAssignments.length > 0"
        data-testid="finished-assignments"
        class="flex flex-col gap-2"
      >
        <h2 class="m-0 font-heading text-heading text-lg">
          Done Assignments
        </h2>
        <ol class="m-0 list-none p-0 flex flex-col">
          <li
            v-for="assignment in doneAssignments"
            :key="assignment.id"
            class="flex items-center justify-between gap-3 py-2 border-b border-border"
          >
            <span class="text-heading">{{ assignment.name }}</span>
            <button
              type="button"
              :data-testid="`unmark-done-${assignment.id}`"
              class="flex-none text-sm text-text-muted hover:text-heading"
              @click="unmarkAssignmentDone(assignment)"
            >
              Un-mark
            </button>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>

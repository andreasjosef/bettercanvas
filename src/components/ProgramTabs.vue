<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { loadPrograms } from '../programs'

const props = defineProps<{
  programId: string
  active: 'modules' | 'assignments'
}>()

const tabs = [
  { key: 'modules', label: 'Modules' },
  { key: 'assignments', label: 'Assignments' },
] as const

const programName = computed(() => {
  const program = loadPrograms().find(
    (candidate) => candidate.courseId === Number(props.programId),
  )
  if (program) return program.name
  return props.active === 'modules' ? 'Modules' : 'Assignments'
})
</script>

<template>
  <div class="w-full max-w-2xl flex flex-col gap-2">
    <h1 class="m-0 font-heading text-heading text-2xl">{{ programName }}</h1>
    <nav
      data-testid="program-tabs"
      aria-label="Program sections"
      class="flex gap-4 border-b border-border"
    >
      <RouterLink
        v-for="tab in tabs"
        :key="tab.key"
        :to="{ name: `program-${tab.key}`, params: { programId } }"
        :data-testid="`tab-${tab.key}`"
        class="pb-2 border-b-2 text-sm"
        :class="
          active === tab.key
            ? 'border-accent text-heading'
            : 'border-transparent text-text-muted hover:opacity-90'
        "
      >
        {{ tab.label }}
      </RouterLink>
    </nav>
  </div>
</template>

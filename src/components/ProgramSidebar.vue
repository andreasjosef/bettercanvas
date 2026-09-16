<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { canvasQueryOptions } from '../api/keys'
import { useCanvasToken } from '../api/useCanvasToken'
import { isModuleDone, doneVersion } from '../done'

const props = defineProps<{ programId: string }>()

const route = useRoute()
const { token, tokenEnabled } = useCanvasToken()

const courseId = computed(() => Number(props.programId))
const modulesQuery = useQuery(
  computed(() => ({
    ...canvasQueryOptions.modules(courseId.value, token ?? ''),
    enabled: tokenEnabled.value,
  })),
)

const modules = computed(() => modulesQuery.data.value ?? [])
// A Done Module is excluded from normal navigation. Reading doneVersion
// keeps this filter reactive to localStorage-backed Done changes.
const visibleModules = computed(() => {
  void doneVersion.value
  return modules.value.filter((module_) => !isModuleDone(courseId.value, module_))
})

function isActive(testid: string): boolean {
  if (testid === 'sidebar-due-soon') return route.name === 'program'
  if (testid === 'sidebar-finished') return route.name === 'program-finished'
  if (testid.startsWith('sidebar-module-')) {
    return (
      route.name === 'program-module' &&
      route.params.moduleId === testid.slice('sidebar-module-'.length)
    )
  }
  return false
}

function linkClass(testid: string): Record<string, boolean> {
  return {
    'block px-2 py-1 no-underline text-sm rounded-sm': true,
    'text-heading': isActive(testid),
    'text-text-muted hover:opacity-90': !isActive(testid),
  }
}

function moduleKey(module_: { id: number }): string {
  return `sidebar-module-${module_.id}`
}
</script>

<template>
  <aside
    data-testid="program-sidebar"
    aria-label="Program sections"
    class="w-56 flex-none bg-surface-alt border-r border-border py-5 px-3 flex flex-col gap-1"
  >
    <RouterLink
      :to="{ name: 'program', params: { programId } }"
      data-testid="sidebar-due-soon"
      :class="linkClass('sidebar-due-soon')"
      :aria-current="isActive('sidebar-due-soon') ? 'page' : undefined"
    >
      Due soon
    </RouterLink>
    <RouterLink
      :to="{ name: 'program-finished', params: { programId } }"
      data-testid="sidebar-finished"
      :class="linkClass('sidebar-finished')"
      :aria-current="isActive('sidebar-finished') ? 'page' : undefined"
    >
      Finished
    </RouterLink>
    <span
      class="px-2 mt-4 mb-1 text-xs uppercase tracking-wide text-text-muted"
    >
      Modules
    </span>
    <RouterLink
      v-for="module_ in visibleModules"
      :key="module_.id"
      :to="{
        name: 'program-module',
        params: { programId, moduleId: String(module_.id) },
      }"
      :data-testid="moduleKey(module_)"
      :class="linkClass(moduleKey(module_))"
      :aria-current="isActive(moduleKey(module_)) ? 'page' : undefined"
    >
      {{ module_.name }}
    </RouterLink>
  </aside>
</template>

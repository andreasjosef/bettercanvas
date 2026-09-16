<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { canvasQueryOptions } from '../api/keys'
import { useCanvasToken } from '../api/useCanvasToken'
import { isModuleDone, doneVersion } from '../done'

const navLinkClass =
  'no-underline text-sm text-text-muted p-2 rounded-sm hover:opacity-90'

const route = useRoute()

// Deliberately a direct conditional for the one contextual nav level that
// exists today (Program) — not a generic route-driven nav-content mechanism.
const programId = computed(() =>
  typeof route.params.programId === 'string' ? route.params.programId : null,
)
const inProgram = computed(() => programId.value !== null)

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

const { token, tokenEnabled } = useCanvasToken()

const courseId = computed(() => Number(programId.value))
const modulesQuery = useQuery(
  computed(() => ({
    ...canvasQueryOptions.modules(courseId.value, token ?? ''),
    enabled: tokenEnabled.value && programId.value !== null,
  })),
)

const modules = computed(() => modulesQuery.data.value ?? [])
// A Done Module is excluded from normal navigation. Reading doneVersion
// keeps this filter reactive to localStorage-backed Done changes.
const visibleModules = computed(() => {
  void doneVersion.value
  if (programId.value === null) return []
  return modules.value.filter((module_) => !isModuleDone(courseId.value, module_))
})
</script>

<template>
  <div class="flex min-h-screen">
    <aside
      data-testid="program-sidebar"
      class="w-drawer flex-none bg-surface-alt border-r border-border py-5 px-3 flex flex-col gap-1"
    >
      <RouterLink
        :to="{ name: 'home' }"
        class="no-underline font-heading font-semibold text-heading px-2 pb-4"
      >
        Better Canvas
      </RouterLink>
      <template v-if="inProgram">
        <RouterLink
          :to="{ name: 'program', params: { programId: programId! } }"
          data-testid="sidebar-due-soon"
          :class="linkClass('sidebar-due-soon')"
          :aria-current="isActive('sidebar-due-soon') ? 'page' : undefined"
        >
          Due soon
        </RouterLink>
        <RouterLink
          :to="{ name: 'program-finished', params: { programId: programId! } }"
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
            params: { programId: programId!, moduleId: String(module_.id) },
          }"
          :data-testid="moduleKey(module_)"
          :class="linkClass(moduleKey(module_))"
          :aria-current="isActive(moduleKey(module_)) ? 'page' : undefined"
        >
          {{ module_.name }}
        </RouterLink>
      </template>
      <template v-else>
        <div class="flex-1" />
        <nav class="flex flex-col gap-1">
          <RouterLink
            :to="{ name: 'previous-lectures' }"
            :class="navLinkClass"
          >
            Previous Lectures
          </RouterLink>
          <RouterLink :to="{ name: 'settings' }" :class="navLinkClass">
            Settings
          </RouterLink>
        </nav>
      </template>
    </aside>
    <div class="flex-1 min-w-0">
      <slot />
    </div>
  </div>
</template>

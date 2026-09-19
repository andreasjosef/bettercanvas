<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import type { ModuleItem } from '../api/canvas'
import { canvasQueryOptions } from '../api/keys'
import { useCanvasToken } from '../api/useCanvasToken'
import {
  doneVersion,
  isAssignmentDone,
  isLessonDone,
  markItemDone,
  markModuleDone,
} from '../done'

const props = defineProps<{ programId: string; moduleId: string }>()

const route = useRoute()
const { token, tokenEnabled } = useCanvasToken()

const courseId = computed(() => Number(props.programId))
const modulesQuery = useQuery(
  computed(() => ({
    ...canvasQueryOptions.modules(courseId.value, token ?? ''),
    enabled: tokenEnabled.value,
  })),
)

const loading = computed(() => modulesQuery.isPending.value)
const failed = computed(() => modulesQuery.isError.value)
const module_ = computed(() =>
  (modulesQuery.data.value ?? []).find(
    (candidate) => candidate.id === Number(props.moduleId),
  ),
)

type ModuleTab = 'lessons' | 'assignments'

const TABS: ModuleTab[] = ['lessons', 'assignments']

const activeTab = computed<ModuleTab>(() =>
  route.query.tab === 'assignments' ? 'assignments' : 'lessons',
)

const lessons = computed(() => {
  // doneVersion is bumped on every Done mutation; reading it keeps this
  // filter reactive to localStorage-backed Done changes.
  void doneVersion.value
  const items = module_.value?.items ?? []
  return items.filter(
    (item) =>
      item.type !== 'Assignment' &&
      !(item.type === 'Page' && isLessonDone(courseId.value, item.id)),
  )
})

const assignments = computed(() => {
  void doneVersion.value
  const items = module_.value?.items ?? []
  return items.filter(
    (item) =>
      item.type === 'Assignment' &&
      !(
        typeof item.content_id === 'number' &&
        isAssignmentDone(courseId.value, item.content_id)
      ),
  )
})

function markThisModuleDone(): void {
  if (module_.value) markModuleDone(courseId.value, module_.value)
}

const visibleItems = computed(() =>
  activeTab.value === 'lessons' ? lessons.value : assignments.value,
)

function canvasItemHref(item: ModuleItem): string {
  return item.html_url ?? item.external_url ?? ''
}
</script>

<template>
  <div class="w-full max-w-2xl mx-auto flex flex-col p-4 gap-4">
    <p
      v-if="!loading && failed"
      class="m-0 text-danger"
    >
      Could not load modules.
    </p>
    <p
      v-else-if="!loading && !module_"
      class="m-0 text-text-muted"
    >
      That Module is not part of this Program.
    </p>
    <template v-else-if="module_">
      <div class="flex items-baseline justify-between gap-3">
        <h1 class="m-0 font-heading text-heading text-2xl">
          {{ module_.name }}
        </h1>
        <button
          type="button"
          data-testid="mark-module-done"
          class="flex-none text-sm text-text-muted hover:text-heading"
          @click="markThisModuleDone"
        >
          Mark Module Done
        </button>
      </div>
      <nav
        data-testid="module-tabs"
        aria-label="Module sections"
        class="flex gap-4 border-b border-border"
      >
        <RouterLink
          v-for="tab in TABS"
          :key="tab"
          :to="{
            name: 'program-module',
            params: { programId, moduleId },
            query: tab === 'lessons' ? {} : { tab },
          }"
          :data-testid="`module-tab-${tab}`"
          class="pb-2 border-b-2 text-sm no-underline"
          :class="
            activeTab === tab
              ? 'border-accent text-heading'
              : 'border-transparent text-text-muted hover:opacity-90'
          "
          :aria-current="activeTab === tab ? 'page' : undefined"
        >
          {{ tab === 'lessons' ? 'Lessons' : 'Assignments' }}
        </RouterLink>
      </nav>
      <div class="flex flex-col gap-2">
        <p
          v-if="visibleItems.length === 0"
          class="m-0 text-text-muted"
        >
          {{
            activeTab === 'lessons'
              ? 'No Lessons in this Module.'
              : 'No Assignments in this Module.'
          }}
        </p>
        <ol
          v-else
          class="m-0 list-none p-0 flex flex-col"
        >
          <li
            v-for="item in visibleItems"
            :key="item.id"
          >
            <template v-if="item.type === 'SubHeader'">
              <span
                data-testid="subheader-divider"
                class="block border-b border-border pb-1 mt-4 font-heading text-heading text-sm uppercase tracking-wide"
              >
                {{ item.title }}
              </span>
            </template>
            <template v-else-if="item.type === 'Page' || item.type === 'Assignment'">
              <div
                class="flex items-center justify-between gap-3 py-2 border-b border-border"
              >
                <RouterLink
                  :to="{
                    name: 'reading',
                    params: { programId, itemId: String(item.id) },
                  }"
                  class="text-accent hover:opacity-90"
                >
                  {{ item.title }}
                </RouterLink>
                <button
                  type="button"
                  :data-testid="`mark-done-${item.id}`"
                  class="flex-none text-sm text-text-muted hover:text-heading"
                  @click="markItemDone(courseId, item)"
                >
                  Mark Done
                </button>
              </div>
            </template>
            <template v-else-if="canvasItemHref(item)">
              <a
                :href="canvasItemHref(item)"
                target="_blank"
                rel="noopener noreferrer"
                class="block py-2 border-b border-border text-text-muted hover:opacity-90"
              >
                {{ item.title }} ↗
              </a>
            </template>
            <template v-else>
              <span class="block py-2 border-b border-border text-text-muted">
                {{ item.title }}
              </span>
            </template>
          </li>
        </ol>
      </div>
    </template>
  </div>
</template>

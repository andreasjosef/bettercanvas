<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import type { ModuleItem } from '../api/canvas'
import { canvasQueryOptions } from '../api/keys'
import { useCanvasToken } from '../api/useCanvasToken'
import { sanitizeCanvasHtml } from '../sanitize'
import { highlightCodeBlocks } from '../highlight'
import { applyHighlightTheme, DEFAULT_HIGHLIGHT_THEME } from '../highlightTheme'

const props = defineProps<{ programId: string; itemId: string }>()

const { token, tokenEnabled } = useCanvasToken()

const courseId = computed(() => Number(props.programId))

const modulesQuery = useQuery(
  computed(() => ({
    ...canvasQueryOptions.modules(courseId.value, token ?? ''),
    enabled: tokenEnabled.value,
  })),
)

const located = computed(() => {
  const modules = modulesQuery.data.value
  if (!modules) return null
  for (const module_ of modules) {
    const item = module_.items?.find(
      (candidate) => candidate.id === Number(props.itemId),
    )
    if (item) return { item, module: module_ }
  }
  return null
})

const item = computed<ModuleItem | null>(() => located.value?.item ?? null)
const moduleName = computed(() => located.value?.module.name ?? '')

const pageUrl = computed(() => {
  if (item.value?.type !== 'Page' || !item.value.page_url) return null
  return item.value.page_url
})
const assignmentId = computed(() => {
  if (item.value?.type !== 'Assignment' || !item.value.content_id) return null
  return item.value.content_id
})

const pageBodyQuery = useQuery(
  computed(() => ({
    ...canvasQueryOptions.pageBody(
      courseId.value,
      pageUrl.value ?? '',
      token ?? '',
    ),
    enabled: tokenEnabled.value && pageUrl.value !== null,
  })),
)

const assignmentDescriptionQuery = useQuery(
  computed(() => ({
    ...canvasQueryOptions.assignmentDescription(
      courseId.value,
      assignmentId.value ?? 0,
      token ?? '',
    ),
    enabled: tokenEnabled.value && assignmentId.value !== null,
  })),
)

const contentQuery = computed(() =>
  pageUrl.value !== null
    ? pageBodyQuery
    : assignmentId.value !== null
      ? assignmentDescriptionQuery
      : null,
)

const loading = computed(
  () => modulesQuery.isPending.value || contentQuery.value?.isPending.value === true,
)
const failed = computed(
  () => modulesQuery.isError.value || contentQuery.value?.isError.value === true,
)
const notFound = computed(
  () =>
    !modulesQuery.isPending.value &&
    !modulesQuery.isError.value &&
    located.value === null,
)
const rawHtml = computed(() => {
  const data = contentQuery.value?.data.value
  return typeof data === 'string' ? data : ''
})
const contentEl = ref<HTMLElement | null>(null)

const sanitizedHtml = computed(() => sanitizeCanvasHtml(rawHtml.value))

// Highlight only once the sanitized body is in the DOM, scoped to the
// reading column — never a global highlightAll() across the page. The
// theme stylesheet loads with it; unauthenticated visits that redirect
// away never inject it.
watch(
  sanitizedHtml,
  () => {
    if (!contentEl.value) return
    applyHighlightTheme(DEFAULT_HIGHLIGHT_THEME)
    highlightCodeBlocks(contentEl.value)
  },
  { flush: 'post' },
)

function isReadableType(type: ModuleItem['type']): boolean {
  return type === 'Page' || type === 'Assignment'
}
</script>

<template>
  <main class="mx-auto w-full max-w-3xl flex flex-col gap-4 p-4">
    <p v-if="loading" class="m-0 text-text-muted">Loading…</p>
    <p v-else-if="failed" class="m-0 text-danger">
      Could not load this item.
    </p>
    <p v-else-if="notFound" class="m-0 text-text-muted">
      That item is not part of this Program.
    </p>
    <template v-else-if="item">
      <RouterLink
        :to="{
          name: 'program-module',
          params: { programId, moduleId: String(located!.module.id) },
        }"
        class="self-start text-text-muted no-underline hover:text-accent"
      >
        ← {{ moduleName }}
      </RouterLink>
      <article class="reading-column">
        <h1>{{ item.title }}</h1>
        <template v-if="isReadableType(item.type)">
          <div v-if="sanitizedHtml === ''" class="text-text-muted">
            This item has no content yet.
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -- content passes through sanitizeCanvasHtml first -->
          <div v-else ref="contentEl" v-html="sanitizedHtml" />
        </template>
        <!--
          Only Page/Assignment items link here from the Modules view, but a
          deep link (pasted URL) can point at a link-out item type — render
          it as a Canvas link-out rather than an empty article (user story
          14: never a broken inline preview of content we don't own).
        -->
        <a
          v-else-if="item.html_url"
          :href="item.html_url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-accent"
        >
          Open in Canvas ↗
        </a>
      </article>
    </template>
  </main>
</template>

<style scoped>
/*
 * The reading column: single-column, book-like measure per the
 * prototype/issue-5-reading-flow direction. v-html content cannot carry
 * Tailwind classes, so descendant typography is styled here through the
 * token custom properties mapped into Tailwind's theme in style.css.
 */
.reading-column {
  max-width: 65ch;
}
.reading-column :deep(h1),
.reading-column :deep(h2),
.reading-column :deep(h3),
.reading-column :deep(h4),
.reading-column :deep(h5),
.reading-column :deep(h6) {
  font-family: var(--font-heading);
  color: var(--color-heading);
  font-size: var(--text-xl);
  line-height: var(--leading-tight);
  font-weight: 500;
  margin: var(--space-5) 0 var(--space-3);
}
.reading-column :deep(h1) {
  font-size: var(--text-2xl);
  margin: 0 0 var(--space-4);
}
.reading-column :deep(p) {
  margin: 0 0 var(--space-4);
  line-height: var(--leading-relaxed);
}
.reading-column :deep(ul),
.reading-column :deep(ol) {
  margin: 0 0 var(--space-4);
  padding-left: var(--space-4);
  line-height: var(--leading-relaxed);
}
.reading-column :deep(img) {
  max-width: 100%;
  height: auto;
}
.reading-column :deep(a) {
  color: var(--color-accent);
}
.reading-column :deep(blockquote) {
  margin: 0 0 var(--space-4);
  padding-left: var(--space-3);
  border-left: 3px solid var(--color-border);
  color: var(--color-text-muted);
}
.reading-column :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: var(--space-5) 0;
}
.reading-column :deep(table) {
  border-collapse: collapse;
  margin: 0 0 var(--space-4);
}
.reading-column :deep(th),
.reading-column :deep(td) {
  border: 1px solid var(--color-border);
  padding: var(--space-1) var(--space-2);
}
.reading-column :deep(pre) {
  background: var(--code-bg);
  border: 1px solid var(--code-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  overflow-x: auto;
  margin: 0 0 var(--space-4);
}
/*
 * Highlighted code blocks: the highlight module wraps each pre in a
 * .code-block positioning context and appends a per-block language
 * override select (auto-detection is a heuristic, so a wrong detection
 * is never stuck wrong).
 */
.reading-column :deep(.code-block) {
  position: relative;
}
.reading-column :deep(.code-lang-select) {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  background: var(--color-surface);
  color: var(--color-text-muted);
  border: 1px solid var(--code-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  padding: 0 var(--space-1);
}
.reading-column :deep(.code-lang-select:focus-visible) {
  border-color: var(--color-accent);
  outline: none;
}
.reading-column :deep(code) {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--code-text);
  line-height: var(--leading-normal);
}
.reading-column :deep(pre code) {
  display: block;
  background: none;
  border: none;
  padding: 0;
}
.reading-column :deep(:not(pre) > code) {
  background: var(--code-bg);
  border: 1px solid var(--code-border);
  border-radius: var(--radius-sm);
  padding: 0 var(--space-1);
}
</style>

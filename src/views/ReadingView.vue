<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  fetchAssignmentDescription,
  fetchPageBody,
  locateModuleItem,
  type ModuleItem,
} from '../api/canvas'
import { loadToken } from '../token'
import { sanitizeCanvasHtml } from '../sanitize'

const props = defineProps<{ programId: string; itemId: string }>()

const router = useRouter()
const loading = ref(true)
const failed = ref(false)
const notFound = ref(false)
const item = ref<ModuleItem | null>(null)
const moduleName = ref('')
const rawHtml = ref('')

const sanitizedHtml = computed(() => sanitizeCanvasHtml(rawHtml.value))

function isReadableType(type: ModuleItem['type']): boolean {
  return type === 'Page' || type === 'Assignment'
}

onMounted(async () => {
  const token = loadToken()
  if (!token) {
    await router.replace({ name: 'connect' })
    return
  }
  try {
    const courseId = Number(props.programId)
    const located = await locateModuleItem(token, courseId, Number(props.itemId))
    if (!located) {
      notFound.value = true
      return
    }
    item.value = located.item
    moduleName.value = located.module.name
    if (located.item.type === 'Page') {
      if (!located.item.page_url) throw new Error('Page item has no page_url')
      rawHtml.value =
        (await fetchPageBody(token, courseId, located.item.page_url)) ?? ''
    } else if (located.item.type === 'Assignment') {
      if (!located.item.content_id) {
        throw new Error('Assignment item has no content_id')
      }
      rawHtml.value =
        (await fetchAssignmentDescription(
          token,
          courseId,
          located.item.content_id,
        )) ?? ''
    }
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})
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
        :to="{ name: 'program-modules', params: { programId } }"
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
          <div v-else v-html="sanitizedHtml" />
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

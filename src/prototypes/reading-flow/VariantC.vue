<!-- PROTOTYPE — Variant C: "Editorial Digest". Top horizontal nav, spacious
     magazine-style layout, timeline for assignments, docs-style two-column
     reading view with a sticky TOC. -->
<script setup lang="ts">
import { ref } from 'vue'
import {
  programs,
  modules,
  assignments,
  modulePage,
  availableCourses,
} from './fixtures'
import type { Screen } from './screens'

defineProps<{ screen: Screen }>()
const emit = defineEmits<{ navigate: [screen: Screen] }>()

const selectedCourses = ref(new Set(['c1', 'c2', 'c3']))
function toggleCourse(id: string) {
  selectedCourses.value.has(id) ? selectedCourses.value.delete(id) : selectedCourses.value.add(id)
}

const activePrograms = programs.filter((p) => p.status === 'active')
const grouped = {
  today: assignments.filter((a) => a.dueGroup === 'today'),
  'this-week': assignments.filter((a) => a.dueGroup === 'this-week'),
  later: assignments.filter((a) => a.dueGroup === 'later'),
}
</script>

<template>
  <div class="editorial">
    <div v-if="screen === 'connect'" class="split">
      <div class="brand-panel">
        <div class="wordmark">Better Canvas</div>
        <p>A calmer place to read your coursework.</p>
      </div>
      <div class="form-panel">
        <form @submit.prevent="emit('navigate', 'picker')">
          <h1>Connect</h1>
          <label>Base URL<input type="text" placeholder="https://school.instructure.com" /></label>
          <label>Access token<input type="password" placeholder="•••••••••••••••" /></label>
          <button type="submit">Connect →</button>
        </form>
      </div>
    </div>

    <div v-else-if="screen === 'picker'" class="split">
      <div class="brand-panel">
        <div class="wordmark">Better Canvas</div>
        <p>Choose which courses matter. Admin noise stays out.</p>
      </div>
      <div class="form-panel">
        <h1>Your Programs</h1>
        <ul class="course-list">
          <li v-for="c in availableCourses" :key="c.id">
            <label>
              <input type="checkbox" :checked="selectedCourses.has(c.id)" @change="toggleCourse(c.id)" />
              <span class="course-name">{{ c.name }}</span>
              <span class="course-term">{{ c.term }}</span>
            </label>
          </li>
        </ul>
        <button type="button" @click="emit('navigate', 'home')">Continue →</button>
      </div>
    </div>

    <div v-else class="app">
      <header class="topnav">
        <div class="wordmark">Better Canvas</div>
        <button
          v-for="p in activePrograms"
          :key="p.id"
          type="button"
          class="nav-pill"
          @click="emit('navigate', 'modules')"
        >
          {{ p.name }}
        </button>
        <div class="spacer" />
        <button type="button" class="nav-link">Previous Lectures</button>
      </header>

      <main>
        <template v-if="screen === 'home'">
          <h1 class="hero-title">Your Programs</h1>
          <div class="feature-rows">
            <button
              v-for="p in activePrograms"
              :key="p.id"
              type="button"
              class="feature-row"
              @click="emit('navigate', 'modules')"
            >
              <span class="feature-title">{{ p.name }}</span>
              <span class="feature-sub">{{ p.term }} · {{ p.moduleCount }} modules</span>
              <span v-if="p.nextDue" class="feature-due">{{ p.nextDue }}</span>
            </button>
          </div>
        </template>

        <template v-else-if="screen === 'modules'">
          <div class="section-nav">
            <span class="section-tab active">Modules</span>
            <span class="section-tab" @click="emit('navigate', 'assignments')">Assignments</span>
          </div>
          <h1 class="hero-title">Vue &amp; the Modern Web</h1>
          <ol class="toc-list">
            <li v-for="(m, i) in modules" :key="m.id" @click="emit('navigate', 'reading')">
              <span class="toc-number">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="toc-body">
                <span class="toc-title">{{ m.title.replace(/^\d+\.\s*/, '') }}</span>
                <span class="toc-sub">{{ m.summary }}</span>
              </span>
              <span v-if="m.done" class="toc-done">Read</span>
            </li>
          </ol>
        </template>

        <template v-else-if="screen === 'assignments'">
          <div class="section-nav">
            <span class="section-tab" @click="emit('navigate', 'modules')">Modules</span>
            <span class="section-tab active">Assignments</span>
          </div>
          <h1 class="hero-title">Assignments</h1>
          <div class="timeline">
            <div v-for="(group, key) in grouped" :key="key" class="timeline-group">
              <div class="timeline-label">{{ String(key).replace('-', ' ') }}</div>
              <div v-for="a in group" :key="a.id" class="timeline-item">
                <span class="timeline-dot" :class="a.status" />
                <span class="timeline-title">{{ a.title }}</span>
                <span class="timeline-sub">{{ a.programName }} · {{ a.dueLabel }}</span>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="screen === 'reading'">
          <div class="reading-layout">
            <aside class="mini-toc">
              <button type="button" class="back-link" @click="emit('navigate', 'modules')">
                ← {{ modulePage.moduleTitle }}
              </button>
              <div class="mini-toc-item active">Composables vs. a store</div>
              <div class="mini-toc-item">Example</div>
            </aside>
            <article class="reading-column">
              <h1 class="hero-title">{{ modulePage.title }}</h1>
              <p v-for="(para, i) in modulePage.paragraphs" :key="i">{{ para }}</p>
              <pre class="code"><code v-html="modulePage.codeHtml"></code></pre>
            </article>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.editorial {
  min-height: 100vh;
}
h1 {
  font-family: var(--font-heading);
  color: var(--color-heading);
  margin: 0 0 var(--space-4);
}
.hero-title {
  font-size: var(--text-2xl);
  line-height: var(--leading-tight);
  font-weight: 600;
}
button {
  font: inherit;
}

.split {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.brand-panel {
  background: var(--color-surface-alt);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--space-7);
}
.wordmark {
  font-family: var(--font-heading);
  font-size: var(--text-xl);
  color: var(--color-heading);
  font-weight: 600;
}
.form-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--space-7);
}
.form-panel form,
.form-panel {
  max-width: 380px;
}
.form-panel label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
}
.form-panel input {
  font: var(--text-base) / 1.4 var(--font-body);
  padding: var(--space-2) var(--space-3);
  border: none;
  border-bottom: 2px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
}
.form-panel button {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-accent);
  color: var(--color-accent-text);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.course-list {
  list-style: none;
  margin: 0 0 var(--space-3);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.course-list label {
  flex-direction: row;
  align-items: baseline;
  gap: var(--space-2);
  color: var(--color-text);
}
.course-term {
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.topnav {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-6);
  border-bottom: 1px solid var(--color-border);
}
.nav-pill {
  all: unset;
  cursor: pointer;
  padding: var(--space-1) var(--space-3);
  border-radius: 999px;
  background: var(--color-surface-alt);
  font-size: var(--text-sm);
}
.spacer {
  flex: 1;
}
.nav-link {
  all: unset;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

main {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-6);
}
.section-nav {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}
.section-tab {
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.section-tab.active {
  color: var(--color-accent);
  font-weight: 600;
}

.feature-rows {
  display: flex;
  flex-direction: column;
}
.feature-row {
  all: unset;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-5) 0;
  border-bottom: 1px solid var(--color-border);
}
.feature-title {
  font-family: var(--font-heading);
  font-size: var(--text-xl);
  color: var(--color-heading);
}
.feature-sub {
  color: var(--color-text-muted);
}
.feature-due {
  color: var(--color-accent);
  font-size: var(--text-sm);
}

.toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  counter-reset: none;
}
.toc-list li {
  cursor: pointer;
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--color-border);
}
.toc-number {
  font-family: var(--font-heading);
  font-size: var(--text-xl);
  color: var(--color-border);
  width: 2.5ch;
  flex: none;
}
.toc-body {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.toc-title {
  font-family: var(--font-heading);
  font-size: var(--text-lg);
  color: var(--color-heading);
}
.toc-sub {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}
.toc-done {
  color: var(--color-success);
  font-size: var(--text-xs);
  text-transform: uppercase;
}

.timeline-group {
  margin-bottom: var(--space-5);
}
.timeline-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}
.timeline-item {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-left: 2px solid var(--color-border);
  padding-left: var(--space-3);
  margin-left: 4px;
}
.timeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--color-text-muted);
  margin-left: -20px;
  flex: none;
}
.timeline-dot.overdue {
  background: var(--color-danger);
}
.timeline-dot.submitted {
  background: var(--color-success);
}
.timeline-title {
  color: var(--color-heading);
  font-weight: 600;
}
.timeline-sub {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.reading-layout {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: var(--space-6);
  align-items: start;
}
.mini-toc {
  position: sticky;
  top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.back-link {
  all: unset;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin-bottom: var(--space-2);
}
.mini-toc-item {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  padding-left: var(--space-2);
  border-left: 2px solid var(--color-border);
}
.mini-toc-item.active {
  color: var(--color-accent);
  border-left-color: var(--color-accent);
}
.reading-column p {
  margin: 0 0 var(--space-4);
  line-height: var(--leading-relaxed);
  max-width: 62ch;
}
.code {
  border-left: 3px solid var(--code-border);
  background: var(--code-bg);
  padding: var(--space-3) 0 var(--space-3) var(--space-4);
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--code-text);
  line-height: var(--leading-normal);
}
.code :deep(.tok-keyword) {
  color: var(--code-keyword);
}
.code :deep(.tok-string) {
  color: var(--code-string);
}
.code :deep(.tok-comment) {
  color: var(--code-comment);
  font-style: italic;
}
.code :deep(.tok-function) {
  color: var(--code-function);
}
.code :deep(.tok-number) {
  color: var(--code-number);
}
.code :deep(.tok-punct) {
  color: var(--code-punct);
}
</style>

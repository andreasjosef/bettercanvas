<!-- PROTOTYPE — Variant A: "Quiet Reader". Obsidian-style: a slide-out
     drawer for navigation, a narrow reading column, no cards. Dark-first,
     sans throughout, scaled ~1.2x — see tokens.css for why. -->
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
</script>

<template>
  <div class="reader">
    <div v-if="screen === 'connect'" class="centered">
      <form class="panel" @submit.prevent="emit('navigate', 'picker')">
        <h1>Connect to Canvas</h1>
        <p class="muted">Paste your school's Canvas URL and a personal access token.</p>
        <label>Base URL<input type="text" placeholder="https://school.instructure.com" /></label>
        <label>Access token<input type="password" placeholder="•••••••••••••••" /></label>
        <button type="submit">Connect</button>
      </form>
    </div>

    <div v-else-if="screen === 'picker'" class="centered">
      <div class="panel">
        <h1>Choose your Programs</h1>
        <p class="muted">Pick which Canvas courses should show up here. You can change this later.</p>
        <ul class="course-list">
          <li v-for="c in availableCourses" :key="c.id">
            <label>
              <input
                type="checkbox"
                :checked="selectedCourses.has(c.id)"
                @change="toggleCourse(c.id)"
              />
              <span class="course-name">{{ c.name }}</span>
              <span class="course-term">{{ c.term }}</span>
            </label>
          </li>
        </ul>
        <button type="button" @click="emit('navigate', 'home')">Continue</button>
      </div>
    </div>

    <div v-else class="app">
      <aside class="drawer">
        <div class="brand">Better Canvas</div>
        <button
          v-for="p in activePrograms"
          :key="p.id"
          type="button"
          class="drawer-link"
          @click="emit('navigate', 'modules')"
        >
          {{ p.name }}
        </button>
        <div class="drawer-spacer" />
        <button type="button" class="drawer-link muted-link">Previous Lectures</button>
      </aside>

      <main>
        <template v-if="screen === 'home'">
          <h1>Your Programs</h1>
          <div class="reading-list">
            <button
              v-for="p in activePrograms"
              :key="p.id"
              type="button"
              class="list-row"
              @click="emit('navigate', 'modules')"
            >
              <span class="row-title">{{ p.name }}</span>
              <span class="row-meta">{{ p.term }} · {{ p.moduleCount }} modules</span>
              <span v-if="p.nextDue" class="row-due">{{ p.nextDue }}</span>
            </button>
          </div>
        </template>

        <template v-else-if="screen === 'modules'">
          <h1>Vue &amp; the Modern Web</h1>
          <nav class="tabs">
            <span class="tab active">Modules</span>
            <span class="tab" @click="emit('navigate', 'assignments')">Assignments</span>
          </nav>
          <div class="reading-list">
            <button
              v-for="m in modules"
              :key="m.id"
              type="button"
              class="list-row"
              @click="emit('navigate', 'reading')"
            >
              <span class="row-title">{{ m.title }} <span v-if="m.done" class="check">✓</span></span>
              <span class="row-meta">{{ m.summary }} · {{ m.pageCount }} pages</span>
            </button>
          </div>
        </template>

        <template v-else-if="screen === 'assignments'">
          <h1>Vue &amp; the Modern Web</h1>
          <nav class="tabs">
            <span class="tab" @click="emit('navigate', 'modules')">Modules</span>
            <span class="tab active">Assignments</span>
          </nav>
          <div class="reading-list">
            <div v-for="a in assignments" :key="a.id" class="list-row static">
              <span class="row-title">{{ a.title }}</span>
              <span class="row-meta">{{ a.programName }} · due {{ a.dueLabel }}</span>
              <span class="badge" :class="a.status">{{ a.status }}</span>
            </div>
          </div>
        </template>

        <template v-else-if="screen === 'reading'">
          <button type="button" class="back-link" @click="emit('navigate', 'modules')">
            ← {{ modulePage.moduleTitle }}
          </button>
          <article class="reading-column">
            <h1>{{ modulePage.title }}</h1>
            <p v-for="(para, i) in modulePage.paragraphs" :key="i">{{ para }}</p>
            <pre class="code"><code v-html="modulePage.codeHtml"></code></pre>
          </article>
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.reader {
  min-height: 100vh;
}
h1 {
  font-family: var(--font-heading);
  color: var(--color-heading);
  font-size: var(--text-2xl);
  line-height: var(--leading-tight);
  margin: 0 0 var(--space-4);
  font-weight: 500;
}
.muted {
  color: var(--color-text-muted);
}
button {
  font: inherit;
}

.centered {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: var(--space-4);
}
.panel {
  width: 100%;
  max-width: 420px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.panel label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.panel input[type='text'],
.panel input[type='password'] {
  font: var(--text-base) / 1.4 var(--font-body);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
}
.panel button[type='submit'],
.panel > button {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-accent);
  color: var(--color-accent-text);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  align-self: flex-start;
}
.course-list {
  list-style: none;
  margin: 0;
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

.app {
  display: flex;
  min-height: 100vh;
}
.drawer {
  width: 288px;
  flex: none;
  background: var(--color-surface-alt);
  border-right: 1px solid var(--color-border);
  padding: var(--space-5) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.brand {
  font-family: var(--font-heading);
  font-weight: 600;
  color: var(--color-heading);
  padding: 0 var(--space-2) var(--space-4);
}
.drawer-link {
  all: unset;
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  border-left: 3px solid transparent;
}
.drawer-link:hover {
  border-left-color: var(--color-accent);
  background: var(--color-surface);
}
.drawer-spacer {
  flex: 1;
}
.muted-link {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

main {
  flex: 1;
  padding: var(--space-6) var(--space-6);
}
.tabs {
  display: flex;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-4);
}
.tab {
  padding-bottom: var(--space-2);
  color: var(--color-text-muted);
  cursor: pointer;
}
.tab.active {
  color: var(--color-heading);
  border-bottom: 2px solid var(--color-accent);
}

.reading-list {
  display: flex;
  flex-direction: column;
}
.list-row {
  all: unset;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
  position: relative;
}
.list-row.static {
  cursor: default;
}
.row-title {
  font-family: var(--font-heading);
  color: var(--color-heading);
  font-size: var(--text-lg);
}
.check {
  color: var(--color-success);
}
.row-meta {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}
.row-due {
  color: var(--color-accent);
  font-size: var(--text-sm);
}
.badge {
  position: absolute;
  right: 0;
  top: var(--space-3);
  font-size: var(--text-xs);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  text-transform: capitalize;
}
.badge.upcoming {
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
}
.badge.overdue {
  background: color-mix(in srgb, var(--color-danger) 15%, transparent);
  color: var(--color-danger);
}
.badge.submitted {
  background: color-mix(in srgb, var(--color-success) 15%, transparent);
  color: var(--color-success);
}

.back-link {
  all: unset;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
  display: inline-block;
}
.reading-column {
  max-width: 65ch;
}
.reading-column p {
  margin: 0 0 var(--space-4);
  line-height: var(--leading-relaxed);
}
.code {
  background: var(--code-bg);
  border: 1px solid var(--code-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
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

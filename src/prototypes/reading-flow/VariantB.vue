<!-- PROTOTYPE — Variant B: "Command Dashboard". Dense, dark-first, a fixed
     sidebar of Programs, table-like rows with metadata, terminal-chrome
     code block. -->
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
const archivedCount = programs.filter((p) => p.status === 'archived').length
</script>

<template>
  <div class="dash">
    <div v-if="screen === 'connect'" class="centered">
      <form class="panel" @submit.prevent="emit('navigate', 'picker')">
        <div class="prompt">$ better-canvas connect</div>
        <h1>Connect to Canvas</h1>
        <label>base_url<input type="text" placeholder="https://school.instructure.com" /></label>
        <label>access_token<input type="password" placeholder="•••••••••••••••" /></label>
        <button type="submit">connect --token</button>
      </form>
    </div>

    <div v-else-if="screen === 'picker'" class="centered">
      <div class="panel">
        <div class="prompt">$ courses --list</div>
        <h1>Select Programs</h1>
        <div class="course-table">
          <label v-for="c in availableCourses" :key="c.id" class="course-row">
            <input type="checkbox" :checked="selectedCourses.has(c.id)" @change="toggleCourse(c.id)" />
            <span class="course-name">{{ c.name }}</span>
            <span class="course-term">{{ c.term }}</span>
          </label>
        </div>
        <button type="button" @click="emit('navigate', 'home')">apply_selection →</button>
      </div>
    </div>

    <div v-else class="app">
      <aside class="sidebar">
        <div class="brand">BETTER_CANVAS</div>
        <div class="sidebar-section">Programs</div>
        <button
          v-for="p in activePrograms"
          :key="p.id"
          type="button"
          class="sidebar-link"
          @click="emit('navigate', 'modules')"
        >
          <span class="dot" />{{ p.name }}
        </button>
        <div class="sidebar-spacer" />
        <button type="button" class="sidebar-link muted">Previous Lectures ({{ archivedCount }})</button>
      </aside>

      <main>
        <template v-if="screen === 'home'">
          <div class="breadcrumb">~/programs</div>
          <h1>Programs</h1>
          <table class="rows">
            <tbody>
              <tr v-for="p in activePrograms" :key="p.id" @click="emit('navigate', 'modules')">
                <td class="c-name">{{ p.name }}</td>
                <td class="c-meta">{{ p.term }}</td>
                <td class="c-meta">{{ p.moduleCount }} modules</td>
                <td class="c-due">{{ p.nextDue ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-else-if="screen === 'modules'">
          <div class="breadcrumb">~/programs/vue-and-the-modern-web</div>
          <div class="tabbar">
            <span class="pill active">modules</span>
            <span class="pill" @click="emit('navigate', 'assignments')">assignments</span>
          </div>
          <h1>Modules</h1>
          <table class="rows">
            <tbody>
              <tr v-for="m in modules" :key="m.id" @click="emit('navigate', 'reading')">
                <td class="c-status">{{ m.done ? '[x]' : '[ ]' }}</td>
                <td class="c-name">{{ m.title }}</td>
                <td class="c-meta">{{ m.summary }}</td>
                <td class="c-meta">{{ m.pageCount }}p</td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-else-if="screen === 'assignments'">
          <div class="breadcrumb">~/programs/vue-and-the-modern-web</div>
          <div class="tabbar">
            <span class="pill" @click="emit('navigate', 'modules')">modules</span>
            <span class="pill active">assignments</span>
          </div>
          <h1>Assignments</h1>
          <table class="rows">
            <tbody>
              <tr v-for="a in assignments" :key="a.id">
                <td class="c-status"><span class="badge" :class="a.status">{{ a.status }}</span></td>
                <td class="c-name">{{ a.title }}</td>
                <td class="c-meta">{{ a.programName }}</td>
                <td class="c-due">{{ a.dueLabel }}</td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-else-if="screen === 'reading'">
          <div class="breadcrumb clickable" @click="emit('navigate', 'modules')">
            ~/modules/{{ modulePage.moduleTitle }}
          </div>
          <article class="reading-column">
            <h1>{{ modulePage.title }}</h1>
            <p v-for="(para, i) in modulePage.paragraphs" :key="i">{{ para }}</p>
            <div class="terminal">
              <div class="terminal-bar"><span /><span /><span /></div>
              <pre class="code"><code v-html="modulePage.codeHtml"></code></pre>
            </div>
          </article>
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.dash {
  min-height: 100vh;
}
h1 {
  font-family: var(--font-heading);
  color: var(--color-heading);
  font-size: var(--text-xl);
  font-weight: 700;
  margin: 0 0 var(--space-4);
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
  border-radius: var(--radius-md);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.prompt {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-accent);
}
.panel label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.panel input {
  font: var(--text-sm) / 1.4 var(--font-mono);
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-alt);
  color: var(--color-text);
}
.panel button {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-accent);
  color: var(--color-accent-text);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-mono);
  align-self: flex-start;
}
.course-table {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.course-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
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
.sidebar {
  width: 220px;
  flex: none;
  background: var(--color-surface-alt);
  padding: var(--space-4) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.brand {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-accent);
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
  padding: 0 var(--space-2) var(--space-4);
}
.sidebar-section {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0 var(--space-2) var(--space-1);
}
.sidebar-link {
  all: unset;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
}
.sidebar-link:hover {
  background: var(--color-surface);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--color-accent);
}
.sidebar-spacer {
  flex: 1;
}
.sidebar-link.muted {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

main {
  flex: 1;
  padding: var(--space-5);
}
.breadcrumb {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
}
.breadcrumb.clickable {
  cursor: pointer;
}
.tabbar {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.pill {
  padding: var(--space-1) var(--space-3);
  border-radius: 999px;
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  cursor: pointer;
}
.pill.active {
  background: var(--color-accent);
  color: var(--color-accent-text);
}

.rows {
  width: 100%;
  border-collapse: collapse;
}
.rows tr {
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
}
.rows tr:hover {
  background: var(--color-surface);
}
.rows td {
  padding: var(--space-2) var(--space-2);
  font-size: var(--text-sm);
  vertical-align: middle;
}
.c-status {
  font-family: var(--font-mono);
  color: var(--color-accent);
  width: 1%;
  white-space: nowrap;
}
.c-name {
  color: var(--color-heading);
  font-weight: 600;
}
.c-meta {
  color: var(--color-text-muted);
}
.c-due {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-align: right;
}
.badge {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.badge.upcoming {
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
}
.badge.overdue {
  background: color-mix(in srgb, var(--color-danger) 20%, transparent);
  color: var(--color-danger);
}
.badge.submitted {
  background: color-mix(in srgb, var(--color-success) 20%, transparent);
  color: var(--color-success);
}

.reading-column {
  max-width: 70ch;
}
.reading-column p {
  margin: 0 0 var(--space-4);
  line-height: var(--leading-relaxed);
}
.terminal {
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--code-border);
}
.terminal-bar {
  display: flex;
  gap: 6px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-alt);
}
.terminal-bar span {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--color-border);
}
.code {
  margin: 0;
  background: var(--code-bg);
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

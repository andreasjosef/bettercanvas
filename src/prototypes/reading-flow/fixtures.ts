// PROTOTYPE fixtures — placeholder data shared by all three reading-flow
// variants. Not real Canvas API shapes; just enough to fill the screens.

export interface FixtureProgram {
  id: string
  name: string
  term: string
  status: 'active' | 'archived'
  moduleCount: number
  nextDue?: string
}

export interface FixtureModule {
  id: string
  title: string
  summary: string
  pageCount: number
  done: boolean
}

export interface FixtureAssignment {
  id: string
  title: string
  programName: string
  dueLabel: string
  dueGroup: 'today' | 'this-week' | 'later'
  status: 'upcoming' | 'overdue' | 'submitted'
}

export const availableCourses: { id: string; name: string; term: string }[] = [
  { id: 'c1', name: 'Vue & the Modern Web', term: 'Fall 2026' },
  { id: 'c2', name: 'Systems Programming', term: 'Fall 2026' },
  { id: 'c3', name: 'Intro to Databases', term: 'Spring 2026' },
  { id: 'c4', name: 'Faculty Announcements (admin)', term: 'Ongoing' },
  { id: 'c5', name: 'Library Orientation (admin)', term: 'Ongoing' },
]

export const programs: FixtureProgram[] = [
  {
    id: 'c1',
    name: 'Vue & the Modern Web',
    term: 'Fall 2026',
    status: 'active',
    moduleCount: 8,
    nextDue: 'Component design essay — due tomorrow',
  },
  {
    id: 'c2',
    name: 'Systems Programming',
    term: 'Fall 2026',
    status: 'active',
    moduleCount: 12,
    nextDue: 'Memory allocator lab — due Friday',
  },
  {
    id: 'c3',
    name: 'Intro to Databases',
    term: 'Spring 2026',
    status: 'archived',
    moduleCount: 10,
  },
]

export const modules: FixtureModule[] = [
  {
    id: 'm1',
    title: '1. Reactivity fundamentals',
    summary: 'refs, reactive(), computed — and why they exist',
    pageCount: 4,
    done: true,
  },
  {
    id: 'm2',
    title: '2. Component composition',
    summary: 'props, slots, composables',
    pageCount: 5,
    done: true,
  },
  {
    id: 'm3',
    title: '3. State management patterns',
    summary: 'lifting state, provide/inject, stores',
    pageCount: 6,
    done: false,
  },
  {
    id: 'm4',
    title: '4. Routing & code-splitting',
    summary: 'vue-router, lazy routes, guards',
    pageCount: 3,
    done: false,
  },
]

export const assignments: FixtureAssignment[] = [
  {
    id: 'a1',
    title: 'Component design essay',
    programName: 'Vue & the Modern Web',
    dueLabel: 'Tomorrow, 11:59pm',
    dueGroup: 'today',
    status: 'upcoming',
  },
  {
    id: 'a2',
    title: 'Memory allocator lab',
    programName: 'Systems Programming',
    dueLabel: 'Friday, 5:00pm',
    dueGroup: 'this-week',
    status: 'upcoming',
  },
  {
    id: 'a3',
    title: 'Reading response #2',
    programName: 'Vue & the Modern Web',
    dueLabel: 'Last Monday',
    dueGroup: 'later',
    status: 'overdue',
  },
  {
    id: 'a4',
    title: 'Pointer arithmetic quiz',
    programName: 'Systems Programming',
    dueLabel: 'Next week',
    dueGroup: 'later',
    status: 'submitted',
  },
]

export const modulePage = {
  moduleTitle: '3. State management patterns',
  title: 'Composables vs. a central store',
  paragraphs: [
    'A composable is just a function that owns some reactive state and hands back a slice of it. For a lot of app state, that is enough — you never need a store at all.',
    'The tell that you have outgrown a composable is sharing: two unrelated components both need to read and write the same state, and neither one should own the source of truth.',
  ],
  codeLanguage: 'ts',
  // Placeholder syntax-highlighting markup — real tokenization depends on
  // the code-block research ticket. Spans map to the --code-* token slots.
  codeHtml:
    '<span class="tok-keyword">export function</span> <span class="tok-function">useProgramFilter</span>(<span class="tok-punct">programs:</span> <span class="tok-keyword">Ref</span>&lt;Program[]&gt;) {\n' +
    '  <span class="tok-comment">// derived state, not a copy</span>\n' +
    '  <span class="tok-keyword">const</span> active = <span class="tok-function">computed</span>(() =&gt;\n' +
    '    programs.value.<span class="tok-function">filter</span>((p) =&gt; p.status === <span class="tok-string">\'active\'</span>)\n' +
    '  )\n\n' +
    '  <span class="tok-keyword">return</span> { active }\n' +
    '}',
}

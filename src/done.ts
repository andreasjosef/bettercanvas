import { ref } from 'vue'
import type { CourseModule, ModuleItem } from './api/canvas.ts'
import type { Program } from './programs.ts'

export const DONE_STORAGE_KEY = 'canvas.done'

/**
 * Bumped on every Done mutation so view computeds that read the (otherwise
 * non-reactive) localStorage-backed Done state re-run.
 */
export const doneVersion = ref(0)

export interface DoneEntry {
  /** Module-item ids of Done Lessons (Page-type items). */
  lessons: number[]
  /** Canvas Assignment ids (content_id) of Done Assignments. */
  assignments: number[]
  /**
   * Module ids explicitly marked Done by the user. Only consulted as a
   * fallback for Modules with no Done-able Lesson/Assignment leaf to derive
   * from — a Module that has any such leaf is always derived, never stored.
   */
  modules: number[]
}

/**
 * Done flags keyed by courseId. Modules are stored only as a fallback for
 * ones with no Done-able leaf — every other Module stays purely derived.
 */
export type DoneState = Record<number, DoneEntry>

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
}

function loadDoneState(): DoneState {
  const raw = localStorage.getItem(DONE_STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }
    const state: DoneState = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (!/^\d+$/.test(key)) continue
      if (typeof value !== 'object' || value === null) continue
      const entry = value as Partial<DoneEntry>
      if (
        !isNumberArray(entry.lessons) &&
        !isNumberArray(entry.assignments) &&
        !isNumberArray(entry.modules)
      ) {
        continue
      }
      state[Number(key)] = {
        lessons: isNumberArray(entry.lessons) ? entry.lessons : [],
        assignments: isNumberArray(entry.assignments) ? entry.assignments : [],
        modules: isNumberArray(entry.modules) ? entry.modules : [],
      }
    }
    return state
  } catch {
    return {}
  }
}

function saveDoneState(state: DoneState): void {
  if (Object.keys(state).length === 0) {
    localStorage.removeItem(DONE_STORAGE_KEY)
    return
  }
  localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify(state))
}

function entryFor(state: DoneState, courseId: number): DoneEntry {
  return state[courseId] ?? { lessons: [], assignments: [], modules: [] }
}

function updateEntry(courseId: number, update: (entry: DoneEntry) => void): void {
  const state = loadDoneState()
  const entry = entryFor(state, courseId)
  update(entry)
  state[courseId] = entry
  saveDoneState(state)
  doneVersion.value++
}

export function isLessonDone(courseId: number, moduleItemId: number): boolean {
  return loadDoneState()[courseId]?.lessons.includes(moduleItemId) ?? false
}

export function setLessonDone(courseId: number, moduleItemId: number, done: boolean): void {
  updateEntry(courseId, (entry) => {
    entry.lessons = entry.lessons.filter((id) => id !== moduleItemId)
    if (done) entry.lessons.push(moduleItemId)
  })
}

export function isAssignmentDone(courseId: number, assignmentId: number): boolean {
  return loadDoneState()[courseId]?.assignments.includes(assignmentId) ?? false
}

export function setAssignmentDone(courseId: number, assignmentId: number, done: boolean): void {
  updateEntry(courseId, (entry) => {
    entry.assignments = entry.assignments.filter((id) => id !== assignmentId)
    if (done) entry.assignments.push(assignmentId)
  })
}

/**
 * Explicit per-Module Done override, consulted only when the Module has no
 * Done-able Lesson/Assignment leaf to derive its Done state from.
 */
function isModuleDoneOverride(courseId: number, moduleId: number): boolean {
  return loadDoneState()[courseId]?.modules.includes(moduleId) ?? false
}

function setModuleDoneOverride(courseId: number, moduleId: number, done: boolean): void {
  updateEntry(courseId, (entry) => {
    entry.modules = entry.modules.filter((id) => id !== moduleId)
    if (done) entry.modules.push(moduleId)
  })
}

/** A leaf item can carry a Done flag: Lessons (Page items) and Assignments (by content_id). */
export function isDoneAbleItem(item: ModuleItem): boolean {
  if (item.type === 'Page') return true
  return item.type === 'Assignment' && typeof item.content_id === 'number'
}

function isLeafDone(courseId: number, item: ModuleItem): boolean {
  if (item.type === 'Page') return isLessonDone(courseId, item.id)
  return isAssignmentDone(courseId, item.content_id as number)
}

/**
 * Derived from its Done-able leaves when it has any: Done iff all of them
 * are Done. A Module with no Done-able leaf (only chrome, links, or other
 * untracked item types) instead falls back to its explicit stored override.
 */
export function isModuleDone(courseId: number, module: CourseModule): boolean {
  const doneAble = (module.items ?? []).filter(isDoneAbleItem)
  if (doneAble.length > 0) {
    return doneAble.every((item) => isLeafDone(courseId, item))
  }
  return isModuleDoneOverride(courseId, module.id)
}

function setItemDone(courseId: number, item: ModuleItem, done: boolean): void {
  if (item.type === 'Page') {
    setLessonDone(courseId, item.id, done)
  } else if (item.type === 'Assignment' && typeof item.content_id === 'number') {
    setAssignmentDone(courseId, item.content_id, done)
  }
}

/** Marks one Done-able leaf (a Lesson or an Assignment) Done; ignores other item types. */
export function markItemDone(courseId: number, item: ModuleItem): void {
  setItemDone(courseId, item, true)
}

/**
 * Marks every one of the Module's Done-able leaves Done at once; the
 * Module's own Done state stays derived from them and is never stored. A
 * Module with no Done-able leaf instead sets the explicit stored override,
 * since there is nothing for it to derive from.
 */
export function markModuleDone(courseId: number, module: CourseModule): void {
  const doneAble = (module.items ?? []).filter(isDoneAbleItem)
  if (doneAble.length > 0) {
    for (const item of doneAble) markItemDone(courseId, item)
    return
  }
  setModuleDoneOverride(courseId, module.id, true)
}

/** Un-marks one Done-able leaf (a Lesson or an Assignment) back to not-Done. */
export function unmarkItemDone(courseId: number, item: ModuleItem): void {
  setItemDone(courseId, item, false)
}

/**
 * Un-marks every one of the Module's Done-able leaves at once, pulling the
 * derived Module back out of Done (un-marking a single child is already
 * sufficient for that, on its own — this leaves every other already-Done
 * child untouched). A Module with no Done-able leaf instead clears its
 * explicit stored override.
 */
export function unmarkModuleDone(courseId: number, module: CourseModule): void {
  const doneAble = (module.items ?? []).filter(isDoneAbleItem)
  if (doneAble.length > 0) {
    for (const item of doneAble) unmarkItemDone(courseId, item)
    return
  }
  setModuleDoneOverride(courseId, module.id, false)
}

/** Purges canvas.done entries for Programs not in the given selection. */
export function purgeDoneEntries(programs: Program[]): void {
  const state = loadDoneState()
  const kept = programs.map((program) => program.courseId)
  const pruned = Object.fromEntries(
    Object.entries(state).filter(([key]) => kept.includes(Number(key))),
  ) as DoneState
  saveDoneState(pruned)
}

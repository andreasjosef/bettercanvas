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
}

/** Done flags keyed by courseId. Modules are never stored — always derived. */
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
      if (!isNumberArray(entry.lessons) && !isNumberArray(entry.assignments)) continue
      state[Number(key)] = {
        lessons: isNumberArray(entry.lessons) ? entry.lessons : [],
        assignments: isNumberArray(entry.assignments) ? entry.assignments : [],
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
  return state[courseId] ?? { lessons: [], assignments: [] }
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

/** A leaf item can carry a Done flag: Lessons (Page items) and Assignments (by content_id). */
export function isDoneAbleItem(item: ModuleItem): boolean {
  if (item.type === 'Page') return true
  return item.type === 'Assignment' && typeof item.content_id === 'number'
}

function isLeafDone(courseId: number, item: ModuleItem): boolean {
  if (item.type === 'Page') return isLessonDone(courseId, item.id)
  return isAssignmentDone(courseId, item.content_id as number)
}

/** Derived, never stored: Done iff at least one Done-able leaf and all of them are Done. */
export function isModuleDone(courseId: number, module: CourseModule): boolean {
  const doneAble = (module.items ?? []).filter(isDoneAbleItem)
  return doneAble.length > 0 && doneAble.every((item) => isLeafDone(courseId, item))
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
 * Sugar for marking every one of the Module's Done-able leaves Done at once;
 * the Module's own Done state stays derived and is never stored. A Module with
 * no Done-able leaves is left untouched (it can never be Done).
 */
export function markModuleDone(courseId: number, module: CourseModule): void {
  for (const item of module.items ?? []) {
    if (isDoneAbleItem(item)) markItemDone(courseId, item)
  }
}

/** Un-marks one Done-able leaf (a Lesson or an Assignment) back to not-Done. */
export function unmarkItemDone(courseId: number, item: ModuleItem): void {
  setItemDone(courseId, item, false)
}

/**
 * Sugar for un-marking every one of the Module's Done-able leaves at once,
 * pulling the derived Module back out of Done. Because Module Done is always
 * derived, un-marking a single child is already sufficient to pull the Module
 * out on its own — while leaving every other already-Done child untouched.
 */
export function unmarkModuleDone(courseId: number, module: CourseModule): void {
  for (const item of module.items ?? []) {
    if (isDoneAbleItem(item)) unmarkItemDone(courseId, item)
  }
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

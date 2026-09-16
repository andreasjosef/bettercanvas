import { beforeEach, describe, expect, it } from 'vitest'
import type { CourseModule, ModuleItem } from './api/canvas.ts'
import {
  DONE_STORAGE_KEY,
  isAssignmentDone,
  isLessonDone,
  isModuleDone,
  markModuleDone,
  purgeDoneEntries,
  setAssignmentDone,
  setLessonDone,
} from './done.ts'
import type { Program } from './programs.ts'

function pageItem(id: number): ModuleItem {
  return { id, type: 'Page', title: `Page ${id}` }
}

function assignmentItem(id: number, contentId: number): ModuleItem {
  return { id, type: 'Assignment', title: `Assignment ${id}`, content_id: contentId }
}

function moduleWith(name: string, items: ModuleItem[]): CourseModule {
  return { id: 9001, name, position: 1, items }
}

function readStoredDone(): unknown {
  const raw = localStorage.getItem(DONE_STORAGE_KEY)
  return raw === null ? null : (JSON.parse(raw) as unknown)
}

describe('Done storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips leaf Done flags through a single well-known key', () => {
    setLessonDone(585, 101, true)
    setAssignmentDone(585, 77, true)
    setLessonDone(612, 202, true)

    const stored = readStoredDone()
    expect(stored).toEqual({
      '585': { lessons: [101], assignments: [77] },
      '612': { lessons: [202], assignments: [] },
    })
    expect(isLessonDone(585, 101)).toBe(true)
    expect(isAssignmentDone(585, 77)).toBe(true)
    expect(isLessonDone(612, 202)).toBe(true)
  })

  it('Lesson flags are keyed by module-item id, Assignment flags by Canvas content_id', () => {
    setLessonDone(585, 101, true)
    setAssignmentDone(585, 77, true)

    expect(isLessonDone(585, 101)).toBe(true)
    expect(isLessonDone(585, 102)).toBe(false)
    expect(isAssignmentDone(585, 77)).toBe(true)
    expect(isAssignmentDone(585, 78)).toBe(false)
  })

  it('an Assignment marked Done in one Module reads Done in every Module referencing it', () => {
    setAssignmentDone(585, 77, true)

    const moduleA = moduleWith('Module A', [assignmentItem(1, 77)])
    const moduleB = moduleWith('Module B', [assignmentItem(2, 77)])
    expect(isModuleDone(585, moduleA)).toBe(true)
    expect(isModuleDone(585, moduleB)).toBe(true)
  })

  it('un-marking clears the flag rather than keeping a false entry', () => {
    setLessonDone(585, 101, true)
    setLessonDone(585, 101, false)
    setAssignmentDone(585, 77, true)
    setAssignmentDone(585, 77, false)

    const stored = readStoredDone()
    expect(stored).toEqual({ '585': { lessons: [], assignments: [] } })
    expect(isLessonDone(585, 101)).toBe(false)
    expect(isAssignmentDone(585, 77)).toBe(false)
  })

  it('returns not-Done for everything when nothing is stored', () => {
    expect(isLessonDone(585, 101)).toBe(false)
    expect(isAssignmentDone(585, 77)).toBe(false)
  })

  it('tolerates corrupt or malformed stored JSON by ignoring it', () => {
    localStorage.setItem(DONE_STORAGE_KEY, 'not json')
    expect(isLessonDone(585, 101)).toBe(false)

    localStorage.setItem(DONE_STORAGE_KEY, '[1, 2, 3]')
    expect(isLessonDone(585, 101)).toBe(false)

    localStorage.setItem(
      DONE_STORAGE_KEY,
      JSON.stringify({
        '585': { lessons: 'garbage', assignments: null },
        '612': { lessons: [202], assignments: [77] },
        '613': { lessons: [303], assignments: 'junk' },
        bogus: { lessons: [404], assignments: [] },
      }),
    )
    expect(isLessonDone(585, 101)).toBe(false)
    expect(isLessonDone(612, 202)).toBe(true)
    expect(isAssignmentDone(612, 77)).toBe(true)
    expect(isLessonDone(613, 303)).toBe(true)
    expect(isAssignmentDone(613, 77)).toBe(false)
    expect(isLessonDone(0, 404)).toBe(false)
  })
})

describe('derived Module Done', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is Done iff every Done-able leaf item is Done', () => {
    const mod = moduleWith('Module', [
      pageItem(101),
      assignmentItem(1, 77),
      { id: 400, type: 'SubHeader', title: 'Header' },
      { id: 401, type: 'ExternalUrl', title: 'Link' },
    ])
    expect(isModuleDone(585, mod)).toBe(false)

    setLessonDone(585, 101, true)
    expect(isModuleDone(585, mod)).toBe(false)
    setAssignmentDone(585, 77, true)
    expect(isModuleDone(585, mod)).toBe(true)
  })

  it('is never Done when it has no Done-able leaves', () => {
    expect(isModuleDone(585, moduleWith('Empty', []))).toBe(false)
    expect(isModuleDone(585, { id: 9002, name: 'No items', position: 2 })).toBe(false)
    expect(
      isModuleDone(585, moduleWith('Only chrome', [{ id: 400, type: 'SubHeader', title: 'Header' }])),
    ).toBe(false)
  })

  it('un-marking one leaf pulls the Module back out of Done with no extra sync', () => {
    const mod = moduleWith('Module', [pageItem(101), pageItem(102)])
    setLessonDone(585, 101, true)
    setLessonDone(585, 102, true)
    expect(isModuleDone(585, mod)).toBe(true)

    setLessonDone(585, 102, false)
    expect(isModuleDone(585, mod)).toBe(false)
  })

  it('Done-able leaves are scoped per Program', () => {
    setLessonDone(585, 101, true)
    expect(isModuleDone(585, moduleWith('Module', [pageItem(101)]))).toBe(true)
    expect(isModuleDone(612, moduleWith('Module', [pageItem(101)]))).toBe(false)
  })
})

describe('marking a whole Module Done', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('marks every Done-able leaf Done, so the derived Module Done flips with no stored Module flag', () => {
    const mod = moduleWith('Module', [
      pageItem(101),
      pageItem(102),
      assignmentItem(1, 77),
    ])
    markModuleDone(585, mod)

    expect(isLessonDone(585, 101)).toBe(true)
    expect(isLessonDone(585, 102)).toBe(true)
    expect(isAssignmentDone(585, 77)).toBe(true)
    expect(isModuleDone(585, mod)).toBe(true)
  })

  it('leaves non-Done-able items (SubHeaders, links) alone — there is nothing to mark', () => {
    const mod = moduleWith('Module', [
      { id: 400, type: 'SubHeader', title: 'Header' },
      { id: 401, type: 'ExternalUrl', title: 'Link' },
      pageItem(101),
    ])
    markModuleDone(585, mod)

    expect(isLessonDone(585, 101)).toBe(true)
    expect(readStoredDone()).toEqual({ '585': { lessons: [101], assignments: [] } })
  })

  it('never marks a Module with no Done-able leaves Done (it stays visible in normal navigation)', () => {
    markModuleDone(585, moduleWith('Empty', []))
    markModuleDone(585, { id: 9002, name: 'No items', position: 2 })
    markModuleDone(585, moduleWith('Only chrome', [{ id: 400, type: 'SubHeader', title: 'Header' }]))

    expect(readStoredDone()).toBeNull()
  })

  it('marking one Module Done does not touch sibling Modules', () => {
    const modA = moduleWith('Module A', [pageItem(101)])
    const modB = moduleWith('Module B', [pageItem(102)])
    markModuleDone(585, modA)

    expect(isModuleDone(585, modA)).toBe(true)
    expect(isModuleDone(585, modB)).toBe(false)
  })
})

describe('purging Done state on Program removal', () => {
  beforeEach(() => {
    localStorage.clear()
    setLessonDone(585, 101, true)
    setAssignmentDone(585, 77, true)
    setLessonDone(612, 202, true)
  })

  it('fully deselecting a Program purges its canvas.done entry', () => {
    purgeDoneEntries([])
    expect(readStoredDone()).toBeNull()

    setLessonDone(585, 101, true)
    setLessonDone(612, 202, true)
    purgeDoneEntries([
      { courseId: 612, name: 'Administration Materials Bank', archived: false },
    ])
    const stored = readStoredDone()
    expect(stored).toEqual({ '612': { lessons: [202], assignments: [] } })
  })

  it('archiving or unarchiving a Program leaves its canvas.done entry untouched', () => {
    const programs: Program[] = [
      { courseId: 585, name: 'Programmeringäsning', archived: true },
      { courseId: 612, name: 'Administration Materials Bank', archived: false },
    ]
    purgeDoneEntries(programs)

    expect(isLessonDone(585, 101)).toBe(true)
    expect(isAssignmentDone(585, 77)).toBe(true)
    expect(isLessonDone(612, 202)).toBe(true)

    programs[0]!.archived = false
    purgeDoneEntries(programs)
    expect(isLessonDone(585, 101)).toBe(true)
  })
})

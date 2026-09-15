export const PROGRAMS_STORAGE_KEY = 'canvas.programs'

export interface Program {
  courseId: number
  name: string
  archived: boolean
}

export function findProgram(programId: string): Program | undefined {
  return loadPrograms().find(
    (program) => program.courseId === Number(programId),
  )
}

export function savePrograms(programs: Program[]): void {
  localStorage.setItem(PROGRAMS_STORAGE_KEY, JSON.stringify(programs))
}

export function loadPrograms(): Program[] {
  const raw = localStorage.getItem(PROGRAMS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is Program =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as Program).courseId === 'number' &&
        typeof (entry as Program).name === 'string' &&
        typeof (entry as Program).archived === 'boolean',
    )
  } catch {
    return []
  }
}

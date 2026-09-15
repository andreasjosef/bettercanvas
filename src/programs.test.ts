import { beforeEach, describe, expect, it } from 'vitest'
import { loadPrograms, savePrograms, PROGRAMS_STORAGE_KEY } from './programs.ts'

describe('programs storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists Programs as JSON under a single well-known key', () => {
    const programs = [{ courseId: 585, name: 'Programmeringäsning', archived: false }]
    savePrograms(programs)
    expect(localStorage.getItem(PROGRAMS_STORAGE_KEY)).toBe(JSON.stringify(programs))
    expect(loadPrograms()).toEqual(programs)
  })

  it('loadPrograms returns an empty list when nothing is stored', () => {
    expect(loadPrograms()).toEqual([])
  })

  it('loadPrograms tolerates corrupt or non-Program payloads', () => {
    localStorage.setItem(PROGRAMS_STORAGE_KEY, 'not json')
    expect(loadPrograms()).toEqual([])
    localStorage.setItem(PROGRAMS_STORAGE_KEY, '{"courseId": 585}')
    expect(loadPrograms()).toEqual([])
    localStorage.setItem(
      PROGRAMS_STORAGE_KEY,
      JSON.stringify([{ courseId: 585, name: 'ok', archived: false }, 'garbage']),
    )
    expect(loadPrograms()).toEqual([{ courseId: 585, name: 'ok', archived: false }])
  })
})

export type Screen =
  | 'connect'
  | 'picker'
  | 'home'
  | 'modules'
  | 'assignments'
  | 'reading'

export const screens: { key: Screen; label: string }[] = [
  { key: 'connect', label: '1. Connect' },
  { key: 'picker', label: '2. Picker' },
  { key: 'home', label: '3. Home' },
  { key: 'modules', label: '4. Modules' },
  { key: 'assignments', label: '5. Assignments' },
  { key: 'reading', label: '6. Reading' },
]

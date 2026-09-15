import { afterEach, describe, expect, it } from 'vitest'
import {
  applyHighlightTheme,
  DEFAULT_HIGHLIGHT_THEME,
  HLJS_THEME_LINK_ID,
} from './highlightTheme'

afterEach(() => {
  document.getElementById(HLJS_THEME_LINK_ID)?.remove()
})

describe('applyHighlightTheme', () => {
  it('creates a stylesheet link pointing at the shipped default theme', () => {
    applyHighlightTheme(DEFAULT_HIGHLIGHT_THEME)

    const link = document.getElementById(HLJS_THEME_LINK_ID)
    expect(link).not.toBeNull()
    expect(link?.getAttribute('rel')).toBe('stylesheet')
    expect(link?.getAttribute('href')).toBe(
      `/hljs-themes/${DEFAULT_HIGHLIGHT_THEME}.css`,
    )
  })

  it('swaps the href on the existing link instead of stacking links', () => {
    applyHighlightTheme(DEFAULT_HIGHLIGHT_THEME)
    applyHighlightTheme('github-dark')

    const link = document.getElementById(HLJS_THEME_LINK_ID)
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/hljs-themes/github-dark.css')
    expect(document.querySelectorAll(`#${HLJS_THEME_LINK_ID}`).length).toBe(1)
  })
})

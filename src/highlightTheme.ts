/*
 * Runtime-swappable highlight.js theme. A theme is just a CSS file in
 * `public/hljs-themes/` served verbatim (no build step), so switching
 * themes at runtime is swapping the href of one `<link>` — no rebuild,
 * no re-highlighting. v1 ships one theme (warm-dark, token-driven);
 * future themes drop into the same directory.
 */
export const DEFAULT_HIGHLIGHT_THEME = 'warm-dark'
export const HLJS_THEME_LINK_ID = 'hljs-theme-stylesheet'
const HLJS_THEMES_DIR = '/hljs-themes'

export function applyHighlightTheme(name: string): void {
  let link = document.getElementById(
    HLJS_THEME_LINK_ID,
  ) as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = HLJS_THEME_LINK_ID
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
  link.setAttribute('href', `${HLJS_THEMES_DIR}/${name}.css`)
}

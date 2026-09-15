/*
 * Syntax highlighting for the reading view, per research 0004's
 * recommendation: highlight.js's automatic language detection, run in
 * place against whatever unlabeled `<pre><code>` blocks a sanitized
 * Canvas Page/Assignment body already contains — no rewriting of the
 * code content itself (Canvas supplies no language hint anywhere).
 *
 * Auto-detection is a best-effort heuristic with documented failure
 * modes, so every highlighted block gets a manual per-block language
 * override control in the UI: a visibly wrong detection is never stuck
 * wrong. Bare inline `<code>` (no `<pre>` parent — the only code markup
 * actually observed in this school's Canvas data) is deliberately left
 * alone: detection on short inline fragments is noise, and the existing
 * inline-code styling already covers it. If Canvas ever does ship a
 * `language-xxx` class on a block, that hint is respected instead of
 * re-detected.
 */
import hljs from 'highlight.js/lib/common'

/** Languages offered in the per-block override select (curated subset of hljs/lib/common). */
export const OVERRIDE_LANGUAGES: readonly string[] = [
  'plaintext',
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'go',
  'java',
  'javascript',
  'json',
  'kotlin',
  'markdown',
  'php',
  'python',
  'ruby',
  'rust',
  'sql',
  'swift',
  'typescript',
  'xml',
  'yaml',
] as const

const RAW_CODE = new WeakMap<HTMLElement, string>()

function hintedLanguageOf(code: HTMLElement): string | null {
  for (const className of code.className.split(/\s+/)) {
    if (!className.startsWith('language-')) continue
    const hinted = className.slice('language-'.length)
    if (hljs.getLanguage(hinted)) return hinted
  }
  return null
}

function renderCode(
  code: HTMLElement,
  text: string,
  language: string | null,
): string | null {
  const result = language
    ? hljs.highlight(text, { language, ignoreIllegals: true })
    : hljs.highlightAuto(text)
  code.className = result.language
    ? `hljs language-${result.language}`
    : 'hljs'
  code.innerHTML = result.value
  return result.language ?? null
}

function attachOverrideControl(
  wrapper: HTMLElement,
  pre: HTMLElement,
): void {
  const select = document.createElement('select')
  select.className = 'code-lang-select'
  select.setAttribute('aria-label', 'Code language')

  const auto = document.createElement('option')
  auto.value = 'auto'
  const detected = pre.dataset.detectedLanguage
  auto.textContent = detected ? `auto (${detected})` : 'auto'
  select.appendChild(auto)
  for (const language of OVERRIDE_LANGUAGES) {
    const option = document.createElement('option')
    option.value = language
    option.textContent = language
    select.appendChild(option)
  }
  select.addEventListener('change', () => {
    setCodeBlockLanguage(pre, select.value)
  })
  wrapper.appendChild(select)
}

function enhanceCodeBlock(pre: HTMLElement, code: HTMLElement): void {
  const text = code.textContent ?? ''
  RAW_CODE.set(code, text)
  const hinted = hintedLanguageOf(code)
  const detected = renderCode(code, text, hinted)
  if (detected) pre.dataset.detectedLanguage = detected
  /*
   * Wrap the pre in a positioning context so the override select sits
   * pinned at the block's top-right corner while the pre itself keeps
   * scrolling its code horizontally.
   */
  const wrapper = document.createElement('div')
  wrapper.className = 'code-block'
  pre.parentNode?.insertBefore(wrapper, pre)
  wrapper.appendChild(pre)
  attachOverrideControl(wrapper, pre)
}

/**
 * Highlight every not-yet-highlighted `<pre><code>` block inside
 * `root` (the rendered reading-view content element) using hljs's
 * automatic language detection, and attach a per-block override select.
 * Scoped to `root` — never a global `highlightAll()` across the page.
 * Safe to call again (already-highlighted blocks are skipped).
 */
export function highlightCodeBlocks(root: ParentNode): void {
  const codeBlocks = root.querySelectorAll<HTMLElement>('pre code')
  for (const code of codeBlocks) {
    const pre = code.closest('pre')
    if (!pre || RAW_CODE.has(code)) continue
    enhanceCodeBlock(pre, code)
  }
}

/**
 * Re-render one code block with an explicit language (`'auto'` falls
 * back to detection on the original source text). Used by the per-block
 * override control.
 */
export function setCodeBlockLanguage(pre: HTMLElement, language: string): void {
  const code = pre.querySelector<HTMLElement>('code')
  if (!code) return
  const text = RAW_CODE.get(code) ?? code.textContent ?? ''
  const detected = renderCode(
    code,
    text,
    language === 'auto' ? null : language,
  )
  if (language === 'auto' && detected) {
    pre.dataset.detectedLanguage = detected
  }
}

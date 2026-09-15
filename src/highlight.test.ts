import { beforeEach, describe, expect, it } from 'vitest'
import {
  highlightCodeBlocks,
  setCodeBlockLanguage,
  OVERRIDE_LANGUAGES,
} from './highlight'

const JS_SNIPPET = 'const greet = (name) => { return "hi " + name; }'
const PYTHON_SNIPPET = 'def greet(name):\n    return f"hi {name}"'

function mountBlock(snippet: string): {
  root: HTMLElement
  pre: HTMLElement
  code: HTMLElement
} {
  const root = document.createElement('div')
  const pre = document.createElement('pre')
  const code = document.createElement('code')
  code.textContent = snippet
  pre.appendChild(code)
  root.appendChild(pre)
  document.body.appendChild(root)
  return { root, pre, code }
}

beforeEach(() => {
  document.body.textContent = ''
})

describe('highlightCodeBlocks', () => {
  it('auto-detects and highlights an unlabeled code block in place', () => {
    const { root, code } = mountBlock(JS_SNIPPET)

    highlightCodeBlocks(root)

    expect(code.className).toContain('hljs')
    expect(code.className).toContain('language-javascript')
    expect(code.querySelector('.hljs-keyword')?.textContent).toBe('const')
    expect(code.textContent).toBe(JS_SNIPPET)
  })

  it('records the detected language on the wrapping pre', () => {
    const { root, pre } = mountBlock(JS_SNIPPET)

    highlightCodeBlocks(root)

    expect(pre.dataset.detectedLanguage).toBe('javascript')
  })

  it('respects a pre-existing language hint instead of re-detecting', () => {
    const { root, code } = mountBlock(PYTHON_SNIPPET)
    code.className = 'language-python'

    highlightCodeBlocks(root)

    expect(code.className).toContain('language-python')
    expect(code.querySelector('.hljs-keyword')?.textContent).toBe('def')
  })

  it('leaves bare inline code (not inside pre) untouched', () => {
    const root = document.createElement('div')
    const code = document.createElement('code')
    code.textContent = JS_SNIPPET
    root.appendChild(code)
    document.body.appendChild(root)

    highlightCodeBlocks(root)

    expect(code.className).toBe('')
    expect(code.querySelector('span')).toBeNull()
  })

  it('does not touch code blocks outside the given root', () => {
    const { root, code } = mountBlock(JS_SNIPPET)
    const outside = document.createElement('div')
    const outsideCode = document.createElement('code')
    outsideCode.textContent = JS_SNIPPET
    const outsidePre = document.createElement('pre')
    outsidePre.appendChild(outsideCode)
    outside.appendChild(outsidePre)
    document.body.appendChild(outside)

    highlightCodeBlocks(root)

    expect(code.className).toContain('hljs')
    expect(outsideCode.className).toBe('')
  })

  it('is idempotent: re-running does not re-highlight or duplicate controls', () => {
    const { root, code } = mountBlock(JS_SNIPPET)
    highlightCodeBlocks(root)
    const spansAfterFirst = code.querySelectorAll('span').length

    highlightCodeBlocks(root)

    expect(code.querySelectorAll('span').length).toBe(spansAfterFirst)
    expect(root.querySelectorAll('select').length).toBe(1)
  })
})

describe('per-block language override', () => {
  it('attaches a language-override select to each highlighted pre', () => {
    const { root } = mountBlock(JS_SNIPPET)

    highlightCodeBlocks(root)

    const select = root.querySelector('select')
    expect(select).not.toBeNull()
    expect(select?.getAttribute('aria-label')).toBe('Code language')
    const values = [...(select?.options ?? [])].map((o) => o.value)
    expect(values[0]).toBe('auto')
    for (const language of OVERRIDE_LANGUAGES) {
      expect(values).toContain(language)
    }
  })

  it('re-highlights the block with the chosen language when the select changes', () => {
    const { root, code } = mountBlock(JS_SNIPPET)
    highlightCodeBlocks(root)
    const select = root.querySelector('select') as HTMLSelectElement

    select.value = 'python'
    select.dispatchEvent(new Event('change'))

    expect(code.className).toContain('language-python')
    expect(code.querySelectorAll('.hljs-keyword').length).toBeGreaterThan(0)
    expect(code.textContent).toBe(JS_SNIPPET)
  })

  it('falls back to auto-detection when the override is set back to auto', () => {
    const { root, code } = mountBlock(JS_SNIPPET)
    highlightCodeBlocks(root)
    const select = root.querySelector('select') as HTMLSelectElement

    select.value = 'python'
    select.dispatchEvent(new Event('change'))
    select.value = 'auto'
    select.dispatchEvent(new Event('change'))

    expect(code.className).toContain('language-javascript')
  })

  it('renders an explicit-language block from source via setCodeBlockLanguage', () => {
    const { pre, code } = mountBlock(PYTHON_SNIPPET)

    setCodeBlockLanguage(pre, 'python')

    expect(code.className).toContain('language-python')
    expect(code.querySelector('.hljs-keyword')?.textContent).toBe('def')
  })

  it('renders plain text with no token spans for the plaintext override', () => {
    const { root, code } = mountBlock(JS_SNIPPET)
    highlightCodeBlocks(root)

    setCodeBlockLanguage(code.closest('pre') as HTMLElement, 'plaintext')

    expect(code.className).toContain('language-plaintext')
    expect(code.querySelector('span')).toBeNull()
    expect(code.textContent).toBe(JS_SNIPPET)
  })
})

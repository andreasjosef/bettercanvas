import { describe, expect, it } from 'vitest'
import { sanitizeCanvasHtml } from './sanitize'

describe('sanitizeCanvasHtml', () => {
  it('strips an embedded <script> element and its content', () => {
    const html = '<p>Intro</p><script>alert("xss")</script><p>Outro</p>'

    const sanitized = sanitizeCanvasHtml(html)

    expect(sanitized).toContain('<p>Intro</p>')
    expect(sanitized).toContain('<p>Outro</p>')
    expect(sanitized).not.toContain('<script')
    expect(sanitized).not.toContain('alert')
  })

  it('strips inline event handler attributes such as onerror', () => {
    const sanitized = sanitizeCanvasHtml(
      '<img src="https://canvas.example/cat.png" onerror="steal()"><p>hi</p>',
    )

    expect(sanitized).not.toContain('onerror')
    expect(sanitized).not.toContain('steal')
    expect(sanitized).toContain('<img src="https://canvas.example/cat.png"')
  })

  it('strips javascript: URLs from links, keeping the link text', () => {
    const sanitized = sanitizeCanvasHtml(
      '<a href="javascript:evil()">Click me</a>',
    )

    expect(sanitized).not.toContain('javascript:')
    expect(sanitized).toContain('Click me')
  })

  it('keeps normal lecture content: headings, paragraphs, lists, code and safe links', () => {
    const html = [
      '<h2>Composables</h2>',
      '<p>A composable owns state.</p>',
      '<ul><li>first</li><li>second</li></ul>',
      '<pre><code>const active = computed(() =&gt; 1)</code></pre>',
      '<a href="https://vuejs.org/guide">Vue guide</a>',
    ].join('')

    const sanitized = sanitizeCanvasHtml(html)

    expect(sanitized).toContain('<h2>Composables</h2>')
    expect(sanitized).toContain('<p>A composable owns state.</p>')
    expect(sanitized).toContain('<li>first</li>')
    expect(sanitized).toContain('<pre><code>')
    expect(sanitized).toContain('<a href="https://vuejs.org/guide">Vue guide</a>')
  })
})

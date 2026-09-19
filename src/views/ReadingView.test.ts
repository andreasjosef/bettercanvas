/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountAppAtPath } from '../test/appHarness'
import { TOKEN_STORAGE_KEY } from '../token'

const MODULES_FIXTURE = [
  {
    id: 101,
    name: 'Module 01',
    position: 1,
    items: [
      {
        id: 2,
        type: 'Page',
        title: 'Intro to Vue',
        page_url: 'intro-to-vue',
        content_id: 400,
      },
    ],
  },
  {
    id: 102,
    name: 'Module 02',
    position: 2,
    items: [
      {
        id: 3,
        type: 'Assignment',
        title: 'Lab 1',
        content_id: 3,
      },
    ],
  },
]

const PAGE_BODY = '<h2>Composables</h2><p>A composable owns state.</p>'
const ASSIGNMENT_BODY = '<p>Build a small store.</p>'
const PAGE_BODY_WITH_CODE =
  '<h2>Composables</h2>' +
  '<p>A composable owns state.</p>' +
  '<pre><code>const greet = (name) => { return "hi " + name; }</code></pre>'
const MALICIOUS_PAGE_BODY =
  '<p>Hi</p><script>alert("xss")</script>' +
  '<img src="https://canvas.example/cat.png" onerror="steal()">'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function stubFetchByPath(
  fetchMock: ReturnType<typeof vi.fn>,
  overrides: Record<string, Response> = {},
): void {
  fetchMock.mockImplementation((url: string) => {
    for (const [suffix, response] of Object.entries(overrides)) {
      if (url.endsWith(suffix)) return Promise.resolve(response)
    }
    if (url.includes('/modules')) {
      return Promise.resolve(jsonResponse(MODULES_FIXTURE))
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`))
  })
}

function stubPageBody(fetchMock: ReturnType<typeof vi.fn>, body: string): void {
  stubFetchByPath(fetchMock, {
    '/pages/intro-to-vue': jsonResponse({
      url: 'intro-to-vue',
      title: 'Intro to Vue',
      body,
    }),
  })
}

describe('ReadingView', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token123')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a Module Page item: title, Module back-link, and its body fetched through the proxy', async () => {
    stubFetchByPath(fetchMock, {
      '/pages/intro-to-vue': jsonResponse({
        url: 'intro-to-vue',
        title: 'Intro to Vue',
        body: PAGE_BODY,
      }),
    })
    const { wrapper } = await mountAppAtPath('/programs/585/read/2')

    const urls = (fetchMock.mock.calls as [string][]).map(([url]) => url)
    expect(urls).toEqual([
      '/api/v1/courses/585/modules?include[]=items&per_page=100',
      '/api/v1/courses/585/pages/intro-to-vue',
    ])
    expect(urls[1]).not.toContain('chasacademy.instructure.com')

    expect(wrapper.find('h1').text()).toBe('Intro to Vue')
    const backLink = wrapper.find('a[href="/programs/585/modules/101"]')
    expect(backLink.exists()).toBe(true)
    expect(backLink.text()).toContain('Module 01')

    const article = wrapper.find('article')
    expect(article.exists()).toBe(true)
    expect(article.text()).toContain('Composables')
    expect(article.text()).toContain('A composable owns state.')
  })

  it('renders an Assignment item: its description fetched through the proxy', async () => {
    stubFetchByPath(fetchMock, {
      '/assignments/3': jsonResponse({
        id: 3,
        name: 'Lab 1',
        description: ASSIGNMENT_BODY,
      }),
    })
    const { wrapper } = await mountAppAtPath('/programs/585/read/3')

    const urls = (fetchMock.mock.calls as [string][]).map(([url]) => url)
    expect(urls).toContain('/api/v1/courses/585/assignments/3')
    expect(wrapper.find('h1').text()).toBe('Lab 1')
    expect(wrapper.find('article').text()).toContain('Build a small store.')
  })

  it('strips script elements and inline event handlers before Canvas HTML reaches the DOM, while rendering the benign parts', async () => {
    stubFetchByPath(fetchMock, {
      '/pages/intro-to-vue': jsonResponse({
        url: 'intro-to-vue',
        title: 'Intro to Vue',
        body: MALICIOUS_PAGE_BODY,
      }),
    })
    const { wrapper } = await mountAppAtPath('/programs/585/read/2')

    const article = wrapper.find('article')
    expect(article.exists()).toBe(true)
    expect(wrapper.find('script').exists()).toBe(false)
    expect(article.html()).not.toContain('<script')
    expect(article.html()).not.toContain('onerror')
    expect(article.html()).not.toContain('alert')
    expect(article.html()).not.toContain('steal')
    expect(article.text()).toContain('Hi')
    expect(
      wrapper.find('img[src="https://canvas.example/cat.png"]').exists(),
    ).toBe(true)
  })

  it('shows a not-found message for an item id that no Module contains', async () => {
    stubFetchByPath(fetchMock)
    const { wrapper } = await mountAppAtPath('/programs/585/read/999')

    expect(wrapper.text()).toContain('not part of this Program')
    expect(wrapper.find('article').exists()).toBe(false)
  })

  it('renders nothing local while the content fetch is pending — no "Loading…" text', async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    const { wrapper } = await mountAppAtPath('/programs/585/read/2')

    expect(wrapper.text()).not.toContain('Loading…')
  })

  it('redirects to connect when no token is stored, fetching nothing', async () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    stubFetchByPath(fetchMock)
    const { wrapper, router } = await mountAppAtPath('/programs/585/read/2')

    expect(router.currentRoute.value.name).toBe('connect')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.find('article').exists()).toBe(false)
  })

  it('shows an error state when Canvas rejects the content request', async () => {
    stubFetchByPath(fetchMock, {
      '/pages/intro-to-vue': jsonResponse(
        { error: 'Not found' },
        404,
      ),
    })
    const { wrapper, router } = await mountAppAtPath('/programs/585/read/2')

    expect(router.currentRoute.value.name).toBe('reading')
    expect(wrapper.text()).toContain('Could not load')
    expect(wrapper.find('article').exists()).toBe(false)
  })

  it('highlights an unlabeled code block in the rendered body using automatic language detection', async () => {
    stubPageBody(fetchMock, PAGE_BODY_WITH_CODE)
    const { wrapper } = await mountAppAtPath('/programs/585/read/2')

    const article = wrapper.find('article')
    const highlighted = article.find('code.hljs')
    expect(highlighted.exists()).toBe(true)
    expect(highlighted.classes()).toContain('language-javascript')
    expect(highlighted.find('.hljs-keyword').text()).toBe('const')
    // scoped to the reading-view content only — a decoy block outside the
    // rendered content stays untouched (no document-wide scan)
    const decoy = document.createElement('pre')
    decoy.innerHTML = '<code>const outside = true;</code>'
    document.body.appendChild(decoy)
    expect(decoy.querySelector('code')?.className).toBe('')
    decoy.remove()
  })

  it('applies the shipped highlight theme stylesheet when content renders', async () => {
    stubPageBody(fetchMock, PAGE_BODY_WITH_CODE)
    await mountAppAtPath('/programs/585/read/2')

    const link = document.querySelector('#hljs-theme-stylesheet')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/hljs-themes/warm-dark.css')
  })

  it('exposes a per-block language override that re-highlights the block', async () => {
    stubPageBody(fetchMock, PAGE_BODY_WITH_CODE)
    const { wrapper } = await mountAppAtPath('/programs/585/read/2')

    const article = wrapper.find('article')
    const select = article.find('select.code-lang-select')
    expect(select.exists()).toBe(true)
    expect(select.attributes()['aria-label']).toBe('Code language')

    const code = article.find('code.hljs')
    const spansBefore = code.findAll('span').length
    expect(spansBefore).toBeGreaterThan(0)
    // the rendered highlighting itself changes, not just a class
    await select.setValue('plaintext')
    expect(code.classes()).toContain('language-plaintext')
    expect(code.findAll('span').length).toBe(0)
    await select.setValue('auto')
    expect(code.classes()).toContain('language-javascript')
    expect(code.findAll('span').length).toBeGreaterThan(0)
  })

  it('styles typography and spacing only through the token layer — no raw hex, px, or rem sizes', async () => {
    const source = readFileSync('src/views/ReadingView.vue', 'utf8')
    // Hairline border widths (1px/3px) are structural, not design tokens;
    // everything else — colors, type, spacing — must come from tokens.css.
    const withoutHairlineBorders = source.replace(
      /border[a-z-]*:\s*[^;]*\dpx[^;]*/g,
      '',
    )
    expect(withoutHairlineBorders).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(withoutHairlineBorders).not.toMatch(/\d+px/)
    expect(withoutHairlineBorders).not.toMatch(/\d+rem/)
  })
})

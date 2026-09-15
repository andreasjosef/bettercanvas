# Research: Canvas code-block HTML markup and syntax-highlighting fit

Resolves GitHub issue #4, part of the wayfinder map (#1).

Tested against: `https://chasacademy.instructure.com` (this school's live
Canvas instance) on 2026-09-15, using `curl` (server-side, per ADR-0001's
revised thin-proxy plan from research 0003 — CORS is settled, not
re-litigated here) with `Authorization: Bearer $CANVAS_TOKEN` loaded from
`.env.local`.

## Direct answer

**Canvas's Rich Content Editor did not produce a single `<pre>`-wrapped
code block in any Page body across the two courses that actually have
Pages** (585 "Fullstackutvecklare Javascript", 100/100 pages fetched and
scanned; 586 "Chas Career Materialbank", 34/34 pages fetched and scanned;
course 619 "CodeForGood" has **zero** Pages — `GET
/api/v1/courses/619/pages?per_page=100` returned `[]` with `HTTP 200`).
Teachers at this school link out to GitHub repos and videos for real code
examples instead of pasting code into Canvas Pages. The only code-related
markup found anywhere was **one instance of bare inline `<code>`**,
un-classed, wrapping HTML-entity-escaped text, used for short inline
snippets like `<code>&lt;div&gt;</code>` — not a multi-line code block.

Given that:

- **highlight.js is the best fit**, for two independent reasons: (1) it
  ships **built-in automatic language detection**, which is the only
  realistic option here since Canvas gives **no language hint anywhere**
  in the one real sample found, and (2) it can highlight in place on
  whatever `<pre><code>`/`<code>` DOM Canvas's body HTML already contains,
  with no markup transformation required.
- **Prism is a weaker fit for this specific data**: per Prism's own FAQ
  and GitHub issue history, it has **no automatic language detection at
  all** — it requires a `language-xxxx` class already present on the
  element, which Canvas's markup never supplies (verified above).
- **Shiki is the worst fit for "consume Canvas's markup as-is"**: it
  doesn't operate on existing DOM/HTML at all. It takes a raw source-code
  *string* and generates brand-new HTML via `codeToHtml()`; Canvas's
  original `<pre>`/`<code>` wrapper would have to be stripped down to its
  text content first, discarding the existing markup rather than
  highlighting it in place.
- **Runtime theme switching** ("swap the CSS theme with no rebuild"): both
  **highlight.js and Prism** support this natively and trivially — a
  theme is just a linked/imported CSS stylesheet, so switching the theme
  at runtime is swapping which stylesheet is active (or its `href`), with
  no re-highlighting needed. **Shiki's own dual-theme mechanism is CSS
  based too** (CSS variables per token, toggled by a class or media
  query) — but it only supports switching among a **small, fixed set of
  themes chosen at HTML-generation time**; free-form "pick any of N
  themes" would require re-running Shiki's highlighter (WASM grammar
  engine) in the browser, a much heavier runtime footprint than a
  stylesheet swap.

**Recommendation:** use **highlight.js**, calling its automatic-detection
mode (`highlightAll()` / `highlightElement()`) directly against whatever
`<pre><code>`/`<code>` elements appear in a rendered Page body, with no
attempt to parse a language hint from Canvas's markup (there isn't one to
parse). Accept that highlight.js's detection heuristic is doc-acknowledged
as imperfect (see below) and add a manual per-block language override in
the UI as an escape hatch, rather than trying to build a bespoke
detector or defaulting silently to one language.

## Evidence: exhaustive search of this school's real Canvas Pages

### Course selection and page counts

| Course id | Name | Pages | Scanned |
|---|---|---|---|
| 585 | Fullstackutvecklare Javascript (2025) | 100 | 100/100 |
| 586 | Chas Career Materialbank (Globen) | 34 | 34/34 |
| 619 | CodeForGood | 0 | n/a (`GET /api/v1/courses/619/pages?per_page=100` → `[]`) |

Course 585 was targeted first per the issue's instruction (most likely to
contain JS examples — it's the JS/TS/React curriculum). No page body
matched `<pre`. A follow-up scan for other syntax-highlighting fingerprints
(`language-`, `hljs`, `prettyprint`, `brush:`, `codehilite`) across all 134
pages fetched (585 + 586) found **no matches** for any of those. One
unrelated false-positive pattern, `class="code-line" data-line="N"`,
appears on ordinary `<h2>`/`<p>`/`<li>` elements in 8 pages — this is not
Canvas code-block markup; it's a byproduct of the page content being
authored by pasting HTML exported from a Markdown-preview tool's "click to
reveal source line" feature (e.g. VS Code's built-in Markdown preview),
unrelated to `<pre>`/`<code>` at all. Confirmed by reading one example
(`kursinformation-7`) — the `code-line`-classed elements are prose
headings and paragraphs, no code content inside them.

Per the issue's fallback instruction, course 619 (0 pages) and 586 (34
pages, all career-services content — CVs, LinkedIn, interview prep) were
both checked; neither has any code-block markup either. **585 remains the
best available real sample** despite having no full code block, because
it's the only course with an actual inline-`<code>` usage to inspect.

### The one real code-markup sample found

Course 585, page `forelasning-onsdag-praktisk-tillganglighetsgranskning`
("Praktisk tillgänglighetsgranskning" — a lecture on accessibility
auditing). Fetched via:

```
curl -s "$CANVAS_BASE_URL/api/v1/courses/585/pages/forelasning-onsdag-praktisk-tillganglighetsgranskning" \
  -H "Authorization: Bearer $CANVAS_TOKEN"
```

Relevant excerpt of the `body` field, verbatim as Canvas returned it:

```html
<li class="code-line" data-line="35">
<p class="code-line" data-line="35">Testa en knapp byggd som<span>&nbsp;</span><code>&lt;div&gt;</code><span>&nbsp;</span>mot en riktig<span>&nbsp;</span><code>&lt;button&gt;</code><span>&nbsp;</span>— vilken går att tabba till?</p>
</li>
```

Observations directly from this byte sequence:

- The wrapper is a **plain `<code>` tag, no class, no `data-*` attribute,
  no `<pre>` parent** — this is Canvas's RCE "inline code" toolbar
  formatting (a `<>`-style button in the RCE toolbar produces a bare
  `<code>` span), not a fenced code block.
- The content inside `<code>` is **HTML-entity-escaped** (`&lt;div&gt;`,
  not a live `<div>` element) — confirms Canvas treats it as literal text
  content, safe to read as `textContent`/decoded entities without further
  sanitization concerns.
- **No language hint anywhere** — no `class="language-*"`, no
  `data-lang`, nothing. This matches the issue's third bullet's "no
  language hint at all" scenario exactly, for the one real sample
  available.

No multi-line `<pre>` block exists in this account's real data to inspect
for block-level markup, so the "what does a Canvas *code block* look like"
question is answered only by absence: **this school's authors don't use
Canvas's fenced/block code formatting at all** in any Page sampled — they
paste inline `<code>` for short snippets and link out (GitHub repos,
videos) for real code. Better Canvas's renderer needs to handle plain,
unlabeled `<pre>`/`<code>` generically (per Canvas's own toolbar behavior
inferred from the inline case) rather than assume any richer wrapper.

## Canvas's own documentation: silent on code-block output HTML

Searched Instructure's developer docs and Community knowledge base for an
authoritative statement of what HTML the RCE emits for code:

- The Community "Rich Content Editor HTML Cheatsheet" articles
  (`community.instructure.com/t5/Canvas-LMS-Blog/Rich-Content-Editor-HTML-Cheatsheet/ba-p/266820`
  and the "New and Improved" successor) are the closest thing to a
  reference for RCE-generated HTML, but neither could be read past
  Instructure Community's sign-in wall via automated fetch, and no
  cached/indexed excerpt found in search results mentions `<pre>`,
  `<code>`, or syntax highlighting specifically.
- `canvas.instructure.com/doc/api/*` (the official REST API docs) document
  the `body` field of a Page only as "the page's HTML content"
  (`https://canvas.instructure.com/doc/api/pages.html`) — no schema or
  markup contract for code formatting.
- The open-source `canvas-rce` package
  (`github.com/instructure/canvas-lms/tree/master/packages/canvas-rce`)
  is the actual source of the editor's output, but its README documents
  integration (npm usage, plugin config), not a spec of generated HTML per
  content type — consistent with "many editors don't document their exact
  output HTML," as the issue anticipated.

**Conclusion: Canvas has no documented HTML contract for code blocks.**
The only reliable source of truth is empirical inspection of real page
bodies (above), and — for the block-level case this account's data
doesn't exercise — the generic, widely-observed TinyMCE/RCE-family
behavior of a plain `<pre><code>` pair with no attributes, which the
"no attributes on inline `<code>`" finding above is at least consistent
with.

## Library fit, verified against each library's own docs/source

### highlight.js — best fit

- **Markup expected**: "This will find and highlight code inside of
  `<pre><code>` tags; it tries to detect the language automatically."
  (`highlight.js` README,
  `https://github.com/highlightjs/highlight.js/blob/main/README.md`) —
  i.e. it scans existing DOM, no transformation of Canvas's markup needed
  beyond calling `hljs.highlightAll()` (or `highlightElement()` per node
  if you want to scope it to a rendered Page body).
- **Language hint format** (if one existed): `class="language-html"` or
  `lang-html` on the `<code>` element (same README) — not present in
  Canvas's sample, which is why detection matters here.
- **Automatic language detection**: real and built in, not a plugin.
  Documented mechanism, from highlight.js's own Language Definition Guide
  (`https://github.com/highlightjs/highlight.js/blob/main/docs/language-guide.rst`):
  "it tries to highlight a fragment with all the language definitions and
  the one that yields most specific modes and keywords wins," driven by a
  per-language "relevance" score that language authors tune. This is a
  heuristic, not a guarantee — the docs frame relevance-tuning as an
  ongoing, imperfect exercise (language definitions are expected to "help
  this heuristic" rather than the heuristic being definitive), and
  real-world reports (e.g. `highlightjs/highlight.js#1213`, "Auto-detection
  discussion and its difficulties") document concrete failure modes (e.g.
  JavaScript misdetected as YAML when both are in the active language
  set). **Treat it as "usually right, sometimes wrong," not "reliable."**
- **Runtime theme switching**: themes are plain CSS files
  (`highlight.js/styles/*.css`); the README shows both a `<link
  rel="stylesheet" href=".../styles/default.min.css">` tag and an ES
  module `import 'highlight.js/styles/github.css'` form. Swapping the
  active stylesheet (or its `href`) at runtime, with no re-highlighting,
  is exactly how a theme picker would work — no rebuild, no re-run of the
  highlighter.

### Prism — workable, but needs a language hint Canvas doesn't give

- **Markup expected**: "The recommended way to mark up a code block is a
  `<pre>` element with a `<code>` element inside, using the
  `language-xxxx` class on the `<code>` element" (Prism's own site,
  `prismjs.com`) — same shape as highlight.js, so equally low
  transformation cost *if* a language class were present.
- **No automatic language detection**: Prism has never implemented this.
  Its own FAQ (`https://prismjs.com/faq.html`) does not offer detection as
  a feature at all, and the feature request
  `github.com/PrismJS/prism/issues/1313` ("Support auto detecting
  language"), filed 2018, is closed without the feature being added — an
  "Autoloader" plugin exists, but it only *loads the grammar file* for a
  language class already present in the markup; it does not guess the
  language from content. Given Canvas supplies no language class at all,
  Prism would need a separate detector bolted on (e.g. highlight.js's
  detector used just for language ID, then Prism for rendering) — extra
  moving parts for no benefit over just using highlight.js directly.
- **Runtime theme switching**: same CSS-swap model as highlight.js —
  themes live under `prismjs/themes/` as separate stylesheets, swappable
  at runtime.

### Shiki — most capable output, least direct fit for Canvas's markup

- **Input model**: Shiki's core API is `codeToHtml(code, options)` — it
  takes a **raw source string**, not existing DOM/HTML, and returns a
  fully new `<pre class="shiki">...` structure with per-token styling
  baked in (verified against `https://shiki.matsu.io/guide/dual-themes`).
  To use it on a Canvas Page body, Better Canvas would have to locate each
  `<pre>`/`<code>`, extract its decoded text content, discard the original
  element, and splice in Shiki's generated HTML — strictly more
  transformation than highlight.js/Prism's "highlight in place."
  Shiki still needs a language on `codeToHtml()`'s call, and — like
  Prism — ships no auto-detection of its own.
- **Runtime theme switching**: Shiki's documented "dual/multi themes"
  approach (same URL) bakes a **fixed, pre-chosen set** of themes into CSS
  variables at generation time (`--shiki-dark`, `--shiki-light`, etc.),
  toggled at runtime via a CSS class or `prefers-color-scheme` media
  query. This *is* real runtime switching, but only among the themes
  chosen up front — a free-form "pick any theme from a list" picker (the
  idea.md requirement) would mean either (a) pre-generating CSS-variable
  HTML for every theme you want to offer (impractical beyond a handful),
  or (b) running Shiki's own highlighter client-side to regenerate HTML
  per theme choice, which pulls in Shiki's WASM-based TextMate grammar
  engine into the browser bundle — a much heavier runtime dependency than
  a highlight.js/Prism CSS-file swap.

## Implication / recommendation

1. **Use highlight.js**, not Prism or Shiki, given the markup Canvas
   actually produces (bare, unlabeled `<code>`/`<pre>`) and the
   theme-picker requirement from idea.md: it's the only one of the three
   that both (a) works directly on Canvas's existing markup with no
   text-extraction/regeneration step, and (b) has genuine automatic
   language detection, addressing the "no language hint" finding head-on.
2. **Do not trust auto-detection blindly.** highlight.js's own docs
   describe it as a best-effort heuristic with documented failure modes.
   Given Better Canvas is a small, single-user tool (not a public product
   needing bulletproof accuracy), the pragmatic combination is:
   auto-detect by default, and expose a simple manual per-block language
   override in the UI for the (probably rare, given this school barely
   embeds code at all) cases where detection is visibly wrong.
3. **Theme switching is a solved problem once highlight.js is chosen** —
   ship a handful of its bundled theme stylesheets and swap the active one
   by changing a `<link>`/import at runtime; no re-highlighting or
   WASM-engine bundle required.
4. **Re-open this question if a Page with a real `<pre>` code block ever
   turns up** (e.g. a future course, or a teacher who changes authoring
   habits) — everything here about block-level markup is inferred from
   Canvas's inline-`<code>` behavior and generic RCE/TinyMCE conventions,
   not a directly observed `<pre>` sample from this account's real data.

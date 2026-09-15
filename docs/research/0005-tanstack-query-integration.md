# Research: TanStack Query integration approach

Resolves GitHub issue #41, part of the wayfinder map (#40).

Verified 2026-09-15 against: the npm registry (`npm view`, `registry.npmjs.org`
JSON, and `unpkg.com` source for the exact resolved version), the official
TanStack Query docs at `tanstack.com/query`, the `TanStack/query` GitHub repo
(source, releases, PRs, migration guide, RFC discussion), and this repo's
`src/api/canvas.ts` / `src/reconnect.test.ts` / `src/router/index.ts`.

## Direct answer

**Adopt the official `@tanstack/vue-query` adapter (current stable `5.102.8`,
verified via `npm view @tanstack/vue-query version` against the live
registry), wrapped thinly around the existing `canvas.ts` fetchers with no
changes to `canvas.ts` itself.** Use a hierarchical array query-key factory
(`['courses']`, `['courses', courseId, 'modules']`, etc.), resolve each
paginated list as a single `useQuery` (not `useInfiniteQuery` — this app has
no "load more" UI and `fetchAllPages` already collapses pagination into one
array), override the library's defaults with `staleTime: 5 * 60 * 1000`
(5 min) and leave `gcTime` at its default 5 minutes, and **do not add a
`QueryCache`-level `onError` for the 401/403-redirect concern** — the
existing `authFailureHandler` in `canvasFetch` already fires unconditionally
before TanStack Query ever sees the rejected promise, so a second global
handler would be redundant for that purpose. The one piece of `QueryCache`
config that *does* pull its weight is a shared `retry` function that stops
retrying on `CanvasError` with `status` 401/403, so a doomed query doesn't
hammer Canvas three more times (with backoff) after the redirect has already
fired.

## 1. Official `@tanstack/vue-query` adapter vs. hand-rolled composables

**Verdict: use the official adapter. There is no case for hand-rolling.**

- `npm view @tanstack/vue-query version` → `5.102.8` (checked live against
  the registry). `npm view @tanstack/vue-query dist-tags --json` confirms
  `"latest": "5.102.8"` — this is the current stable release, not a
  prerelease (`alpha`/`beta`/`rc` tags point elsewhere: `5.0.0-alpha.91`,
  `5.0.0-beta.35`, `5.0.0-rc.16`).
- `npm view @tanstack/vue-query peerDependencies --json` →
  `{"@vue/composition-api": "^1.1.2", "vue": "^2.6.0 || ^3.3.0"}`. This
  repo's `vue: ^3.5.42` satisfies `^3.3.0`. The `@vue/composition-api` peer
  is marked optional via `peerDependenciesMeta`
  (`npm view @tanstack/vue-query peerDependenciesMeta --json` →
  `{"@vue/composition-api": {"optional": true}}`) — it's a shim needed only
  for Vue 2.6 projects, per the official install docs
  (tanstack.com/query/latest/docs/framework/vue/installation: "If you are
  using Vue 2.6, make sure to also setup `@vue/composition-api`"). It's
  inert for this Vue 3.5 app.
- The package has **no peer or runtime dependency on Vite, Vitest, or any
  bundler/test-runner** — `npm view` shows its own `dependencies` are
  `@tanstack/query-core` (pinned to the same `5.102.8`), `@tanstack/
  match-sorter-utils`, `@vue/devtools-api`, and `vue-demi`. It ships plain
  ESM/CJS builds (`unpkg.com/@tanstack/vue-query@5.102.8/build/legacy/
  index.d.ts` shows a conventional `index.js`/`index.cjs` build, no
  Vite-plugin or Vitest-environment entrypoint). A published library like
  this is consumed the same way regardless of which bundler or test runner
  the *consuming* app uses — Vite 8 and Vitest 5 are irrelevant to how
  `@tanstack/vue-query`'s own code executes at runtime.
- **Honest flag on CI coverage, and why it's a non-issue here**: TanStack
  Query's own monorepo does not yet test against Vite 8 or Vitest 5. Its
  root `package.json` (`raw.githubusercontent.com/TanStack/query/main/
  package.json`) currently pins `"vite": "^6.4.1"` and `"vitest": "^4.0.18"`
  for its *own* internal build/test tooling — i.e., TanStack's CI matrix is
  one major behind this project on both. There *is* live TanStack work
  touching newer Vite majors, but it's scoped to **TanStack Start /
  TanStack Router's SSR dev-server integration**, not Query: see
  `TanStack/router#7614` ("TanStack Start dev server returns 'Cannot GET /'
  on Vite 8 (SSR middleware silently skipped...)") — that's a
  framework-level Vite plugin/dev-server integration bug in a *different*
  TanStack package (Router/Start ships an actual Vite plugin; Query does
  not). `@tanstack/vue-query` has no dev-server middleware or build-time
  plugin surface for a Vite major bump to break. Net assessment: **this is
  a real gap in TanStack's own tested matrix, but not a real risk for this
  codebase** — Vue Query is a plain runtime dependency, and this project's
  own `vitest: ^5.0.0` test suite (e.g. `src/reconnect.test.ts`, which
  drives `vi.stubGlobal('fetch', ...)`) exercises Query through ordinary
  `fetch`-mocking, not through anything Vite- or Vitest-major-specific in
  Query's own internals.
- Hand-rolling composables over the lower-level `@tanstack/query-core`
  (also verified at `5.102.8` via `npm view @tanstack/query-core version`)
  would mean re-implementing exactly what `@tanstack/vue-query` already
  provides — `useQuery`/`useInfiniteQuery`/`useQueryClient` Vue bindings,
  `VueQueryPlugin` for app-level installation, Vue Devtools integration
  (`@vue/devtools-api` dependency), and reactive interop via `vue-demi` —
  for a single-maintainer project with no documented reason (no missing
  feature, no bundle-size complaint, no known adapter bug) to avoid the
  first-party adapter. There is no finding in this research that justifies
  the extra maintenance surface.

## 2. Query key convention

TanStack's own **Query Keys** guide
(`docs/framework/react/guides/query-keys.md`, shared verbatim into the Vue
docs via its `ref:` frontmatter — vue-specific query-key guidance is the
same content) states the rule directly:

> "Query keys have to be an Array at the top level... As long as the query
> key is serializable using `JSON.stringify`, and **unique to the query's
> data**, you can use it!"

and shows the hierarchical pattern this doc adopts:

```tsx
// An individual todo
useQuery({ queryKey: ['todo', 5], ... })

// A list of todos that are "done"
useQuery({ queryKey: ['todos', { type: 'done' }], ... })
```

Notably, **there is no official "Query Key Factories" doc page** — the
"Further reading" section of the Query Keys guide points to a community
blog post (TkDodo's "Effective React Query Keys") and a **third-party**
community package (`lukemorales/query-key-factory`), not a first-party
TanStack utility. So "hierarchical array convention" is TanStack's own
documented guidance; the specific factory-object *packaging* of it is a
convention this repo should pick for itself, which is exactly what's
proposed below. TanStack does ship one first-party helper worth using for
this, though: **`queryOptions()`** (confirmed exported from
`@tanstack/vue-query` — `unpkg.com/@tanstack/vue-query@5.102.8/build/
legacy/index.d.ts` lists `queryOptions` and `infiniteQueryOptions` in its
public exports). Per the official guide
(`docs/framework/react/guides/query-options.md`): "One of the best ways to
share `queryKey` and `queryFn` between multiple places, yet keep them
co-located to one another, is to use the `queryOptions` helper... At
runtime, this helper just returns whatever you pass into it." That's the
natural container for each entry in a key factory.

Proposed convention for this domain, mapped onto the existing `canvas.ts`
fetchers:

```ts
export const canvasKeys = {
  courses: () => ['courses'] as const,
  modules: (courseId: number) => ['courses', courseId, 'modules'] as const,
  assignments: (courseId: number) =>
    ['courses', courseId, 'assignments'] as const,
  nextDueAssignment: (courseId: number) =>
    ['courses', courseId, 'assignments', 'next-due'] as const,
  pageBody: (courseId: number, pageUrl: string) =>
    ['courses', courseId, 'pages', pageUrl] as const,
  assignmentDescription: (courseId: number, assignmentId: number) =>
    ['courses', courseId, 'assignments', assignmentId, 'description'] as const,
}
```

This nests everything under `['courses', courseId, ...]` so that
invalidating/removing `canvasKeys.courses()`'s children is a single
`queryClient.invalidateQueries({ queryKey: ['courses', courseId] })` per
course when needed, matches the app's own domain nesting (a Program/Course
owns its Modules and Assignments), and keeps each leaf key unique per the
"serializable and unique to the query's data" rule quoted above.

**Whole-list-as-one-query vs. `useInfiniteQuery`**: resolve each
`fetchAllPages`-backed fetcher (`fetchCourses`, `fetchModules`,
`fetchAssignments`) as a single ordinary `useQuery`, not
`useInfiniteQuery`. TanStack's own **Infinite Queries** guide
(`docs/framework/react/guides/infinite-queries.md`) frames the feature
around a specific UI need: "Rendering lists that can additively 'load
more' data onto an existing set of data or 'infinite scroll' is also a
very common UI pattern." Its mechanics — `data.pages`/`data.pageParams`,
`fetchNextPage`, `hasNextPage`, `isFetchingNextPage` — exist to let a
component progressively render partial results and let the user trigger
the next page. This app has no such UI: Programs/Modules/Assignments
lists render as complete lists once loaded, and (per
`docs/research/0003-canvas-api-direct-browser-access.md`, empirically
verified against this school's live Canvas instance) real data volumes are
single digits of courses and tens of items per course — pagination past
`per_page=100` essentially never triggers. `fetchAllPages` in `canvas.ts`
already does the correct thing for this shape of problem: it follows the
`Link` header in a loop and returns one fully-resolved array. A `queryFn`
that just calls `fetchAllPages` (via the existing public fetchers)
resolves as one `useQuery` with one loading state, which is both simpler
and matches how the data is actually consumed. `useInfiniteQuery` would
add page-cursor bookkeeping this UI has no use for, for a documented
feature whose value proposition (progressive/"load more" rendering) does
not apply here.

## 3. `staleTime` / `gcTime` defaults

Verified directly from the installed package's source rather than
paraphrased docs, at the exact resolved version (`@tanstack/
query-core@5.102.8`, same version vue-query itself depends on):

- **`staleTime` defaults to `0`.** `unpkg.com/@tanstack/
  query-core@5.102.8/src/query.ts`: `isStaleByTime(staleTime: StaleTime =
  0): boolean`. TanStack's **Important Defaults** guide confirms the
  behavioral consequence in prose: queries "by default... consider cached
  data as stale," which is why every remount/refocus refetches unless
  overridden.
- **`gcTime` defaults to 5 minutes client-side (`Infinity` on the
  server).** `unpkg.com/@tanstack/query-core@5.102.8/src/removable.ts`,
  `updateGcTime()`:
  ```ts
  // Default to 5 minutes (Infinity for server-side) if no gcTime is set
  this.gcTime = Math.max(
    this.gcTime || 0,
    newGcTime ?? (isServerEnvironment() ? Infinity : 5 * 60 * 1000),
  )
  ```
  This app is a client-only SPA (no SSR), so the `5 * 60 * 1000` (5-minute)
  branch is the one that applies.

**Recommendation for this codebase: override `staleTime` to `5 * 60 * 1000`
(5 minutes) in the `QueryClient`'s `defaultOptions.queries`, and leave
`gcTime` at its library default (also 5 minutes).**

Reasoning: Canvas course/module/assignment content is authored by teachers
outside of any realtime collaboration with this app — there is no
websocket, no server push, and no expectation that a teacher's edit needs
to appear mid-session without an explicit user action. The current
uncached `canvas.ts` behavior effectively treats every navigation as a
fresh fetch; a `staleTime` of `0` (the library default) would still refetch
on every remount/window refocus, which reproduces exactly the "fetch every
time" problem this issue exists to fix rather than solving it. Raising
`staleTime` to 5 minutes means a user browsing between the Modules and
Assignments views of the same course within a session won't re-hit Canvas
for data that's already in memory, while still refreshing automatically if
the session runs long enough to plausibly cross a content update. `gcTime`
governs how long an *unused* (unobserved) query stays cached before
eviction — 5 minutes is already generous for a single-user app with only
single-digit courses in memory at once (per the 0003 research: 3 courses,
11 modules, 37 assignments in the real tested account), so there's no
memory-pressure or staleness reason to change it; the library default
matches this workload as-is.

## 4. Integrating `authFailureHandler`/`CanvasError` with Query's error handling

**`authFailureHandler` fires inside `canvasFetch` itself, unconditionally,
before TanStack Query ever sees the error** — confirmed by reading
`src/api/canvas.ts`:

```ts
if (!response.ok) {
  if (response.status === 401 || response.status === 403) {
    authFailureHandler?.()
  }
  throw new CanvasError(response.status)
}
```

and `src/router/index.ts`, which is where the handler is actually wired:

```ts
setAuthFailureHandler(() => {
  if (router.currentRoute.value.name === 'connect') return
  void router.replace({ name: 'connect', query: { reason: RECONNECT_REASON } })
})
```

If a TanStack Query `queryFn` is a thin wrapper that just calls
`fetchCourses`/`fetchModules`/etc., the `throw new CanvasError(...)`
happens *after* `authFailureHandler()` has already run — the redirect to
`/connect?reason=token-invalid` is dispatched regardless of whether Query
is even involved. `src/reconnect.test.ts` asserts exactly this behavior
today (401 from the picker load, 403 from the home next-due call, both
routing to `connect` with `reason: 'token-invalid'`), and nothing about
introducing Query changes that call path — the assertion holds unmodified.

**On the documented v5 change this task asked to verify**: TanStack's own
v5 migration guide (`docs/framework/react/guides/migrating-to-v5.md`,
shared into the Vue docs the same way as the query-keys guide) states
plainly: **"`onSuccess`, `onError` and `onSettled` have been removed from
Queries"** (they remain on mutations). The guide points to the design
rationale in `TanStack/query` discussion **#5279**, where maintainer
TkDodo explains the callbacks were a "footgun": they ran inconsistently
per-observer (sometimes not at all once `staleTime` masked a request as
already-fresh), and "if you only run it once per query, you can easily get
into stale closure issues, because it's not clear for which observer it
will run." The discussion documents two replacement patterns: (1) a
**`QueryCache`-level `onError`/`onSuccess`/`onSettled`** passed to
`new QueryCache({ onError: (error, query) => {...} })` for global,
observer-count-independent side effects, or (2) deriving side effects from
reactive state (`isError`/`error`) at the call site instead of a callback.
`QueryCacheConfig.onError` is confirmed still present in the installed
v5.102.8 source (`unpkg.com/@tanstack/query-core@5.102.8/src/
queryCache.ts`):
```ts
export interface QueryCacheConfig {
  onError?: (error: DefaultError, query: Query<unknown, unknown, unknown>) => void
  ...
}
```
— so per-query `onError` is gone in v5, but the global `QueryCache`-level
hook this task asked about is real and unchanged in shape from v4.

**Recommendation: do not add a `QueryCache`-level `onError` for the
401/403-redirect itself — that job is already fully done by the existing
`authFailureHandler` seam, unconditionally, before Query is in the
picture.** Duplicating it at the `QueryCache` level would either be
inert (the redirect already happened) or, worse, a second source of truth
for the same decision that could drift from the router's own logic (e.g.
the `router.currentRoute.value.name === 'connect'` guard against redirect
loops lives in exactly one place today — `router/index.ts` — and should
stay there).

Where a `QueryCache`/`QueryClient`-level hook *does* add real, non-redundant
value: **retry suppression on auth errors.** Query's default `retry`
behavior (per the **Query Retries** guide) retries a failed query up to 3
times with exponential backoff (starting at 1000ms, capped at 30s) *before*
the query is considered failed. Without an override, a 401/403 from an
expired token would still retry 3 additional times against Canvas — each
one re-invoking `canvasFetch` and therefore re-firing `authFailureHandler`
redundantly — after the redirect has already been dispatched on attempt
one. `retry` accepts `(failureCount, error) => boolean`, so a single global
default in the `QueryClient` constructor closes this gap cleanly:

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) =>
        !(error instanceof CanvasError && (error.status === 401 || error.status === 403)) &&
        failureCount < 3,
    },
  },
})
```

This is a `defaultOptions.queries.retry` setting on the `QueryClient`, not
a `QueryCache`-level `onError` — it's a different, narrower piece of
config than the one this task asked to compare against per-query
`onError`, and it's the one piece worth adding: it stops Query from
hammering an already-known-bad token, without duplicating the redirect
decision that `authFailureHandler` already owns.

## Implication for this codebase: concrete next steps

1. **Add the dependency**: `@tanstack/vue-query@^5.102.8` (matches this
   repo's existing `^`-range convention in `package.json`, e.g.
   `"vue": "^3.5.42"`).
2. **Construct and provide the `QueryClient` in `src/main.ts`**, alongside
   the existing `createAppRouter()` wiring:
   ```ts
   import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'

   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 5 * 60 * 1000,
         retry: (failureCount, error) =>
           !(error instanceof CanvasError && (error.status === 401 || error.status === 403)) &&
           failureCount < 3,
       },
     },
   })

   createApp(App)
     .use(createAppRouter())
     .use(VueQueryPlugin, { queryClient })
     .mount('#app')
   ```
   `CanvasError` is already exported from `src/api/canvas.ts`, so this
   needs one new import in `main.ts` and no change to `canvas.ts`.
3. **`canvas.ts` needs no rewrite.** Its exported fetchers
   (`fetchCourses`, `fetchModules`, `fetchAssignments`,
   `fetchNextDueAssignment`, `fetchPageBody`, `fetchAssignmentDescription`,
   `locateModuleItem`) become `queryFn` bodies as-is — e.g.
   `useQuery({ queryKey: canvasKeys.modules(courseId), queryFn: () =>
   fetchModules(token, courseId) })`. `fetchAllPages`,
   `proxyPathFromNextLink`, `parseNextLink`, `CanvasError`,
   `ProxyUnreachableError`, and `setAuthFailureHandler` all stay exactly as
   they are.
4. **New query-key factory module**: add `src/api/canvasKeys.ts` (or a
   `canvasKeys` export colocated in `canvas.ts` if the team prefers one
   file) holding the `canvasKeys` object proposed in section 2. Call sites
   (the views currently calling `canvas.ts` fetchers directly) import both
   the fetcher and its matching key from here.
5. **`authFailureHandler` integration point needs no change.** It's set
   once, in `src/router/index.ts`'s `createAppRouter()`, and fires from
   inside `canvasFetch` regardless of whether the call originated from a
   plain `await fetchModules(...)` or from inside a Query `queryFn` — the
   call graph is identical either way. `src/reconnect.test.ts` should keep
   passing unmodified once views are migrated to `useQuery`, since it
   stubs `global.fetch` and asserts on router state, neither of which
   changes shape. The only new piece of config, per point 2, is the
   `defaultOptions.queries.retry` guard in the new `QueryClient` — that's
   additive (stops redundant retries against an already-known-bad token)
   and isn't a change to the existing handler/router wiring itself.
6. **Migrate views incrementally**, one Canvas-data consumer at a time
   (e.g. start with `PickerView`'s `fetchCourses` call, since it's the
   entry point exercised by the first `reconnect.test.ts` case), rather
   than a single big-bang cutover — nothing in this research requires an
   all-at-once migration, and `canvas.ts`'s fetchers work identically
   whether called directly or wrapped in a `queryFn`.

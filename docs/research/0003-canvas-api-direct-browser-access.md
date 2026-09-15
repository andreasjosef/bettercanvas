# Research: Canvas API direct-browser access, endpoints, and pagination

Resolves GitHub issue #3, part of the wayfinder map (#1). Make-or-break input
for ADR-0001 (client-only, no backend).

Tested against: `https://chasacademy.instructure.com` (this school's live
Canvas instance) on 2026-09-15, using `curl` to simulate exactly what a
browser `fetch()` would see (request `Origin` header on both the CORS
preflight and the real request; check for `Access-Control-Allow-*` in the
response — that's what a browser enforces, not what curl itself enforces).

## Direct answer

**No — direct browser `fetch()` to the Canvas REST API is blocked by CORS,
for every endpoint tested.** Canvas never sends any `Access-Control-Allow-*`
response header, on either the `OPTIONS` preflight or the real `GET`
request, for `/api/v1/courses`, `/api/v1/courses/:id/modules`, or
`/api/v1/courses/:id/assignments`. A browser sending `Authorization:
Bearer <token>` cross-origin triggers a CORS preflight (because
`Authorization` is a non-simple header); Canvas's preflight response is a
bare `404` with no CORS headers, so the browser aborts before ever sending
the real request — the actual endpoint's own lack of
`Access-Control-Allow-Origin` is almost moot, since the preflight fails
first.

This directly contradicts the "call the Canvas API directly from the
browser" premise of ADR-0001. See "Implication for ADR-0001" below.

## CORS test evidence

All commands run with `CANVAS_BASE_URL` and `CANVAS_TOKEN` loaded from
`.env.local` (repo root) into shell variables; the token is never printed
in full below — reference it only as `$CANVAS_TOKEN`.

### 1. OPTIONS preflight — `/api/v1/courses`

```
curl -s -D - -o /dev/null -X OPTIONS "$CANVAS_BASE_URL/api/v1/courses" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization"
```

Result: `HTTP/2 404`. Full response headers captured — no
`Access-Control-Allow-Origin`, `-Methods`, or `-Headers` header anywhere in
the response. Canvas does not implement an `OPTIONS` route for this path at
all; it 404s like any unmatched route, meaning it never even reaches CORS
handling. A browser would treat this preflight failure as a hard CORS
error and never send the real `GET`.

### 2. Real GET request (with `Origin` header) — `/api/v1/courses`

```
curl -s -D - -o /tmp/courses_resp.json "$CANVAS_BASE_URL/api/v1/courses?per_page=100" \
  -H "Origin: http://localhost:5173" \
  -H "Authorization: Bearer $CANVAS_TOKEN"
```

Result: `HTTP/2 200`, valid JSON body (3 courses), but headers contain no
`Access-Control-Allow-Origin` (only `link`, `vary: Accept-Encoding`, and
standard headers). curl itself isn't CORS-restricted so the request
succeeds server-side — but a real browser would receive this identical
response, see no `Access-Control-Allow-Origin`, and refuse to expose the
body to the page's JS (and in practice would never even get this far,
per #1's preflight failure).

### 3. Same pattern repeated for modules and assignments

`OPTIONS` preflight on `/api/v1/courses/585/modules?include[]=items` →
`404`, no CORS headers.
`OPTIONS` preflight on `/api/v1/courses/585/assignments` → `404`, no CORS
headers.
Real `GET` on both (with `Origin` header) → `200` with valid data, but
again no `Access-Control-Allow-Origin` in either response.

**Conclusion: CORS is blocked identically across all three endpoint
families tested (courses, modules, assignments) — not endpoint-specific.**
No `per_page`, header, or auth-style variation was found in the docs or
community reports that changes this (see below); the block is architectural
to how Instructure-hosted Canvas serves the API, not a per-endpoint quirk.

### Documented workarounds (secondary sources, not verified against this instance)

- Community reports (Instructure Community forum, "Enabling CORS" /
  "CORS management" threads, and third-party posts) consistently describe
  the same behavior: **Canvas does not send
  `Access-Control-Allow-Origin`, and for Instructure-**cloud-hosted**
  instances (as opposed to self-hosted/open-source deployments) this
  cannot be changed by the customer/admin** — there is no Canvas-admin
  CORS-allowlist setting exposed to a school like this one. Self-hosted
  Canvas (running your own Apache/nginx in front of the open-source
  `instructure/canvas-lms`) could in principle add CORS headers at the
  web-server config layer, but that's not applicable here — chasacademy's
  instance is Instructure-hosted SaaS.
- An open issue on the first-party `instructure/canvas-lms` GitHub repo
  (instructure/canvas-lms#2292, "CORS headers not set on API urls, making
  custom web apps from a separate origin from the instance impossible")
  requests exactly this feature and remains open/unaddressed by
  Instructure maintainers — i.e., Instructure's own repo confirms the gap
  exists and has not committed to fixing it. This is the closest thing to
  a first-party acknowledgment found; no Instructure staff-authored
  Community article stating an explicit CORS policy was found (the forum
  threads read are user-authored, not marked as Instructure staff
  responses, so they're treated as corroborating secondary color, not a
  cited source of fact — the empirical curl evidence above is the basis
  for the conclusion in this file).
- The most commonly cited workaround is a small server-side proxy (exactly
  what ADR-0001 chose to avoid) that adds `Access-Control-Allow-Origin` on
  responses it forwards from Canvas, or a build-time/dev-only CORS proxy
  for local development. `no-cors` fetch mode does not help — it suppresses
  the error but also makes the response body inaccessible to JS, which is
  useless for actually reading course/module/assignment data.

## Endpoint / field / pagination reference

All three endpoints below were exercised against real data in this
account (student/teacher enrollments across 3 courses at chasacademy).

### `GET /api/v1/courses`

Doc: https://canvas.instructure.com/doc/api/courses.html

Real response (3 courses returned, this account's actual courses):

| id | name | workflow_state | blueprint | template | account_id | enrollment type |
|---|---|---|---|---|---|---|
| 586 | Chas Career Materialbank (Globen) | available | false | false | 1 | student |
| 619 | CodeForGood | available | false | false | 103 | teacher |
| 585 | Fullstackutvecklare Javascript (2025) | available | false | false | 114 | student |

- **No field reliably distinguishes a "real" teaching/study course from an
  admin/resource/blueprint course in this data.** `blueprint` and
  `template` (documented fields per
  https://canvas.instructure.com/doc/api/courses.html) are `false` for
  all three, including course 586 ("Materialbank" — a shared resource
  bank, not a course the user studies in day-to-day). `enrollments[].type`
  (`student` vs `teacher`) distinguishes role but not "real course to
  read modules/assignments in" vs "admin/resource shell" — course 586 is
  a `student` enrollment but isn't a course the user wants module/
  assignment browsing for. **This confirms the plan documented in issue
  #1 must be manual selection only** — there is no automatic classifier
  available from the API response; the "pick which Programs to show at
  first connect" picker (already decided in #1) is the only viable
  approach.
- `workflow_state` (`unpublished` / `available` / `completed` / `deleted`
  per docs) is useful for filtering out non-`available` courses but
  doesn't solve the admin/resource-bank distinction seen above.

### `GET /api/v1/courses/:id/modules?include[]=items`

Doc: https://canvas.instructure.com/doc/api/modules.html

Real response for course 585 (Fullstackutvecklare Javascript): 11 modules,
item counts ranging from 1 to 65 per module, item `type` values seen:
`Page`, `Assignment`, `SubHeader`, `ExternalUrl`, `Quiz`, `ExternalTool` —
this matches the module-item-type rendering rules already decided in issue
#1 (Pages + Assignments render inline; Files/Discussions/Quizzes/
ExternalUrls link out; SubHeaders are dividers) — no unexpected item types
showed up in this account's real data.

### `GET /api/v1/courses/:id/assignments`

Doc: https://canvas.instructure.com/doc/api/assignments.html

Real response for course 585: 37 assignments. Confirmed fields:
- **Due date field is `due_at`** (ISO 8601, `null` if not present) —
  matches doc and matches the "assignments with no due date → separate
  section" edge case already decided in #1.
- **Submissions are not included by default** — the response has no
  `submission` key unless `include[]=submission` is explicitly passed
  (confirmed empirically: default field list has ~60 keys, none of them
  `submission`; doc confirms `include[]=submission` is opt-in). So the
  default request is already the light-payload version needed — no extra
  param required to *exclude* submissions, just don't pass
  `include[]=submission`.

### Pagination

Doc: https://canvas.instructure.com/doc/api/file.pagination.html

- Canvas paginates via the `Link` response header, standard web-linking
  format, with `rel` values `current`, `next`, `prev`, `first`, `last`
  (not all present on every response — e.g. no `prev` on page 1, `last`
  may be omitted if expensive to compute). Links are absolute URLs and
  should be used as-is, not reconstructed.
- Default page size (per Canvas docs) is 10 if `per_page` isn't specified;
  no hard documented upper bound, but Canvas doc guidance is to always
  follow the `Link` header rather than assume a page size sticks.
- **At this account's real scale, none of the three endpoints paginate in
  practice**: with `per_page=50` or `per_page=100`, courses (3), modules
  (11), and assignments (37, single course) all returned in a single page
  — real captured header example:
  `link: <...courses?page=1&per_page=100>; rel="current", <...page=1...>; rel="first", <...page=1...>; rel="last"`
  (no `next`, because everything fit on page 1).
- To confirm the multi-page mechanics actually work end-to-end (not just
  "we never saw it"), assignments was re-fetched with `per_page=5` against
  the same 37-assignment course, which forced a real multi-page response:
  `link: <...page=1&per_page=5>; rel="current", <...page=2&per_page=5>; rel="next", <...page=1&per_page=5>; rel="first", <...page=8&per_page=5>; rel="last"`
  — confirms `next`/`first`/`last` behave exactly as documented when a
  result set doesn't fit in one page.
- **Practical implication**: for this school's actual data volumes (single
  digits of courses, tens of modules/assignments per course), a client
  using a generous `per_page` (50–100) will essentially never need to
  follow pagination in practice, but the client code should still honor
  the `Link` header generically (not hardcode "always one page") since
  page size isn't guaranteed to stay this small as courses accumulate
  content over further terms.

## Implication for ADR-0001

**The client-only architecture as written does not hold.** ADR-0001
commits to "Better Canvas talks to the Canvas API directly from the
browser... there is no server component, not even a thin proxy function."
The empirical CORS testing above shows this is not possible against this
school's actual Canvas instance: every endpoint needed (courses, modules,
assignments) fails CORS preflight before a browser would even send the
real request, and the real response never carries
`Access-Control-Allow-Origin` regardless. This isn't a partial or
endpoint-specific limitation that a smart client could route around
(e.g. by avoiding preflight-triggering headers) — the `Authorization`
header carrying the Personal Access Token is exactly what triggers the
preflight, and Personal Access Token auth (ADR-0002) is the chosen auth
model, so this is a hard architectural conflict, not a tuning problem.

ADR-0001 needs to be revisited. The minimal fix that preserves the rest of
ADR-0001's reasoning (single user, no need to hide secrets from other
tenants) is a **thin passthrough proxy** — e.g. a single Vercel serverless
function that forwards `{method, path, query}` to
`chasacademy.instructure.com/api/v1/...` with the token attached
server-side (or still attached client-side and merely relayed, if keeping
the token out of server logs/config matters more than keeping it out of
the browser), and adds permissive CORS headers on the way back. This keeps
static hosting for everything except this one proxy function, which is a
much smaller revision than routing through a full backend. This is now
unblocked to ticket as the "Canvas integration fallback plan" already
flagged as "Not yet specified" in issue #1.

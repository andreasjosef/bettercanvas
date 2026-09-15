# Thin server-side proxy for Canvas API calls

Better Canvas talks to the Canvas API through a single generic passthrough
proxy — one Vercel serverless function that forwards any `/api/v1/*`
request to `chasacademy.instructure.com`, relays the `Authorization`
header through unchanged, and adds permissive CORS headers on the way
back. This replaces the original "client-only, no backend" decision: empirical
testing (#3, `docs/research/0003-canvas-api-direct-browser-access.md`)
found that Canvas never sends `Access-Control-Allow-*` headers on any
endpoint needed (courses, modules, assignments), so a direct browser
`fetch()` fails CORS preflight before the request is even sent. There is
no admin-side CORS allowlist for Instructure-hosted instances like this
one, so no client-side workaround exists — a server component is
mandatory, not optional.

The proxy is generic rather than tailored per endpoint (courses/modules/
assignments only): less code, and it stays endpoint-agnostic if a later
version needs another Canvas resource. The narrower attack surface a
tailored proxy would offer isn't worth much for a single-user app. The
Personal Access Token itself stays client-owned in localStorage (per
ADR-0002) and is forwarded per-request through the proxy, which only
relays it — it is never stored or read server-side. This keeps "the user
owns and can revoke their own token" intact and avoids turning the token
into a shared server secret. Because the proxy has no privileged secret of
its own, the only gate it needs is rejecting requests with no
`Authorization` header at all, closing off casual use as an anonymous
CORS-bypass relay without narrowing the generic path-forwarding shape.

This is hosted as a Vercel function only. Vercel is the actual deploy
target; building a parallel Netlify Function for a fallback that may never
be used is speculative work this app doesn't need yet — that parity can
be added if and when Netlify is actually used.

This keeps static hosting for everything except the one proxy function, so
it's a much smaller revision than routing through a full backend — the
single-user, single-instance reasoning behind the original decision still
holds, it just no longer supports "no server component at all."

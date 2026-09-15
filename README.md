# Better Canvas

A client-only Vue 3 app that replaces Canvas LMS's own UI for reading course
content: module browsing, assignment tracking, and code-heavy reading
material, for a single user against a single Canvas instance
(`chasacademy.instructure.com`).

See `CONTEXT.md` for the domain vocabulary and `docs/adr/` for the
architectural decisions behind the proxy and auth approach.

## Development

```sh
pnpm install
pnpm dev
```

- `pnpm typecheck` — type-check with `vue-tsc`
- `pnpm test` — run the test suite (Vitest)
- `pnpm build` — type-check and build for production

## Deployment (Vercel)

This app deploys to Vercel as static hosting plus one serverless function
(`api/canvas-proxy.ts`) that proxies Canvas API requests to work around
Canvas's missing CORS headers (see `docs/adr/0001-client-only-no-backend.md`).

No deploy-time environment variables are required: the proxy's upstream
Canvas host is hardcoded in `api/canvas-proxy.ts`, and the user's Personal
Access Token is entered client-side on first connect and forwarded
per-request through the proxy — it is never stored or read server-side
(see `docs/adr/0002-personal-access-token-auth.md`).

`vercel.json` defines the routing needed for the deploy to work:

- `/api/v1/*` rewrites to the `canvas-proxy` function.
- Every other path rewrites to `/index.html` so client-side routes (e.g.
  `/programs/:id/modules`, `/settings`, `/previous-lectures`) resolve
  correctly on a direct load or page refresh, not just on in-app
  navigation. Static assets (JS/CSS bundle files) are still served
  directly and are unaffected by this fallback.

A push to `main` (via Vercel's Git integration) or a `vercel deploy`/
`vercel --prod` from a directory linked to the project (`vercel link`) is
sufficient to produce a working deploy — no manual post-deploy steps.

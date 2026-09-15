# Client-only architecture, no backend

Better Canvas talks to the Canvas API directly from the browser and stores
the user's Personal Access Token in localStorage; there is no server
component, not even a thin proxy function, in v1. This was a real trade-off
against routing calls through a Vercel serverless function to keep the
token off the client: we chose client-only because it's simpler to ship
and deploy (static hosting only), and the app has exactly one user, so the
usual reasons to hide a token server-side (multi-tenant secrets, rate-limit
pooling) don't apply. Revisiting this later means introducing a server
component and a token-handling migration, so it's not a free reversal.

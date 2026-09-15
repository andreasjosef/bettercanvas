# Better Canvas

A client-only Vue 3 app that replaces Canvas LMS's own UI for reading course
content: module browsing, assignment tracking, and code-heavy reading
material, for a single user against a single Canvas instance.

## Language

**Program**:
A Canvas Course the user has selected to show in Better Canvas. The app's
own vocabulary for what the user's school itself calls a "program" (one
Canvas Course per program of study). Everything user-facing — the picker,
navigation, routes — says "Program."
_Avoid_: Course (reserve for the raw Canvas API resource, in API-layer code
only)

**Course**:
Canvas's own API resource: the thing `GET /api/v1/courses` returns. Every
Program wraps exactly one Course. Use this term only when talking about the
Canvas API itself, not the app's UI or domain logic.
_Avoid_: Program (in API-layer code, to keep the two vocabularies visually
distinct)

**Module**:
Canvas's native unit of organization for a Course's content (readings,
pages, files, links) — what the user's school uses for lesson materials.
Better Canvas borrows this term as-is; no local reinterpretation.

**Assignment**:
Canvas's native gradable/submittable item belonging to a Course, carrying a
due date. Better Canvas reads these (never submits or grades) to power the
upcoming-assignments view.

**Personal Access Token**:
A long-lived credential Canvas issues to a user for direct API
authentication, generated manually in Canvas's own settings and pasted into
Better Canvas on first connect. Stored client-side only; Better Canvas never
sees the user's Canvas password.

**Active Program** / **Archived Program**:
A per-Program state that exists only in Better Canvas, not in Canvas
itself. Active Programs appear in main navigation; Archived Programs move
under Previous Lectures. Set manually by the user (e.g. when a term ends),
not inferred from Canvas data.

**Previous Lectures**:
The route/view listing Archived Programs, kept reachable but out of the way
of day-to-day navigation.

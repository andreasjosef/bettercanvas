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

**Lesson**:
The app-facing name for an individual content page inside a Module — what
the user actually reads. Wraps a Canvas Page (the module item type `Page`).
Deliberately not "Page" (reserved for the raw Canvas API resource, below)
and deliberately not "Lecture" (already means an Archived Program — see
Previous Lectures).
_Avoid_: Page (reserve for the raw Canvas API resource, in API-layer code
only), Lecture

**Page**:
Canvas's own API resource for a content page's body (`GET
/api/v1/courses/:id/pages/:page_url`). Every Lesson wraps one Page. Use this
term only when talking about the Canvas API itself, not the app's UI or
domain logic.
_Avoid_: Lesson (in API-layer code, to keep the two vocabularies visually
distinct)

**Done**:
A per-item completion state on Modules, Lessons, and Assignments, set by
the user in Better Canvas — never read from or written to Canvas itself.
Marking a Module Done marks every one of its Lessons and Assignments Done;
a Module also becomes Done automatically once all of its own Lessons and
Assignments are individually Done. A Done item disappears from its normal
place in Program navigation and surfaces instead in Finished, where it can
be un-marked. Fully independent of Active/Archived Program state — marking
everything in a Program Done does not archive the Program, and archiving a
Program does not mark its content Done.
_Avoid_: Archived (reserved for Archived Program, below), Complete,
Finished (that names the view, not the state)

**Finished**:
A per-Program view listing that Program's Done Modules, Lessons, and
Assignments, where they can be un-marked back to not-Done. Operates at the
content level within a single Program — not to be confused with Previous
Lectures, which operates at the whole-Program level across all Programs.

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
of day-to-day navigation. Operates at the whole-Program level — not to be
confused with Finished, which lists Done content within a single Program.

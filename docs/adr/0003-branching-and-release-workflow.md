# Two-branch dev/main workflow with semver release tags and CI merge gates

Better Canvas uses two protected long-lived branches: `dev` as the
integration/preview branch that short-lived feature branches PR into, and
`main` as the protected prod branch that `dev` periodically PRs into to
release. Both branches require a PR (0 required approvals — solo dev),
conversation resolution, and the same CI gate before merge: `lint` (a new
ESLint config, with existing violations fixed rather than deferred),
`typecheck` (`vue-tsc -b`), and `test` (`vitest run`); `main` adds nothing
extra on top of `dev`'s checks. Include-administrators is on for both (no
bypass, not even for the repo owner), force-push and branch deletion are
disabled, branches must be up to date before merging, and CI runs on
`pull_request` into `dev`/`main` only, not on feature-branch pushes.
Linear history and signed commits aren't required. This topology and gate
set were settled together rather than derived from a single principle:
the two-branch split gives a stable preview environment distinct from
prod without the overhead a full gitflow (release branches, develop vs.
main vs. hotfix lanes) would add for a single-user app, and the identical
gate on both branches means there's no separate, weaker bar for reaching
prod.

Hotfixes to prod branch off `main`'s tip (which always equals prod), go
through the same CI gate and PR process as any other change (no bypass),
and are reconciled back into `dev` by merging `main` into `dev` right
after the hotfix ships — a real merge, not a cherry-pick or rebase, with
any conflicts resolved manually. Merging (not cherry-picking) keeps
`main`'s and `dev`'s histories from diverging in ways that would make a
later `dev`→`main` release replay the hotfix commit under a different
hash.

There is deliberately no long-lived major-version-support branch scheme.
Better Canvas is a solo-dev, single-user, single-Vercel-deploy app with no
separate install base to leave on an old major version, so there's no
branch-naming/cut convention, no fix-flow-into-an-old-major process, no
per-major Vercel environment, and no retirement policy. A major-version
bump is just the next release riding `main` forward like any other; if a
future major risks disrupting in-progress personal use mid-semester, the
mitigation is holding that work on `dev` or a feature branch until ready,
not a parallel-support branch. This is explicitly a "not needed for this
app's shape" decision, not an oversight — it would need revisiting if a
backend or external API consumer is ever added, since today's major-
version bumps have no formal trigger (a pure judgment call, since there's
no external contract to break).

Releases are tagged with `v`-prefixed semver git tags on every merge into
`main` — ordinary `dev`→`main` releases and hotfixes alike get a bump and
tag, no exceptions. The bump level is content-based: patch for
fixes-only releases (hotfixes qualify automatically), minor for any
release that includes new features, and major as a judgment-call
milestone marker with no formal trigger. Tagging and the `package.json`
version bump are done manually (`npm version` plus pushing the tag) as
part of the release PR's diff, not CI-automated — there's no CI/CD
pipeline beyond the lint/typecheck/test merge gate, and deploys already
run through Vercel independently of tagging. `CHANGELOG.md` follows Keep
a Changelog format, drafted by an agent from commit/PR history since the
last tag and reviewed before merging. There's no in-app version display.
The first tag is `v0.1.0`, since `main` isn't yet ready or used for real;
the changelog starts fresh there with no backfill of pre-tag history.

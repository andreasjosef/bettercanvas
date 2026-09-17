# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See `docs/adr/0003-branching-and-release-workflow.md` for how releases,
tags, and this changelog fit into the branch/PR/CI flow.

## [Unreleased]

## [0.1.0] - 2026-09-17

### Added

- Vite + Vue 3 + TypeScript app scaffold, router, Tailwind-on-tokens
  styling, and a Vitest test harness (#8).
- A Vercel serverless proxy for Canvas API requests, working around
  Canvas's missing CORS headers (#9).
- Connect screen: verify a Canvas Personal Access Token via the proxy
  and persist the session (#10).
- Program picker: choose Canvas courses to track as Programs (#11).
- Reconnect flow for an expired Canvas token (#12).
- Home view: Active Programs with a next-due summary (#13).
- Program Modules view: module listing with per-item-type routing (#14).
- Reading view: sanitized rendering of Canvas Page and Assignment
  content (#15), with syntax highlighting and per-block language
  override for code (#16).
- Assignments view: assignments grouped by due date (#17).
- Settings / Manage Programs: reuse the picker with an archive toggle
  (#18).
- Previous Lectures view: list of archived Programs (#19).
- Persistent app shell with sidebar navigation across all screens
  (#33), later extended to a per-Program sidebar (#47).
- Program-name hero heading with a Modules/Assignments tab bar (#34).
- TanStack Query for Canvas data fetching (#45).
- A local Done-state data model (#46), with the ability to mark
  Lessons, Assignments, and Modules Done (#48) and a Finished view to
  review and unmark them (#49).
- An ESLint flat config with a clean baseline (#65) and a CI workflow
  running lint/typecheck/test as a required gate on PRs into `dev`
  and `main` (#66, #67).

### Changed

- Home and Previous Lectures rows switched from cards to plain list
  rows (#35).
- The Program sidebar reuses the app shell's aside instead of a
  separate component (#55).

### Fixed

- SPA route fallback and dev/deploy routing gaps found during
  end-to-end Vercel deploy verification (#38, #39).

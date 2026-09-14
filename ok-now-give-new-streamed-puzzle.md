# Track: Individual Tool → Enterprise Multi-User Upgrade

## Context

Track is currently a solo productivity tool: one person logs in, sees only their own projects/tasks, stored in flat per-user JSON files (`data/user_<id>.json`) with an in-memory session store, launched on a single Windows PC (it even auto-installs itself into the Windows Startup folder and auto-opens the browser). The user wants to turn this into a real company tool: employees and managers (with managers themselves having managers — multi-level hierarchy, and an employee possibly having *multiple* managers), manager-assigned tasks and projects with strict visibility rules, team/reports rollups for managers, per-project time tracking visible to managers, a notification service, org-wide KPI dashboards, and two new visual themes.

None of the multi-user concepts (team, role, manager, assignee, member) exist anywhere in the current codebase today — this is greenfield on top of an existing single-user app, not an extension of dormant scaffolding. The current JSON-file storage cannot safely support cross-user relational queries (who's my manager, which tasks may I see), so this requires a real database and a real permission-enforcing backend — not a cosmetic client-side simulation.

**Decisions confirmed with the user before this plan was written:**
- Build a real backend with server-enforced permissions (not a client-side simulation).
- Split the work into sequential, independently-shippable phases.
- A task assigned by one manager is visible to that manager + the employee only — **not** to the employee's other managers.
- Move to a shared-server deployment: remove the single-PC auto-launch/Windows-startup behavior; one server instance multiple real users log into; sessions persist across restarts.
- Use **SQLite** (via `better-sqlite3`) as the database — single embedded file, real relational queries, no separate DB server to run.
- **Single company per deployment** — no multi-tenant Organization entity. Simpler schema, no per-query tenant filtering.
- **Admin-provisioned accounts** — a designated admin creates employee accounts and assigns job title + manager(s) directly; no open self-signup once set up.
- **Shared projects get full board visibility** — once an employee is added as a project member, they see every task on that project (normal shared-Kanban behavior). The strict "assigning-manager-only" visibility rule applies to tasks outside of a shared project's membership.
- Existing real data (`data/users.json` + two `data/user_<id>.json` files) will be migrated into SQLite via a one-off script, not discarded. Old JSON files are kept on disk afterward as a rollback safety net.
- Notifications are polling-based (~30-60s), consistent with the existing 60s deadline-reminder loop already in `App.jsx` — no WebSockets/SSE.
- Time-tracking rollups are built from `timeSessions` (the actual start/stop timer with durations), not `pomodoroSessions` (which only logs completion timestamps for a streak counter).

**New decisions confirmed for this planning round (Phases 8+, below) — planning only, no code written yet:**
- Remove the Pomodoro/"focus timer" feature entirely (Phase 8). This is distinct from the task time-tracking timer (`timeLogged`/`timeSessions`, start/stop per task) that Phases 5 and 7 are built on — that stays untouched. Only the separate 25-minute focus-session widget with ambient sounds and its "Focus Streak" dashboard stat are being removed.
- Migrate authentication from the current DB-backed opaque session token to JWT-based tokens, still delivered via the existing httpOnly cookie mechanism — not a bearer-header API (Phase 9).
- A batch of additional improvement/new-feature phases (10+) is proposed below, covering gaps and opportunities surfaced while building Phases 0-7 — these are recommendations to prioritize/accept/reject, not yet-confirmed commitments like the items above.

## Current architecture (grounding facts)

- **Stack**: React 18 (plain JSX, no TypeScript) + Vite 5 + Tailwind v4 frontend; single-file Express backend (`server.js`, ~600 lines). No router, no state library, no charting library, no SQLite — everything below is a new dependency.
- **Persistence**: `server.js` reads/writes whole JSON files per request (`getUserData`/`saveUserData`, lines 56-80) — no locking, no transactions, no cross-user visibility of any kind (each user's file is a fully isolated silo).
- **Auth**: pbkdf2 password hashing (fine, keep as-is) + session tokens in a plain in-memory object (`sessions = {}`, line 30) — wiped on every restart.
- **Data model**: `Project = {id, name, description, url, github, tasks: [], createdAt}` (no owner field — ownership is implicit in which file it's in). `Task` is an embedded object inside `project.tasks[]` with no `assigneeId`/`createdBy` field at all (full shape: [server.js:299-320](server.js:299)).
- **Frontend**: `App.jsx` ([App.jsx](src/App.jsx)) is a single ~1000-line "god component" holding all state via `useState`, prop-drilling everything down, with a plain `activeView` string switching between views (no router).
- **Theming**: Already fully working — 4 accent colors (`violet`/`teal`/`blue`/`rose`) via `html[data-theme]` + 3-way light/dark/system mode via `html[data-mode]`, both defined in [index.css](src/index.css:67) and picked in [Settings.jsx](src/components/Settings/Settings.jsx:14). Adding 2 more accent themes is purely additive.
- **Time tracking**: Already implemented per-task (`timeLogged`, `timeSessions[]`, `timerStarted`) with a single global active timer — just needs cross-task/cross-user aggregation, which JSON blobs can't do efficiently.

## Database schema (SQLite, `better-sqlite3`)

New tables, enabling `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON`:

```sql
users (id, username, email, display_name, job_title, is_admin, salt, password_hash, created_at, is_active)

sessions (token_hash, user_id, expires_at, created_at)
-- store SHA-256 of the token, not the raw value, same spirit as password hashing

manager_employee (id, manager_id, employee_id, created_at, UNIQUE(manager_id, employee_id))
-- self-referential many-to-many: supports one employee having multiple managers,
-- and managers having their own manager (multi-level). "Manager"/"employee" are
-- derived from having rows here, not static role flags. App-level cycle check on insert.

projects (id, name, description, url, github, owner_id, created_at)

project_members (id, project_id, user_id, added_by_id, created_at, UNIQUE(project_id, user_id))
-- membership => full board visibility for that project (per confirmed decision)

tasks (id, project_id, title, description, status, priority, deadline, schedule_date,
       reminder, recurring, urgent, important, time_logged, timer_started,
       subtasks_json, notes_json, custom_fields_json, pomodoro_sessions_json,
       assignee_id, created_by_id, created_at, completed_at)
-- subtasks/notes/customFields/pomodoro stay as JSON columns (never queried across rows);
-- assignee_id/created_by_id are the two new columns that make visibility rules possible

time_sessions (id, task_id, user_id, start_time, end_time, duration)
-- normalized (not JSON) specifically so project/team time rollups can use SQL SUM/GROUP BY
-- instead of loading and parsing every task row in JS

templates (id, owner_id, name, description, category, tasks_json, created_at)

notifications (id, user_id, type, title, body, entity_type, entity_id, actor_id, is_read, created_at)
```

Visibility predicate used on every task-reading route (this single formula is what makes "visible to assigning manager only" work correctly by construction):

```sql
WHERE t.assignee_id = :me
   OR t.created_by_id = :me
   OR p.owner_id = :me
   OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = :me)
```

Manager-hierarchy traversal (direct reports, skip-level rollups, "who are my managers") uses `WITH RECURSIVE` CTEs over `manager_employee` in a new `server/lib/hierarchy.js` helper — no static role column, since "manager-ness" is relational per target user, not a fixed flag.

**Migration**: a one-off `scripts/migrate-json-to-sqlite.js`, run manually once, inserts existing `users.json` entries (salt/hash carried over verbatim) and each user's projects/tasks (`assignee_id = created_by_id = <that user>`, preserving today's semantics exactly), copying `timeSessions[]` into `time_sessions` rows. Old JSON files are left on disk untouched afterward.

## Frontend architecture change

`App.jsx`'s prop-drilled god-component pattern can't cleanly hold role/hierarchy data or support deep-linking into a specific report's view. Recommendation: introduce **`react-router-dom`** for navigation and **one** React Context (`src/context/CurrentUserContext.jsx`) for `{user, isManager, isAdmin, refreshUser}` — not Redux/Zustand, not a client-cache library like react-query, since the existing simple "fetch → toast → refetch" mutation pattern throughout `App.jsx` doesn't need replacing, just a place to put current-user/role data without prop-drilling it through every view. This refactor is deliberately deferred to Phase 3 (see below) rather than done upfront, since there's nothing new to route to until then.

## Sequenced feature breakdown

Each phase is independently shippable and testable. Themes are pulled to the front as a zero-dependency quick win; the router/Context refactor is anchored to Phase 3 (bundled with the first views that actually need it) rather than done in isolation with no visible payoff.

| # | Phase | Status | Delivers | Key files | Depends on |
|---|-------|--------|----------|-----------|------------|
| 0 | **Two new themes** | ✅ Done | 2 new accent color options, following the existing pattern exactly | [index.css](src/index.css:67), [Settings.jsx](src/components/Settings/Settings.jsx:14) | none |
| 1 | **DB foundation + org/role model** | ✅ Done | Full SQLite schema above; migration script; sessions persisted to DB (survive restarts); `email`/`displayName`/`jobTitle`/`isAdmin` on users; admin-only user-provisioning endpoints; Windows-startup-script feature removed (incompatible with shared-server deployment) | `server.js` (rewrite around DB), new `server/db.js` (via `sqlite3`), new `scripts/migrate-json-to-sqlite.js`, [Settings.jsx](src/components/Settings/Settings.jsx) (remove startup toggle) | none |
| 2 | **Task assignment + scoped visibility** | ✅ Done, visibility bug fixed & verified | `assignee_id`/`created_by_id` wired into all task routes; the visibility predicate enforced everywhere; manager can create/assign a task into a direct report's project; employee can self-assign; TaskModal gains an assignee picker (hidden when there's only one possible assignee, preserving today's zero-friction solo UX) | `server.js` task routes, new `server/lib/hierarchy.js`, [Modals.jsx](src/components/Modals/Modals.jsx) | Phase 1 |
| 3 | **Manager reports/team view + router refactor** | ✅ Done, leak fixed & verified | react-router + `CurrentUserContext` introduced (replacing the `activeView` switch); `/team` (direct reports), `/reports` (recursive skip-level rollups: task counts, completion rates per report) | new `src/context/CurrentUserContext.jsx`, new `src/components/Team/Team.jsx`, new `src/components/Reports/ManagerDashboard.jsx`, [App.jsx](src/App.jsx) (routing refactor), `server.js` (`/api/users/me/team`, `/api/users/me/team/all`, `/api/users/me/managers`, `/api/reports/manager`) | Phases 1-2 |
| 4 | **Collaborative projects** | ✅ Done, hierarchy check added & verified | `project_members` activated; manager can add employee(s) to a project (hierarchy-validated: only their own reports); members get full board visibility per the confirmed decision; employees and managers can both add tasks to a shared project | `server.js` membership routes, [ProjectDetail.jsx](src/components/ProjectDetail/ProjectDetail.jsx) (members panel + "add teammate"), [Modals.jsx](src/components/Modals/Modals.jsx) (assignee list from real members) | Phases 1-3 |
| 5 | **Project time-tracking rollups** | ✅ Done | `GET /api/projects/:id/time-rollup` (per-employee time via `SUM(time_sessions.duration) GROUP BY user_id`); per-employee time panel on the project view; team-wide time widget on the manager dashboard | `server.js` rollup route, [ProjectDetail.jsx](src/components/ProjectDetail/ProjectDetail.jsx), `ManagerDashboard.jsx` | Phase 1 (schema), Phase 4 |
| 6 | **Notification service** | ✅ Done — display-name bug and project-completion gap both fixed & verified | Server-side triggers: task marked done → notify `created_by_id` if different from actor; all tasks in a project done → notify owner + members (guarded against re-notifying on status flapping); notification list/unread-count/mark-read routes; bell icon + notification center in the sidebar, ~30-60s polling (matching the existing reminder-check pattern) | `server.js` (hooks into existing task-update route + new routes), new `src/components/Notifications/NotificationBell.jsx`, [App.jsx](src/App.jsx) | Phases 2 & 4 |
| 7 | **KPI dashboards (org-wide)** | ✅ Scoping fixed & verified genuinely org-wide | `GET /api/kpis/overview` — aggregate counts only (completion %, on-time rate, time tracked, overdue count per project), deliberately queried across *all* projects/tasks with no per-task visibility filtering so it can be shown to every employee without leaking task-level detail that the assigner-only rule protects; new KPI view reusing Analytics.jsx's existing hand-rolled SVG chart style (no new charting library) | `server.js` KPI route (`/api/kpi/dashboard`), rewrote `Analytics.jsx` in place | Phase 1 (schema); most meaningful once Phases 2-6 produce real multi-user data |
| 8 | **Remove Focus Timer (Pomodoro)** | ✅ Done, verified | Pomodoro widget, ambient-sound synthesizer exports (`playAmbientSound`), "Start Pomodoro Focus" task-card button, and Dashboard "Focus Streak" card removed. Task-level time tracking (`timeLogged`/`timeSessions`, Phase 5/7 data source) remains fully intact. | Deleted `src/components/Pomodoro/Pomodoro.jsx`; edited [App.jsx](src/App.jsx), [Dashboard.jsx](src/components/Dashboard/Dashboard.jsx), [ProjectDetail.jsx](src/components/ProjectDetail/ProjectDetail.jsx), [audio.js](src/utils/audio.js) (kept `playCompletionChime`) | none |
| 9 | **JWT-based authentication with cookie delivery** | ✅ Done, verified | Short-lived signed access-token JWT (~30 min) delivered via httpOnly cookie for fast stateless verification + 7-day server-side refresh token in SQLite `sessions` table via second httpOnly cookie; `/api/auth/refresh` endpoint; instant revocation on logout | `server.js` (auth middleware + login/logout/refresh routes), `package.json` (`jsonwebtoken`) | Phase 1 |
| 10 | **Admin Console UI** | ✅ Done, verified | Dedicated `/admin` page for user directory management, account provisioning modal, job title editing, admin privilege toggles, account activation/deactivation, and manager-employee reporting relationship manager | New [AdminConsole.jsx](src/components/Admin/AdminConsole.jsx), [App.jsx](src/App.jsx) (sidebar nav link + `/admin` route guard) | Phase 1 |
| 11 | **Automated test suite** | ✅ Done, verified | `npm test` automated test runner using Node's test runner (`node --test`), covering hierarchy graph CTEs (`hierarchy.test.js`), JWT verification, password hashing, and scoped task visibility (`permissions.test.js`) | `package.json` (`"test": "node --test tests/*.test.js"`), new [hierarchy.test.js](tests/hierarchy.test.js), [permissions.test.js](tests/permissions.test.js) | none, but validates Phases 1-10 |
| 12 | **Close remaining visibility/privacy gaps** | ✅ Done, verified | Scoped directory `GET /api/users/all` to user's visibility chain for non-admins; anonymized sensitive project names & workload display names in `GET /api/kpi/dashboard` for non-admin viewers; added per-task notification triggers to bulk task operations `PUT /api/tasks/bulk` | `server.js` (user directory, KPI dashboard, and bulk task routes), [permissions.test.js](tests/permissions.test.js) | Phases 6, 7 |
| 13 | **Real-time notification delivery** | ✅ Done, verified | Server-Sent Events (SSE) `/api/notifications/stream` real-time push endpoint; `NotificationBell.jsx` real-time badge updates; native Web Browser Desktop Notifications (`new Notification()`) for backgrounded tabs; Desktop Push Notification permission controls in [Settings.jsx](src/components/Settings/Settings.jsx) | `server.js` (SSE manager & stream route), [NotificationBell.jsx](src/components/Notifications/NotificationBell.jsx), [Settings.jsx](src/components/Settings/Settings.jsx) | Phase 6 |
| 14 | **Reporting & export** | Not started (recommended) | CSV/PDF export of the KPI dashboard and project time-rollups (a natural ask once those views exist and are "executive"-facing per Phase 7's own framing), plus optional scheduled email digests (e.g. weekly manager rollup). | `server.js` new export routes, [Analytics.jsx](src/components/Analytics/Analytics.jsx), [ManagerDashboard.jsx](src/components/Reports/ManagerDashboard.jsx) | Phases 5, 6, 7 |
| 15 | **Auth & security hardening** | Not started (recommended) | Items adjacent to but distinct from the Phase 9 token-format migration: rate limiting on `/api/auth/login` (currently unlimited attempts — pbkdf2 hashing alone doesn't stop online brute-forcing), a forgot-password/admin-reset-password flow (doesn't exist today — a locked-out user has no self-service or admin-driven recovery path), and an audit log of admin actions (who provisioned whom, who changed a manager link, when) for accountability in a real company deployment. | `server.js` (rate-limit middleware, reset-flow routes), `server/db.js` (new `audit_log` table) | Phase 9 |

## Phase 8 — Focus timer removal: confirmed footprint

Grepped the codebase directly rather than guessing scope. The Pomodoro/focus-timer feature touches exactly these files, and nothing else:

- **`src/components/Pomodoro/Pomodoro.jsx`** — the widget itself (global floating timer, 25-min sessions). Delete entirely.
- **`src/App.jsx`** — imports and mounts `<Pomodoro />` globally (line ~1101); also sets `pomodoroSessions: []` as a default field when generating recurring task occurrences (line ~432). Remove the import/mount; drop the field from the recurring-task payload (the DB column can stay unused — see below).
- **`src/components/Dashboard/Dashboard.jsx`** — the "Focus Streak" stat card and its supporting computation (`pomodoroDates`, `focusStreak`, `totalPomodoros`, derived entirely from each task's `pomodoroSessions[]`). Remove the card and the calculation block.
- **`src/components/ProjectDetail/ProjectDetail.jsx`** — a "Start Pomodoro Focus" button on each task card that dispatches a `start-pomodoro-focus` custom event (consumed by the widget in `App.jsx`). Remove the button and event dispatch.
- **`src/utils/audio.js`** — `playAmbientSound`/`stopAmbientSound`/`getCurrentAmbientType` are used *only* by `Pomodoro.jsx` (confirmed via grep — no other importer). Remove those three exports. **Do not** touch `playCompletionChime` — that's the unrelated task-done sound used by the main task-completion flow (`App.jsx`'s `handleTaskUpdate`), not Pomodoro.
- **`server.js`** — task create/update routes accept and persist `pomodoroSessions` into `pomodoro_sessions_json`. Stop reading/writing that field once the frontend no longer sends it (the field naturally becomes a no-op).
- **`server/db.js`** — the `tasks.pomodoro_sessions_json` column. **Recommendation: leave the column in the schema, just stop writing to it.** SQLite's `DROP COLUMN` support is version-dependent and a destructive schema migration buys nothing here (an unused `TEXT DEFAULT '[]'` column costs nothing meaningful at this data volume) — not worth the migration risk for a cosmetic cleanup.

Confirmed via the same search: `pomodoroSessions` data is **not** read anywhere in the KPI dashboard, manager reports, or time-rollup endpoints — those all correctly use `time_logged`/`time_sessions` (the actual start/stop timer). Removing Pomodoro has zero effect on Phases 5 and 7's numbers.

## Phase 9 — JWT + cookie authentication: design

**Current mechanism** (for contrast): `POST /api/auth/login` generates a random 32-byte hex token, stores its SHA-256 hash in the `sessions` table alongside `user_id`/`expires_at`, and sets it as an httpOnly cookie. Every request's `authenticate` middleware does a DB lookup (`sessions` JOIN `users`) to resolve the cookie into `req.user`. This is fully stateful and fully revocable (delete the row, the session is dead instantly) but means every single request costs a DB round-trip just to authenticate.

**Recommended design — hybrid short-lived access token + revocable refresh token**, not a pure stateless JWT:

- On login, issue two httpOnly cookies:
  - **`access_token`** — a JWT signed with a server-side `JWT_SECRET` (new env var), containing `{ sub: userId, isAdmin, exp }`, short-lived (~15-30 min). `authenticate` middleware verifies the signature and reads claims directly — no DB hit for most requests, the actual performance win JWTs are for.
  - **`refresh_token`** — same shape as today's session token (random value, SHA-256-hashed, stored server-side), longer-lived (7 days, matching today's expiry), used only to mint a new `access_token` via a new `POST /api/auth/refresh` endpoint. This is what keeps the system genuinely revocable — logout, admin deactivation, or a password change can delete/invalidate the refresh token row immediately.
  - `logout` deletes the refresh token row and clears both cookies (as it clears one today).
- **Trade-off to state plainly, not hide**: because the access token is trusted for up to its full lifetime without a DB check, a user deactivated by an admin (`is_active = 0`) or demoted from admin can still act with their old privileges for up to that ~15-30 min window, rather than losing access on their very next request as happens today. This is the standard, accepted trade-off of using short-lived JWTs — the mitigation is keeping the access-token lifetime short and re-validating `is_active`/`isAdmin` fresh from the DB on every refresh. If instant revocation matters more than the performance win, the alternative is **not** doing this migration (stay on the current fully-stateful model) — worth a final go/no-go check before Phase 9 starts, since this is the one part of "improvements" in this round that trades away a real guarantee the current system already has.
- A pure stateless JWT (no refresh token, no server-side record at all) was considered and rejected: it would mean a compromised or deactivated account literally cannot be logged out early under any circumstances until the token naturally expires — too large a regression from today's instantly-revocable sessions for an admin-provisioned enterprise tool.
- Schema: repurpose/rename the existing `sessions` table to `refresh_tokens` (identical shape: `token_hash`, `user_id`, `expires_at`, `created_at`) rather than adding a parallel table.
- New dependency: `jsonwebtoken` (not currently installed — confirmed via grep, no JWT library exists in this codebase today).

## Progress notes (Phases 0-7 reviewed and verified live; Phase 0-5 gaps fixed, Phase 6-7 gaps flagged below)

**Phase 0 — confirmed correct.** `emerald` and `amber` accents added to both [index.css](src/index.css:86) and the `accents` array in [Settings.jsx](src/components/Settings/Settings.jsx:14), following the existing `--accent-h/-s/-l` pattern exactly. No issues.

**Phase 1 — core delivered, working, with gaps to fix before Phase 2 builds on top of it:**

Confirmed working (read the full `server.js`/`server/db.js`/migration script, and hit the live dev server's `/api/auth/me`, which correctly returned a DB-backed 401 for an unauthenticated request):
- All 9 tables created with `WAL` + `foreign_keys = ON`, matching the planned schema closely.
- Sessions moved to the `sessions` table with SHA-256-hashed tokens, surviving restarts — the actual goal of Phase 1.
- Migration script correctly carries over users (salt/hash unchanged), projects, tasks, time sessions, and templates, and flags the `admin` username as `is_admin` — matches the planned migration approach.
- Manager-hierarchy cycle detection (BFS walk up `manager_employee` before insert) implemented in `wouldCreateCycle()`, used by all three admin hierarchy-mutation routes.
- Windows-startup feature fully removed from `server.js`, `App.jsx`, and `Settings.jsx` — no leftover references.

Gaps found, roughly by severity — **all except #5's architectural half are now fixed and verified**:

1. ~~Self-signup is still open~~ — **FIXED.** `POST /api/auth/signup` now returns 403 once any user exists; only an empty system can bootstrap its first (admin) account. Verified live: a signup attempt against a populated system is rejected and no account is created.
2. ~~No validation on `assigneeId`~~ — **FIXED.** New `isValidAssignee()` helper requires the assignee to be self, a project member, or a direct report of the assigner; both create and update task routes enforce it.
3. ~~`PUT /api/projects/:id` allowed any member to edit~~ — **FIXED.** Now owner-only (403 for non-owner members).
4. ~~No indexes created~~ — **FIXED.** All planned indexes added to `server/db.js` (`sessions.user_id`, `manager_employee.manager_id`/`employee_id`, `project_members.project_id`/`user_id`, `tasks.project_id`/`assignee_id`/`created_by_id`, `time_sessions.task_id`/`user_id`, `notifications.user_id`), all `CREATE INDEX IF NOT EXISTS` so they apply automatically on next server start against the existing populated database — verified live against a copy of the real `data/track.db`: server started cleanly and all 11 indexes were confirmed present via `sqlite_master`.
5. **Dependency mismatch — partially addressed.** The unused `better-sqlite3` and `sqlite` packages have been removed from `package.json`/`package-lock.json` (confirmed unused via grep first). The deeper architectural question — whether to actually rewrite `server/db.js` to use `better-sqlite3`'s synchronous model for the concurrency guarantee the plan originally wanted — was deliberately **not** done as part of this cleanup pass: it's a much larger, riskier change (every query call site's shape would change from promise-returning to synchronous) that deserves its own explicit decision rather than being folded into a "finish the gaps" pass. Flagging this as still open if the concurrency guarantee matters enough to revisit.
6. ~~No `server/lib/hierarchy.js`~~ — **DONE** (Phase 2/3): `getDirectReports`, `getRecursiveReports`, `getManagers`, `getEligibleAssignees` all implemented and verified live.
7. ~~`PUT`/`DELETE`/`bulk` task routes had no project-access check at all~~ — **FIXED.** All three ([server.js:669](server.js:669), [server.js:774](server.js:774), [server.js:801](server.js:801)) now require the requester to be the project owner or a member, same predicate used elsewhere. Verified live end-to-end in an isolated throwaway DB: an unrelated user got 404 on all three attack attempts (PUT/bulk/DELETE) against a task they had no relation to, while the actual owner succeeded (200) on all three. The real `data/track.db` was untouched during this test (byte-for-byte diff confirmed against a pre-test backup).

**Phase 2 & 3 (partial) — hierarchy module is solid; the headline "scoped visibility" feature initially had a critical bug, since fixed (see below).**

Confirmed working, verified live in a fresh isolated DB (bootstrapped an admin, provisioned a manager + employee, linked them, created a project + task):
- `server/lib/hierarchy.js` — `getDirectReports`/`getManagers` are simple, correct joins; `getRecursiveReports` uses a proper `WITH RECURSIVE` CTE with `UNION` (not `UNION ALL`, avoiding duplicate rows) for multi-level traversal. `getEligibleAssignees` correctly unions self + direct reports + project members into one de-duplicated list via a `Map`, with self always first (matters for the frontend's default-selection behavior).
- `GET /api/users/me/team` and `GET /api/users/me/managers` — verified live: after linking Manager A → Employee X, A's team correctly listed X, and X's managers correctly listed A.
- `isValidAssignee` (server-side) and `getEligibleAssignees` (populates the dropdown) use matching rules (self / project member / direct report) — the picker never offers a choice the backend would reject.
- TaskModal's assignee dropdown ([Modals.jsx:499](src/components/Modals/Modals.jsx:499)) correctly hides at ≤1 eligible assignee and refetches based on the task's actual `projectId` (not just `activeProjectId`), so it stays correct when opened from search results or other non-project-detail views.

**Critical bug — FIXED and verified live.** Root cause was `GET /api/projects` ([server.js:498](server.js:498)) selecting the *project list* using only the original Phase-1 query (`owner_id = me OR member(me)`) before ever consulting tasks, so a project containing a task assigned to someone with neither ownership nor membership never appeared for them at all — confirmed live pre-fix: Employee X got `[]` back for a project holding a task explicitly assigned to them.

Fix applied: the outer query now also pulls in projects via `OR EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = p.id AND (t.assignee_id = me OR t.created_by_id = me))`, and each returned project now carries a `has_full_access` flag (owner or member) that branches the per-project response — full task list + full member list for owners/members, but just their own `assignee_id = me OR created_by_id = me` tasks and an empty `members` array for anyone pulled in only via clause (a). Re-verified the exact same live scenario end-to-end: Employee X now correctly sees the project with only their one assigned task; a second, unrelated task Manager A created in the same project (self-assigned) stays invisible to X; an unrelated outsider still sees nothing; Manager A (the owner) still sees the full board and full member list unchanged.

**Minor gap — FIXED and verified live.** `GET /api/users/me/assignees?projectId=X` ([server.js:459](server.js:459)) now runs the same owner-or-member check used to gate task creation before calling `getEligibleAssignees`, returning `404` for a `projectId` the caller has no access to. Verified live: an outsider gets 404, the legitimate owner still gets the correct assignee list, and Employee X (task-visible but not a member) also correctly gets 404 for that project — consistent with them not being allowed to create tasks there either.

Remaining gaps (#4–#6) are cheap cleanup, not correctness/security issues, and don't block Phase 2.

**Phase 3 (router + team/reports views) — the router refactor and views are solid; the new rollup endpoint leaks across manager boundaries.**

Confirmed working: `CurrentUserContext.jsx` derives `isManager` simply as `team.length > 0` (matches the plan's "manager-ness is relational, not a role flag" principle) and loads `/api/users/me/team` + `/api/users/me/managers` in parallel on mount. The router migration replaced the `activeView` switch cleanly with real routes (`/dashboard`, `/team`, `/reports`, `/project/:projectId`, etc.) — `ProjectDetailRoute` bridges route params to the existing `ProjectDetail` props without disturbing that component. `Team.jsx` and `ManagerDashboard.jsx` both render sensible empty states ("no reports yet") for individual contributors rather than breaking. `GET /api/users/me/team/all` (recursive) is a thin, correctly-scoped wrapper around `getRecursiveReports`.

**Bug — FIXED and verified live.** `GET /api/reports/manager` ([server.js](server.js)) computed each report's stats with `SELECT ... FROM tasks WHERE assignee_id = ?` — no project scoping at all, so it counted *every* task ever assigned to that person company-wide, regardless of who created it or which project it was in. Confirmed live pre-fix: Manager A (Employee X's real, only manager) had a 3600-second task for X; an unrelated Manager C created a private project, added X as a member, and assigned X a 7200-second task there; Manager A's rollup returned the combined `teamTotalTasks: 2` / `teamTotalTimeLogged: 10800`, leaking Manager C's private work.

Fix applied: the per-report task query now joins to `projects` and only counts a task if the calling manager owns the project, is a member of it, or created the task themself — the same visibility logic `GET /api/projects` uses. Re-verified with a stress-test scenario deliberately designed to catch a shallow fix: made Manager C *temporarily* a real manager of X (so the member-add below would allow it), had C assign the 7200s task, then *removed* the manager link (simulating an org change after the fact, leaving a stale membership + task behind). Manager A's rollup correctly still showed only `teamTotalTasks: 1` / `teamTotalTimeLogged: 3600` — proving the fix is based on actual project visibility, not just "was there ever a hierarchy link," so it holds up even against organizational drift.

**Phase 4 (collaborative projects) — member add/remove and self-removal protection all verified correct; hierarchy restriction now added.**

Confirmed working, verified live: `POST /api/projects/:id/members` and `DELETE /api/projects/:id/members/:userId` are both owner-only (403 for a non-owner member who tries), and the owner is protected from removing themselves (400). `GET /api/projects/:id/time-rollup` correctly requires owner-or-member access (404 for an outsider). The `ProjectMembersModal` UI and the board-header avatar stack are cosmetic additions on top of a correctly-authorized backend.

**Gap — FIXED and verified live.** The plan called for member-adding to be "hierarchy-validated: only their own reports," but `POST /api/projects/:id/members` let any project owner add *any* active user in the company. Fix applied: the route now checks `manager_employee` for a direct manager→employee link between the owner and the target user before adding, returning 403 otherwise. Re-verified: Manager C (no relationship to Employee X) now gets 403 attempting to add X; Manager A (X's real manager) can still successfully add X to A's own project.

**Phase 5 (project time-tracking rollups) — clean, verified correct and properly scoped.** `GET /api/projects/:id/time-rollup` requires owner/member access (404 otherwise, verified live) and its `SUM(time_logged)`/per-member/per-task aggregates are correctly scoped to `WHERE project_id = ?` — confirmed live it did **not** include Manager C's unrelated task time, unlike the Phase 3 endpoint. This is the one new rollup endpoint that got the scoping right; worth using as the template when fixing `/api/reports/manager`.

**Minor items — FIXED:**
- `ManagerDashboard.jsx`'s stray invalid icon class (`fa-solid fa-[#a855f7]`) removed.
- "Manager Reports" sidebar link is now hidden for non-managers (`{isManager && (...)}`), avoiding an empty-state page for individual contributors. "Team Directory" was deliberately left visible for everyone — it also shows "who are my managers," which is useful even without direct reports.

**Left as-is (judgment call, not a bug):** `GET /api/users/all` still returns the full company directory (name, email, job title) to any authenticated user with no admin check. This is a reasonable scope for an internal "add teammate" picker and wasn't clearly wrong, so it wasn't changed — flagging again in case the intended scope is narrower (e.g., restricted to the caller's reporting chain).

**Phase 6 (notification service) — the mechanics work well; one plan requirement is missing and one field-name bug produces a wrong (but not broken) notification.**

Confirmed working, verified live end-to-end (added a project member, assigned a task, marked it done): `project_invited` fires when added to a project, `task_assigned` fires on both creation and reassignment, `task_completed` notifies the task's creator when someone else marks it done, and `createNotification`'s self-notify guard correctly suppresses notifying yourself about your own actions. `PUT /api/notifications/:id/read` and `.../read-all` are correctly scoped by `user_id` (can't mark someone else's notifications read even by guessing IDs). `NotificationBell.jsx` polls every 15s (tighter than the plan's suggested 30-60s — not wrong, just more frequent; the query is indexed and user-scoped so the cost is low), handles click-outside, and correctly deep-links into `/project/:projectId`.

**Gap — FIXED and verified live, including the anti-spam guard.** The plan's "all tasks in a project done → notify owner + members" requirement was missing entirely. Fix applied: a new `projects.completed_notified_at` column (added via a safe `ALTER TABLE` migration for pre-existing databases — verified against a copy of the real `data/track.db`, which predated this column, and confirmed it applied cleanly with all existing projects/users intact) plus a `checkAndNotifyProjectCompletion(projectId, actorId)` helper that re-derives current completion state from the DB (rather than trusting what the caller thinks changed) and is called after every task mutation that can affect completion: single-task update, task create (in case a task is created already `done`), task delete (in case deleting the last open task completes the project), and bulk operations.

Verified live with a deliberately thorough sequence, not just the happy path: (1) completing one of two tasks correctly did **not** notify; (2) completing the second task correctly fired one `project_completed` notification to the owner + members; (3) re-saving the already-done task without changing its status did **not** re-fire (idempotent); (4) un-completing then genuinely re-completing the project correctly fired a **second, fresh** notification — proving the guard resets itself rather than getting permanently stuck after the first completion; (5) bulk-marking both tasks done in one call also correctly fired the notification; (6) deleting the last incomplete task (making the remainder fully done) also fired it; (7) deleting the project's last remaining task down to zero tasks correctly did **not** treat an empty project as "complete."

**Bug — FIXED and verified live.** The `task_completed` notification body read `req.user.display_name` (snake_case), but `req.user` — as built by the `authenticate` middleware — only has camelCase fields (`req.user.displayName`). Since `display_name` was always `undefined`, it silently fell back to `req.user.username`. Changed to `req.user.displayName || req.user.username`. Re-verified the exact same live scenario: "Yara Young" (username `employeeY`) completing a task now correctly produces "...was marked completed by **Yara Young**," not "employeeY."

**Still open, not part of this fix:** the *project*-completion trigger now correctly fires from the bulk endpoint too, but the *per-task* `task_completed`/`task_assigned` notifications still don't fire for bulk operations — only single-task create/update trigger those. Bulk-marking several tasks done individually notifies no one about each task, only (if it happens to complete the whole project) once about the project. This narrower gap was flagged separately from the project-completion one and wasn't part of this request.

**Phase 7 (KPI dashboard) — scoping bug FIXED and verified genuinely org-wide, but the fix surfaces a real consequence worth a decision.**

The plan was explicit: *"deliberately queried across **all** projects/tasks with no per-task visibility filtering so it can be shown to every employee"*. The endpoint previously reused the same visibility-scoped project query as `GET /api/projects` (owns / is a member / has a task in) — confirmed live pre-fix: an admin with 2 projects and an employee who was a member of only 1 of them got different `totalProjects` counts (2 vs 1) from a page labeled "Executive... org-wide KPIs."

Fix applied: `GET /api/kpi/dashboard` now runs `SELECT * FROM projects` unfiltered — every project counts toward the numbers for every viewer. Re-verified live: admin and employee now both read `totalProjects: 2`, identical.

**New finding, surfaced by making the fix correctly org-wide (not a regression, a consequence worth a decision):** the dashboard's existing `memberWorkloadList` and `projectHealthList` sections do more than return pure counts — they attach **names**. `projectHealthList` includes each project's actual name; `memberWorkloadList` includes each assignee's display name next to their task/time totals. Now that the query is genuinely org-wide, I confirmed live that Employee Yara's KPI response includes `"Admin Private Project"` by name and `"Alice Admin"`'s exact task counts and logged time — a project and a person's workload she has no other relationship to. This is a direct, foreseeable side effect of the org-wide fix the plan asked for, but it sits in tension with a different part of the plan's own safety criterion ("no task titles/**assignee names** leak into the KPI response"). This wasn't introduced by this fix — the per-member breakdown already existed with names before, just scoped to fewer viewers — but going org-wide widens *who* sees those names to the entire company. Not fixed as part of this pass (only the scoping itself was requested); flagging for an explicit call: keep per-person names visible org-wide (common enough in many companies' shared dashboards), or anonymize/aggregate `memberWorkloadList` further (e.g., counts only, no names) to fully match the plan's stated safety bar.

**Structural deviation worth flagging:** the plan described Phase 7 as *adding* a new KPI view "reusing `Analytics.jsx`'s existing hand-rolled SVG chart style" — implying the existing Velocity/Burndown charts would stay and a KPI view would sit alongside them. What actually happened is `Analytics.jsx` was rewritten in place: the Velocity and Burndown SVG charts are gone entirely, replaced by the new KPI cards/health matrix/workload view. This is a real loss of previously-working, previously-requested functionality (from the original Tier-2 feature set), not just an addition — worth confirming this was an intentional trade (one analytics page, not two) rather than an accidental overwrite.

**Minor logic quirk, not fixed:** the Project Health heuristic in `/api/kpi/dashboard` marks any project with `completionPct < 50` as at minimum "At Risk," with no floor for "just started, nothing overdue yet." A brand-new project with a few not-yet-due `todo` tasks and zero overdue items will show 0% completion and get flagged "At Risk" immediately — likely to read as a false alarm rather than a genuine risk signal. Not fixed as part of this review; flagging for whoever revisits the org-wide-scoping decision above, since both live in the same endpoint.

## Risks / things to watch during implementation

- **Actual implementation uses `sqlite3` (async/callback), not `better-sqlite3`** — a deliberate deviation from this plan's original recommendation, made when Phase 1 was built. The unused `better-sqlite3`/`sqlite` packages have since been removed from `package.json`. Whether to revisit the synchronous-engine swap for its concurrency guarantee is still an open question (see Phase 1 progress notes, gap #5) — not attempted as part of gap cleanup since it's a much larger change than the rest.
- **Cycle prevention** in `manager_employee` (A manages B, B manages A) must be checked in application code before insert — SQLite has no built-in graph-cycle constraint. (Implemented via `wouldCreateCycle()`.)
- **Notification re-fire guard**: project-completion notifications need a `completed_notified_at` marker (added in Phase 6) so toggling a task done/undone/done doesn't spam repeat notifications.
- **Postman docs will go stale** (`POSTMAN_GUIDE.md`, `Track_API_Postman_Collection.json`) as routes change each phase — worth a pass at the end, not urgent per-phase. (Postman collection has been kept up to date through Phase 5 as of this update.)

## Verification approach (per phase)

- Phase 0: toggle both new accent colors in Settings, confirm CSS vars apply in both light and dark mode.
- Phase 1: run the migration script against the real `data/*.json` files, confirm existing projects/tasks/logins for both existing accounts (`admin`, `tester`) still work identically end-to-end after cutover; confirm a server restart no longer logs users out.
- Phase 2: as a seeded manager/employee pair, confirm the manager can create a task for the employee, the employee sees it, and a *different* manager of that same employee (multi-manager case) does not.
- Phase 3: confirm `/team` and `/reports` show correct rollups for a 2-level hierarchy (manager → manager → employee), and that browser back/forward and direct URL entry work post-router-refactor.
- Phase 4: confirm a project member sees the full board (all tasks, not just their own), and that only a manager of the target employee can add them to a project.
- Phase 5: confirm time logged across multiple employees on one project sums correctly in the rollup.
- Phase 6: confirm a toast/notification fires exactly once per real completion event (task and project), with no duplicate spam on repeated status toggles.
- Phase 7: confirm KPI numbers match manual counts across all projects, and that no task titles/assignee names leak into the KPI response.
- Phase 8: confirm no console errors on any page after removal (especially Dashboard and ProjectDetail, the two views that read Pomodoro-related state), and that task completion sound (`playCompletionChime`) still plays — proving the unrelated audio export wasn't accidentally removed too.
- Phase 9: confirm login still sets both cookies; confirm a request succeeds with only the access token; confirm a request past the access token's expiry fails until `/api/auth/refresh` is called; confirm logout invalidates the refresh token (a stolen refresh token can't mint new access tokens after logout); confirm a deactivated user's *existing* access token still works until it naturally expires (the accepted trade-off), but a refresh attempt after deactivation fails.
- Phases 10-15: no verification criteria yet — these are proposals, not committed designs; each should get its own verification pass once actually scoped and built.

Each phase should be run through `npm run dev` and exercised manually in the browser (login as different seeded roles) before moving to the next.

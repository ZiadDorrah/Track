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

| # | Phase | Delivers | Key files | Depends on |
|---|-------|----------|-----------|------------|
| 0 | **Two new themes** | 2 new accent color options, following the existing pattern exactly | [index.css](src/index.css:67), [Settings.jsx](src/components/Settings/Settings.jsx:14) | none |
| 1 | **DB foundation + org/role model** | Full SQLite schema above; migration script; sessions persisted to DB (survive restarts); `email`/`displayName`/`jobTitle`/`isAdmin` on users; admin-only user-provisioning endpoints; Windows-startup-script feature removed (incompatible with shared-server deployment) | `server.js` (rewrite around DB), new `server/db.js`, new `scripts/migrate-json-to-sqlite.js`, `package.json` (+`better-sqlite3`), [Settings.jsx](src/components/Settings/Settings.jsx) (remove startup toggle) | none |
| 2 | **Task assignment + scoped visibility** | `assignee_id`/`created_by_id` wired into all task routes; the visibility predicate enforced everywhere; manager can create/assign a task into a direct report's project; employee can self-assign; TaskModal gains an assignee picker (hidden when there's only one possible assignee, preserving today's zero-friction solo UX) | `server.js` task routes, new `server/lib/hierarchy.js`, [Modals.jsx](src/components/Modals/Modals.jsx) | Phase 1 |
| 3 | **Manager reports/team view + router refactor** | react-router + `CurrentUserContext` introduced (replacing the `activeView` switch); `/team` (direct reports), `/reports` (recursive skip-level rollups: task counts, completion rates per report) | new `src/context/CurrentUserContext.jsx`, new `src/components/Team/Team.jsx`, new `src/components/Reports/ManagerDashboard.jsx`, [App.jsx](src/App.jsx) (routing refactor), `server.js` (`/api/users/me/team`, `/api/users/me/team/all`, `/api/users/me/managers`) | Phases 1-2 |
| 4 | **Collaborative projects** | `project_members` activated; manager can add employee(s) to a project (hierarchy-validated: only their own reports); members get full board visibility per the confirmed decision; employees and managers can both add tasks to a shared project | `server.js` membership routes, [ProjectDetail.jsx](src/components/ProjectDetail/ProjectDetail.jsx) (members panel + "add teammate"), [Modals.jsx](src/components/Modals/Modals.jsx) (assignee list from real members) | Phases 1-3 |
| 5 | **Project time-tracking rollups** | `GET /api/projects/:id/time-rollup` (per-employee time via `SUM(time_sessions.duration) GROUP BY user_id`); per-employee time panel on the project view; team-wide time widget on the manager dashboard | `server.js` rollup route, [ProjectDetail.jsx](src/components/ProjectDetail/ProjectDetail.jsx), `ManagerDashboard.jsx` | Phase 1 (schema), Phase 4 |
| 6 | **Notification service** | Server-side triggers: task marked done → notify `created_by_id` if different from actor; all tasks in a project done → notify owner + members (guarded against re-notifying on status flapping); notification list/unread-count/mark-read routes; bell icon + notification center in the sidebar, ~30-60s polling (matching the existing reminder-check pattern) | `server.js` (hooks into existing task-update route + new routes), new `src/components/Notifications/NotificationBell.jsx` + `NotificationCenter.jsx`, [App.jsx](src/App.jsx) | Phases 2 & 4 |
| 7 | **KPI dashboards (org-wide)** | `GET /api/kpis/overview` — aggregate counts only (completion %, on-time rate, time tracked, overdue count per project), deliberately queried across *all* projects/tasks with no per-task visibility filtering so it can be shown to every employee without leaking task-level detail that the assigner-only rule protects; new KPI view reusing Analytics.jsx's existing hand-rolled SVG chart style (no new charting library) | `server.js` KPI route, new `src/components/KPI/KPIDashboard.jsx` | Phase 1 (schema); most meaningful once Phases 2-6 produce real multi-user data |

## Risks / things to watch during implementation

- **`better-sqlite3` is a native module** — verify it installs cleanly on the target Windows/Node setup early in Phase 1 (may need prebuilt binaries or Build Tools) before the rest of the plan depends on it.
- **Cycle prevention** in `manager_employee` (A manages B, B manages A) must be checked in application code before insert — SQLite has no built-in graph-cycle constraint.
- **Notification re-fire guard**: project-completion notifications need a `completed_notified_at` marker (added in Phase 6) so toggling a task done/undone/done doesn't spam repeat notifications.
- **Postman docs will go stale** (`POSTMAN_GUIDE.md`, `Track_API_Postman_Collection.json`) as routes change each phase — worth a pass at the end, not urgent per-phase.

## Verification approach (per phase)

- Phase 0: toggle both new accent colors in Settings, confirm CSS vars apply in both light and dark mode.
- Phase 1: run the migration script against the real `data/*.json` files, confirm existing projects/tasks/logins for both existing accounts (`admin`, `tester`) still work identically end-to-end after cutover; confirm a server restart no longer logs users out.
- Phase 2: as a seeded manager/employee pair, confirm the manager can create a task for the employee, the employee sees it, and a *different* manager of that same employee (multi-manager case) does not.
- Phase 3: confirm `/team` and `/reports` show correct rollups for a 2-level hierarchy (manager → manager → employee), and that browser back/forward and direct URL entry work post-router-refactor.
- Phase 4: confirm a project member sees the full board (all tasks, not just their own), and that only a manager of the target employee can add them to a project.
- Phase 5: confirm time logged across multiple employees on one project sums correctly in the rollup.
- Phase 6: confirm a toast/notification fires exactly once per real completion event (task and project), with no duplicate spam on repeated status toggles.
- Phase 7: confirm KPI numbers match manual counts across all projects, and that no task titles/assignee names leak into the KPI response.

Each phase should be run through `npm run dev` and exercised manually in the browser (login as different seeded roles) before moving to the next.

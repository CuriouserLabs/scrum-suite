# Scrum Suite - Claude Development Guide

## Language & Types

The codebase is **TypeScript** (`.ts`/`.tsx`) with `strict` mode enabled.

- Shared domain types live in `src/types/` (`models.ts` for entities, `contracts.ts`
  for hook/context return shapes) — import them via `import type { ... } from '../types'`.
- Run `npm run type-check` (`tsc -b`) to type-check without emitting. The `build`
  scripts run this first, so a type error fails the build.
- Firestore documents have a raw shape (`RoomDoc`/`RetroDoc`, with `participants` as a
  keyed map) and a normalized client shape (`RoomState`/`RetroState`, with `participants`
  as an array) — see `normalizeState` in the hooks.
- Pages rendered only on authenticated routes use `useAuthUser()` (returns a non-null
  `User`); everything else uses `useUser()`.

## Testing in Preview Browser

The preview browser cannot complete Google OAuth sign-in (popup/redirect blocked).
Use the **dev-only email/password sign-in** instead:

1. Run `npm run dev` (Vite dev server — connects to the **dev** Firebase project `scrum-suite-dev`)
2. On the login screen, use the **Dev Sign In** buttons (only visible in development mode)
3. Available test accounts (all use password `testpass123`):
   - **Test Host** — `testhost@scrumsuite.dev` — use for creating/hosting rooms and retros
   - **Test User 1** — `testuser1@scrumsuite.dev` — use as a participant
   - **Test User 2** — `testuser2@scrumsuite.dev` — use as a second participant

These are real Firebase Auth users on the dev project with real UIDs, so Firestore
security rules work normally. The dev sign-in UI and test credentials are stripped
from production builds automatically (`import.meta.env.DEV` gate).

## Environments

| Environment | Firebase Project  | Branch        | Env File          |
|-------------|-------------------|---------------|-------------------|
| Development | `scrum-suite-dev` | `development` | `.env.development`|
| Production  | `vote-9f5e2`      | `main`        | `.env.production` |

- `npm run dev` → development mode → `.env.development` → dev project
- `npm run build` / `build:prod` → production mode → `.env.production` → prod project
- `npm run build:dev` → development mode → `.env.development` → dev project

## Deploy Commands

- `npm run deploy:dev` / `deploy:prod` — build + deploy hosting
- `npm run deploy:rules:dev` / `deploy:rules:prod` — Firestore rules only
- `npm run deploy:indexes:dev` / `deploy:indexes:prod` — Firestore indexes only
- GitHub Actions: `deploy-production.yml` (main) and `deploy-development.yml` (development) — both manual trigger only

## Feature Roadmap & Implementation Order

We're building toward a complete Scrum suite. Existing: Sprint Poker, Retro Board, Auth.
Planned work is tracked as 16 GitHub Issues (#61–#77) across 5 epics. **Implement in the
order below — it follows hard dependencies. If asked to start out of order, point out the
unmet dependency before proceeding.**

1. **Epic A — Teams / Workspaces** (foundation; everything scopes to a team)
   - #61 data model + rules → #62 CRUD UI → #63 invites & roles → #64 scope rooms/retros to team
2. **Epic B — Session History** (read-only archive; reuses existing retro export + carry-forward)
   - #65 archive model (needs #64) → #66 list UI → #67 read-only detail view
3. **Epic C — Sprint Planning & Backlog** (list-based, **no Kanban**)
   - #68 data model + rules (needs #61) → #69 list UI → #70 sprints + assignment → #71 link Poker estimates → points (needs #64)
4. **Epic D — Daily Standup (async)**
   - #72 data model + rules (needs #61) → #73 entry UI → #74 team feed/digest
5. **Epic E — Sprint Analytics**
   - #75 aggregation layer (needs #70 + #65) → #76 burndown chart → #77 velocity & estimate-accuracy charts

**Start here after a break:** the lowest-numbered open issue whose dependencies are all
closed — begin with #61 if nothing is done yet. Within an epic, follow the arrow order.

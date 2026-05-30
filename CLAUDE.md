# Scrum Suite - Claude Development Guide

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

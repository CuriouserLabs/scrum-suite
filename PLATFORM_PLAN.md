# Scrum Suite — Platform & Architecture Plan

> **Status:** Direction agreed, **work deferred** (to be implemented later).
> **Scope:** How the new Backlog, Standup, and Analytics features are built and how they
> integrate with the existing Firebase web app.
> **Decided:** 2026-06-22.
>
> GitHub Issues #68–#77 are **kept as-is for now**; they assume a Firestore-native
> implementation and will be updated/closed later to match this plan. Don't treat their
> current "Firestore rules" wording as binding once this plan is executed.

---

## TL;DR

- The existing **Sprint Poker + Retro app stays exactly as it is**: React/Vite SPA on
  Firebase Hosting, Firestore accessed directly from the browser, Firebase Auth.
- The new epics — **Backlog (Epic C)**, **Standup (Epic D)**, **Analytics (Epic E)** —
  are built as **new backend microservices in Rust**, hosted on **GCP (Cloud Run)**, backed
  by **PostgreSQL** (Cloud SQL).
- There is **one React SPA**, not a second frontend. The existing app is extended to host
  the new feature UIs; it talks to **both** Firestore (poker/retro, teams) **and** the Rust
  APIs (backlog/standup/analytics).
- **Firebase Auth is the single identity provider.** Rust services verify Firebase ID
  tokens; they do not mint their own.
- The two data stores are bridged with **events/webhooks, not live cross-DB joins**.

This **supersedes** the earlier `MIGRATION_PLAN.md` (removed; recoverable from git history),
which proposed routing the *existing* poker/retro app through a Rust gateway. We are **not**
doing that — the existing app stays Firestore-direct.

---

## Decisions (locked)

1. **One SPA.** Extend the existing React app rather than building a separate frontend.
   Avoids duplicating auth bootstrap, routing, session, and the design system. New feature
   areas are routes/modules within the same app.
2. **PostgreSQL, not MongoDB.** The new data is relational and analytics-heavy
   (items ↔ sprints ↔ points, velocity per sprint, estimate-vs-actual time series, burndown
   via `generate_series`/window functions). Postgres fits; Mongo's aggregation would be
   painful here. Standup's lighter shape is handled fine with `jsonb`.
3. **Firebase Auth stays the sole identity provider.** Rust services verify the incoming
   Firebase ID token (validate signature/issuer/audience against Google's JWKS) and extract
   the Firebase UID. No second auth system, no token minting.
4. **Teams remain system-of-record in Firestore** (Epic A). Rust services treat team
   membership as an upstream fact derived from the verified token + a thin membership check.
   Membership is **not** duplicated/owned in Postgres.
5. **Existing poker/retro stay Firestore-native and client-direct.** They are *not* moved
   behind Rust. (This is the key reversal from the old `MIGRATION_PLAN.md`.)
6. **Cross-system integration is event-driven, not join-driven** (see below).
7. **Repo strategy: monorepo, restructured *in place*** (see below) — preserves all existing
   tags/releases/history.

---

## System boundary & ownership

| Concern | System of record | Accessed by |
|---|---|---|
| Identity / Auth | Firebase Auth | SPA (sign-in), Rust (token verify) |
| Teams & membership (Epic A) | Firestore | SPA direct; Rust via token/membership check |
| Poker rooms & Retro boards | Firestore | SPA direct (unchanged) |
| Backlog items & Sprints (Epic C) | **Postgres (Rust API)** | SPA via REST |
| Standup entries (Epic D) | **Postgres (Rust API)** | SPA via REST |
| Analytics series (Epic E) | **Postgres (Rust API)** | SPA via REST |

### Cross-system flows (events, not cross-DB joins)

- **#71 Poker estimate → backlog story points:** when a poker vote finalizes in the
  (Firestore) app, the SPA **POSTs the agreed estimate to the Rust backlog API**, which
  stamps `points` on the linked item. One-directional write; no shared DB.
- **#75 Analytics aggregation:** analytics must **not** live-query Firestore. When a poker
  round or retro session completes, **push that outcome into the Rust service** (an
  `/events` endpoint, or a Firestore → Cloud Function → Rust webhook). Analytics then
  aggregates from a **single Postgres store** (sprints + backlog + ingested
  poker/retro/history events). This also makes Epic B (history) feed Epic E cleanly.

---

## Repository strategy

**Monorepo, by restructuring the *existing* `CuriouserLabs/scrum-suite` repo in place.**

Rationale: at this scale, polyrepo's payoff (independent deploy cadence, team isolation)
doesn't apply, and its cost (coordinating a single logical change across repos) hits exactly
on the cross-cutting features #71 and #75. A monorepo gives shared contract types, atomic
cross-cutting PRs, and per-service deploys via CI path filters.

**Critical: restructure in place — do NOT create a new repo.** GitHub Releases are pinned to
existing commits/tags; moving files in new commits leaves `v1.0.0 / v1.1.0 / v1.2.0` and
their releases, plus all history/issues, fully intact. Creating a fresh repo and copying
files would **lose the GitHub Releases** (they don't transfer on a plain `git push`). So:
`git mv` the current app into `apps/web/`, add the rest alongside.

Target layout:

```
scrum-suite/
  apps/
    web/            ← current Vite/Firebase SPA moves here (git mv, history preserved)
  services/
    backlog-api/    ← Rust (cargo workspace member)
    standup-api/
    analytics-api/
  packages/
    contracts/      ← shared TS types + OpenAPI specs (codegen source of truth)
  infra/            ← GCP / Cloud Run / Cloud SQL (Terraform)
```

- npm/pnpm workspace for the JS side; Cargo workspace for `services/`.
- Per-service CI deploys gated on path filters (changing `apps/web` doesn't redeploy Rust).
- The current Firebase deploy tooling moves with `apps/web` rather than sitting at the root.

Go polyrepo only if distinct teams later own services with independent release trains — not
the case today.

---

## Operational notes / things to keep in mind

- **Cost/ops step-up:** Cloud Run (Rust) + Cloud SQL (Postgres) is real infra/cost/ops vs
  Firestore's serverless model. Accepted deliberately (Rust + future scale), not because
  Firestore couldn't do it.
- **Token verification contract** (Firebase → Rust) is the first integration piece worth
  nailing down: JWKS fetch/cache, validate signature/issuer/audience (= Firebase project
  id), extract `uid`/`email`/`displayName`, expose as a request-scoped auth principal.
- **CORS:** Rust APIs must allow the Firebase Hosting origin. Firebase Hosting `/api/**`
  rewrites to Cloud Run are an option for REST; not needed for WebSockets (none planned for
  these features — they're request/response, not live-collaborative).
- **Issues #68–#77** still say "Firestore rules / hook." Update them when this plan is
  executed: backlog/standup/analytics data + auth move to Postgres + Rust, not Firestore.

---

## Open items to confirm before implementation

- [ ] Exact event-delivery mechanism for #75 (SPA POST vs Firestore→Cloud Function→Rust
      webhook) — decide when building Epic E.
- [ ] Whether team membership check in Rust reads Firestore directly (Admin SDK / REST) or
      relies on a custom claim baked into the Firebase token.
- [ ] Contracts codegen approach (OpenAPI → TS client) for `packages/contracts`.
- [ ] Update GitHub Issues #68–#77 and `CLAUDE.md`'s "Implementation Order" to reflect this
      architecture (currently both assume Firestore-native).

# Migration Plan: Firebase → MongoDB + Rust API Service

> **Audience:** A Claude AI agent executing this migration step by step.
> **Goal:** Replace Firebase (Auth + Firestore + real-time listeners) with a self-hosted
> **Rust API service** backed by **MongoDB**, while keeping the existing React/Vite frontend
> behavior identical (real-time collaborative planning-poker rooms and retrospectives).

---

## Current-State Summary (read before starting)

**Frontend:** React 19 + Vite SPA. The only backend today is Firebase.

**Firebase surface area to replace (5 files):**
| File | Firebase usage |
|------|----------------|
| `src/utils/firebase.js` | Initializes `app`, `db` (Firestore), `auth`, `googleProvider` |
| `src/contexts/UserContext.jsx` | `onAuthStateChanged`, `signInWithPopup` (Google), `signInWithEmailAndPassword` (dev), `signOut` |
| `src/hooks/useRoom.js` | Planning-poker doc CRUD + `onSnapshot` real-time + mutations |
| `src/hooks/useRetro.js` | Retro doc CRUD + `onSnapshot` real-time + mutations + cross-doc queries |
| `src/pages/HomePage.jsx` | `collection`/`query`/`where` + `onSnapshot` for a user's active sessions |

**Data model (two Firestore collections, doc ID = 8-char code):**
- `rooms`: `hostId`, `activeHostId`, `status`, `participants{}`, `participantIds[]`, `votes{}`, `revealed`, `round`, `storyTitle`, `coHosts[]`, `createdAt`.
- `retros`: `hostId`, `activeHostId`, `status`, `participants{}`, `participantIds[]`, `coHosts[]`, `columns[]`, `cards{}`, `previousActionItems{}`, `settings{}`, `timer{}`, `title`, `createdAt`.

**Behavioral contracts that MUST be preserved:**
1. **Real-time:** every connected client sees mutations instantly (today via `onSnapshot`).
2. **Validation/authorization:** the rules in `firestore.rules` (field shapes, size limits, immutable `hostId`/`createdAt`, `status` transitions, host/co-host permissions) must be re-implemented **server-side** in Rust.
3. **Auth identity:** `user.id` must remain a stable per-user ID; Google sign-in (prod) and dev email/password accounts (`testhost@scrumsuite.dev`, etc., password `testpass123`) must both still work.
4. **Queries:** "my active sessions" = docs where `participantIds` contains my id AND `status == 'active'`; "previous retros with action items" reuses the same array-contains query.

**Tech choices (use these unless a blocker arises):** Rust + `axum` (HTTP/WebSocket), `mongodb` official driver, `tokio` runtime, `jsonwebtoken` for JWTs, `argon2` for dev password hashing, MongoDB **Change Streams** for real-time fan-out. Frontend gains a thin API/WS client; React component tree and CSS stay untouched.

---

## Step 1 — Scaffold the Rust API service, MongoDB, and shared data models

**Objective:** Stand up a compiling, runnable Rust service and a MongoDB instance with the data layer defined, before any business logic.

- Create an `api/` workspace (Cargo project) with `axum`, `tokio`, `mongodb`, `serde`, `jsonwebtoken`, `argon2`, `tower-http` (CORS), `tracing`.
- Add `docker-compose.yml` at repo root running **MongoDB** (+ optional Mongo Express) for local dev; mirror the dev/prod split (two databases or two compose targets) to match the existing `scrum-suite-dev` / prod separation.
- Define Rust structs mirroring the `rooms` and `retros` documents (use `#[serde(rename_all = ...)]` to keep JSON field names identical to today's Firestore fields, so the frontend contract is unchanged). Represent `participants`, `votes`, `cards`, `previousActionItems` as `HashMap`s and `participantIds`/`coHosts`/`columns` as `Vec`s — matching the current shapes exactly.
- Add config loading (Mongo URI, JWT secret, Google OAuth client ID, allowed CORS origins) from env, with `.env.development` / `.env.production` equivalents for the API.
- Add a `/health` endpoint and a Mongo connection check. **Deliverable:** `cargo run` boots, connects to Mongo, and `/health` returns 200.

## Step 2 — Implement authentication (replace Firebase Auth)

**Objective:** Issue and verify the app's own auth tokens; support both Google (prod) and dev email/password.

- **Google sign-in:** frontend obtains a Google ID token (via Google Identity Services); add `POST /auth/google` that verifies the Google token (audience = OAuth client ID), upserts a `users` collection record, and returns a first-party **JWT** containing `{ id, displayName, photoURL, email }`. Keep `user.id` stable (use the Google `sub`, or a Mongo `_id` mapped from it).
- **Dev accounts:** seed the three test users (`testhost`, `testuser1`, `testuser2`) with `argon2`-hashed `testpass123`; add `POST /auth/dev-login` (compiled/enabled only for the dev profile, mirroring today's `import.meta.env.DEV` gate). Returns the same JWT shape.
- Add JWT-verification **middleware/extractor** so every protected route resolves `request.auth.uid` equivalent — the identity the old Firestore rules depended on.
- Add `GET /auth/me` (validate token → user) to back the frontend's `onAuthStateChanged` replacement.
- **Deliverable:** can obtain a JWT via dev-login and call a protected stub endpoint.

## Step 3 — Implement room/retro REST endpoints + port the security rules

**Objective:** Re-implement every Firestore mutation from `useRoom`/`useRetro`/`HomePage` as authenticated REST endpoints, with `firestore.rules` validation enforced in Rust.

- **Rooms:** create/get room; `submitVote`, `revealVotes`, `resetRound`, `setStoryTitle`, `makeCoHost`, `handoverTo`, `endSession`; join/rejoin (participant upsert + `participantIds` add); presence (`online` true/false on connect/disconnect).
- **Retros:** create/get; `updateTitle`, `addCard`/`deleteCard`/`editCard`, `toggleVote`, `updateColumns`, `updateSettings`, `revealCards`, `makeCoHost`, `handoverTo`, `startTimer`/`stopTimer`, `addActionItem`/`toggleActionItem`/`deleteActionItem`, `endSession`.
- **Cross-doc queries:** `GET /sessions/active` (array-contains participantId + status==active, for `HomePage`) and `GET /retros/previous` (+ `importActionItems`). Add the matching MongoDB indexes (replacing `firestore.indexes.json`): index on `participantIds` and `status` for both collections.
- **Authorization & validation:** port `firestore.rules` exactly — field-shape/size limits, immutable `hostId`/`createdAt`, valid `status` values/transitions, host-or-co-host gating on host-only actions, vote-value validation, map/array size caps. Use atomic MongoDB updates (`$set`, `$addToSet`, `$pull`, `$unset`) to mirror Firestore's `arrayUnion`/`arrayRemove`/`deleteField`/dotted-path updates.
- **Deliverable:** full CRUD works via `curl`/integration tests; invalid writes are rejected with the same constraints the rules enforced.

## Step 4 — Implement real-time sync (replace `onSnapshot`)

**Objective:** Push live document changes to all connected clients, replacing Firestore listeners.

- Add a **WebSocket** endpoint (e.g. `GET /ws/rooms/:id`, `GET /ws/retros/:id`) authenticated via the JWT. On connect, send the current full document snapshot, then stream updates.
- Drive updates from **MongoDB Change Streams**: a background task watches each collection (filtered by document id) and fans out changed documents to subscribed WebSocket clients via a `tokio` broadcast channel keyed by doc id.
- Tie **presence** to the socket lifecycle: mark participant `online: true` on WS connect and `online: false` on disconnect (replacing the cleanup logic in the hooks' `useEffect` return).
- Normalize the outbound payload to match what the hooks expect (`participants` as a keyed map → the frontend still converts to an array in `normalizeState`).
- **Deliverable:** two browser tabs in the same room/retro see each other's changes live, with correct online/offline presence.

## Step 5 — Refactor the React frontend onto the new API/WS client

**Objective:** Swap Firebase out of the 5 frontend files with zero visible UX change.

- Replace `src/utils/firebase.js` with `src/utils/api.js` (REST fetch wrapper that attaches the JWT) and `src/utils/realtime.js` (WebSocket client with reconnect).
- Rewrite `UserContext.jsx`: store JWT (localStorage), restore session via `GET /auth/me`, implement `login` (Google token → `/auth/google`), `loginWithEmail` (→ `/auth/dev-login`), `logout` (clear token). Keep the exact context shape `{ user, loading, login, loginWithEmail, logout }` so consumers don't change.
- Rewrite `useRoom.js` / `useRetro.js`: keep their **return signatures identical**; back the subscription with the WS client and the mutations with REST calls. Preserve `normalizeState`, `isEnded` guards, and the ended/frozen-session handling.
- Rewrite `HomePage.jsx`'s active-sessions logic to call `GET /sessions/active` (or subscribe via WS) instead of the Firestore query.
- Update env files: replace `VITE_FIREBASE_*` with `VITE_API_BASE_URL` / `VITE_WS_BASE_URL` (+ Google OAuth client id); update `.env.example`.
- **Deliverable:** `npm run dev` against the local Rust API reproduces all current flows (create/join room, vote, reveal, reset, retro cards/votes/timer/action items, handover/co-host, dev sign-in). Verify in the preview browser using the dev sign-in accounts.

## Step 6 — Data migration, deployment, and Firebase decommission

**Objective:** Move existing data, cut over infrastructure, and remove Firebase.

- Write a one-shot migration script (Rust bin or Node) that reads existing Firestore `rooms`/`retros` (via Firebase Admin export or the SDK) and inserts them into MongoDB with field names/shapes preserved; convert Firestore `Timestamp` → MongoDB date; set `_id` = the 8-char code.
- Replace deploy tooling: drop `firebase deploy` / `firestore:rules` / `firestore:indexes` scripts in `package.json`; add scripts/CI to build & deploy the Rust API (container) and the static frontend, plus apply MongoDB indexes. Update `.github/workflows` (`deploy-development.yml` / `deploy-production.yml`) accordingly.
- Remove `firebase` dependency from `package.json`; delete `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `.firebase/` once verified.
- Update `CLAUDE.md` and `README.md` to document the new architecture (Rust API + MongoDB, new dev sign-in flow, run/deploy commands).
- **Final verification:** run both dev and prod-equivalent environments end-to-end; confirm real-time, auth, validation, and the "active sessions / previous action items" queries all work; only then decommission the Firebase projects.

---

## Risk notes for the executing agent
- **Real-time is the highest-risk piece** — validate Step 4 thoroughly before Step 5; the whole app's UX depends on live updates.
- **Keep JSON field names identical** to today's Firestore fields throughout the API so the frontend diff stays minimal and reversible.
- **Re-implement `firestore.rules` faithfully** — it is the only authorization layer today; gaps become security holes.
- **Atomicity:** Firestore dotted-path updates are atomic; use MongoDB atomic operators (not read-modify-write) to avoid races on concurrent votes/cards.
- Migrate and cut over **dev first**, verify, then prod.

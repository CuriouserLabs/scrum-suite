# Migration Plan: Insert a Rust API Gateway in Front of Firestore (storage-swappable)

> **Audience:** A Claude AI agent executing this migration step by step.
> **Goal:** Put a **Rust API service** between the React/Vite frontend and the data store.
> The browser talks **only** to Rust (REST + WebSocket); Rust is the only thing that touches
> the database. **Firebase Firestore stays** as the data store *for now*, and **Firebase
> Hosting stays** for the static SPA. Crucially, Rust reaches Firestore through a
> **storage abstraction (repository ports)** so Firestore can later be swapped for MongoDB
> or a relational DB by writing a new adapter — with **zero changes** to the HTTP, domain,
> or frontend layers. The app's behavior (real-time collaborative poker & retro) stays identical.

---

## Key architectural decisions (locked)

1. **Rust is the sole gateway (full proxy).** The Firestore client SDK is **removed from the
   browser**. The client uses REST for mutations/queries and a WebSocket for live updates.
2. **Storage is behind ports-and-adapters.** Domain logic depends on `RoomRepository` /
   `RetroRepository` **traits** (ports). A `FirestoreRepository` **adapter** implements them
   today; `MongoRepository` / `PostgresRepository` can implement the same traits later.
   Real-time is part of the port (a `watch(id)` subscription), so each store supplies its own
   change feed (Firestore `Listen` → Mongo Change Streams → Postgres `LISTEN/NOTIFY`).
3. **Firebase Auth stays** (Google + dev email/password). Rust **verifies Firebase ID tokens**;
   it does not mint its own.
4. **Hosting:** Firebase Hosting serves the SPA; the Rust service runs on **Google Cloud Run**
   (same GCP project as Firestore → service-account access via ADC, scales to zero).

> **Technical feasibility of Firestore + Rust:** Yes. There is no official Google Rust SDK, but
> the mature community **`firestore` crate** (abdolence) speaks Firestore over gRPC and supports
> documents, queries, transactions, field transforms, **and real-time `Listen` streams** — which
> is exactly what the gateway and the `watch` port need. The Firestore REST API is a fallback.

---

## Current-State Summary (read before starting)

**Frontend:** React 19 + Vite SPA, now in **TypeScript** (the JS→TS migration is complete).
The only backend today is Firebase, called directly from the browser.

**Firebase surface area to move behind Rust (5 files):**
| File | Firebase usage today |
|------|----------------------|
| `src/utils/firebase.ts` | Initializes `app`, `db` (Firestore), `auth`, `googleProvider` |
| `src/contexts/UserContext.tsx` | `onAuthStateChanged`, `signInWithPopup` (Google), `signInWithEmailAndPassword` (dev), `signOut` |
| `src/hooks/useRoom.ts` | Planning-poker doc CRUD + `onSnapshot` real-time + mutations |
| `src/hooks/useRetro.ts` | Retro doc CRUD + `onSnapshot` real-time + mutations + cross-doc queries |
| `src/pages/HomePage.tsx` | `collection`/`query`/`where` + `onSnapshot` for a user's active sessions |

**Data model (two Firestore collections, doc ID = 8-char code):**
- `rooms`: `hostId`, `activeHostId`, `status`, `participants{}`, `participantIds[]`, `votes{}`, `revealed`, `round`, `storyTitle`, `coHosts[]`, `createdAt`.
- `retros`: `hostId`, `activeHostId`, `status`, `participants{}`, `participantIds[]`, `coHosts[]`, `columns[]`, `cards{}`, `previousActionItems{}`, `settings{}`, `timer{}`, `title`, `createdAt`.
The frontend already distinguishes the raw doc shape (`RoomDoc`/`RetroDoc`, `participants` as a
map) from the normalized client shape (`RoomState`/`RetroState`, `participants` as an array) in
`src/types/` — the Rust DTOs should mirror these so the wire contract is unchanged.

**Behavioral contracts that MUST be preserved:**
1. **Real-time:** every connected client sees mutations instantly (today via `onSnapshot`).
2. **Validation/authorization:** the rules in `firestore.rules` (field shapes, size limits, immutable `hostId`/`createdAt`, `status` transitions, host/co-host permissions) move **server-side into Rust's domain layer**.
3. **Auth identity:** `user.id` stays a stable per-user id (the Firebase UID); Google sign-in (prod) and dev email/password accounts (`testhost@scrumsuite.dev`, etc., password `testpass123`) keep working.
4. **Queries:** "my active sessions" = docs where `participantIds` contains my id AND `status == 'active'`; "previous retros with action items" reuses the same array-contains query.

**Tech choices (use unless a blocker arises):** Rust + `axum` (HTTP/WebSocket) + `tokio`;
`firestore` crate for the Firestore adapter; `async-trait` for the repository ports; Firebase
ID-token verification via Google JWKS (`jsonwebtoken` + key fetch, or a `firebase-auth` crate);
`tokio::sync::broadcast` for real-time fan-out. Frontend gains a thin REST + WebSocket client;
the React component tree and CSS stay untouched.

---

## Step 1 — Scaffold the Rust service with ports-and-adapters + Firestore connectivity

**Objective:** A compiling, runnable Cloud-Run-ready service whose storage boundary is a trait,
with a working Firestore adapter — before any business logic.

- Create an `api/` Cargo project (`axum`, `tokio`, `serde`, `async-trait`, `tracing`,
  `tower-http` CORS) and a `Dockerfile` suitable for Cloud Run (listens on `$PORT`).
- Define **storage-neutral domain models** (`RoomDoc`, `RetroDoc`, participants/cards/etc.) with
  `serde` field names identical to today's Firestore fields, so the frontend contract is unchanged.
- Define the **repository ports** (the swap boundary):
  - `RoomRepository` / `RetroRepository` traits with `get`, `create`, `update`, query methods,
    and a real-time `watch(id) -> Stream<Item = Snapshot>` method.
  - Express mutations as a **store-neutral operation vocabulary** — `set_field`, `add_to_array`,
    `remove_from_array`, `delete_field`, `increment`, `replace` — so atomicity is portable
    (Firestore field transforms today; Mongo `$set`/`$addToSet`/`$pull` later). Do **not** leak
    Firestore types through the trait.
- Implement the **`FirestoreRepository` adapter** with the `firestore` crate, authenticating via
  Application Default Credentials (service account). It is the *only* Firestore-aware module.
- Wire dependency injection so the service holds `Arc<dyn RoomRepository>` etc., selected by config.
- Add `/health` (checks Firestore reachability). **Deliverable:** `cargo run` connects to
  Firestore through the port and `/health` returns 200.

## Step 2 — Authenticate by verifying Firebase ID tokens

**Objective:** Trust the existing Firebase Auth identities server-side without minting new tokens.

- Keep Firebase Auth on the client unchanged (Google popup in prod; dev email/password accounts).
- Add Rust **middleware/extractor** that verifies the incoming **Firebase ID token**: fetch and
  cache Google's JWKS, validate signature/issuer/audience (= Firebase project id), and extract
  `uid`, `displayName`, `photoURL`, `email` into a request-scoped `AuthUser` (the `request.auth.uid`
  equivalent the old rules relied on).
- Put verification behind a tiny `TokenVerifier` abstraction (Firebase now; swappable later), but
  do **not** build a custom auth store — Firebase Auth stays.
- **Deliverable:** a protected stub endpoint accepts a valid Firebase ID token and rejects others.

## Step 3 — Domain service layer: port `firestore.rules` + expose every mutation as REST

**Objective:** Re-implement all room/retro behavior and authorization in a **storage-agnostic**
service layer that calls the repository ports.

- Build a domain service that depends only on the repository traits (no Firestore types).
- **Rooms:** create/get; `submitVote`, `revealVotes`, `resetRound`, `setStoryTitle`, `makeCoHost`,
  `handoverTo`, `endSession`; join/rejoin (participant upsert + `participantIds`); presence.
- **Retros:** create/get; `updateTitle`, `addCard`/`deleteCard`/`editCard`, `toggleVote`,
  `updateColumns`, `updateSettings`, `revealCards`, `makeCoHost`, `handoverTo`,
  `startTimer`/`stopTimer`, `addActionItem`/`toggleActionItem`/`deleteActionItem`, `endSession`.
- **Cross-doc queries:** `GET /sessions/active` (array-contains participant + `status==active`) and
  `GET /retros/previous` (+ `importActionItems`), via repository query methods.
- **Authorization & validation:** port `firestore.rules` exactly — field shapes/sizes, immutable
  `hostId`/`createdAt`, valid `status` transitions, host-or-co-host gating, vote-value checks, map/array
  caps. Express writes only through the store-neutral op vocabulary so the Firestore adapter applies
  them atomically (and future adapters can too).
- **Deliverable:** full CRUD works via `curl`; invalid writes rejected with the same constraints
  the rules enforced.

## Step 4 — Real-time fan-out: Firestore `Listen` → WebSocket, through the `watch` port

**Objective:** Push live document changes to all connected clients, replacing client `onSnapshot`.

- Implement the port's `watch(id)` in the **Firestore adapter** using the `firestore` crate's
  `Listen` stream (gRPC), yielding **full normalized snapshots** (so any future adapter — Mongo
  Change Streams, Postgres `LISTEN/NOTIFY` + refetch — can satisfy the same contract).
- Add authenticated **WebSocket** endpoints (e.g. `GET /ws/rooms/:id`, `/ws/retros/:id`). On connect,
  send the current snapshot, then stream updates. Use **one upstream `watch` per active doc** shared
  across clients via a `tokio::sync::broadcast` channel keyed by doc id (saves Firestore listener quota).
- Tie **presence** to the socket lifecycle: mark participant `online` true on connect, false on
  disconnect (replacing the hooks' cleanup logic).
- **Deliverable:** two browser tabs in the same room/retro see each other's changes live, with
  correct online/offline presence.

## Step 5 — Frontend: talk only to Rust; remove the Firestore SDK from the browser

**Objective:** Swap all direct Firestore access for the Rust API, with zero visible UX change.

- Replace Firestore usage in `src/utils/firebase.ts` with `src/utils/api.ts` (REST wrapper that
  attaches the Firebase ID token) and `src/utils/realtime.ts` (WebSocket client with reconnect).
  Keep the **Firebase Auth** SDK for sign-in.
- Rewrite `useRoom.ts` / `useRetro.ts` / `HomePage.tsx` keeping their **return signatures identical**
  (back subscriptions with the WS client, mutations with REST). Preserve `normalizeState`, the
  `isEnded` guards, and ended/frozen-session handling. `UserContext.tsx` keeps Firebase sign-in but
  now also exposes the ID token for API calls; `useAuthUser()` stays.
- **Lock down Firestore security rules** to deny all client read/write (only the Rust service account,
  which bypasses rules, touches Firestore). Do this **only after** the Rust path is verified.
- Env: add `VITE_API_BASE_URL` / `VITE_WS_BASE_URL`; retain Firebase Auth config; update `.env.*`.
- **Deliverable:** `npm run dev` against the local Rust API reproduces every flow (create/join room,
  vote, reveal, reset, retro cards/votes/timer/action items, handover/co-host, dev sign-in).
  Verify in the preview browser using the dev sign-in accounts.

## Step 6 — Deploy on Cloud Run + Firebase Hosting, and document the storage-swap path

**Objective:** Ship the gateway and lock in the swappable design.

- Containerize the Rust service and deploy to **Cloud Run** in the same GCP project as Firestore;
  grant its runtime service account Firestore access (ADC — no key files).
- Keep **Firebase Hosting** for the SPA. Add a Hosting **rewrite** so `/api/**` proxies to Cloud Run
  for REST. **Note:** Firebase Hosting rewrites do **not** proxy WebSockets — the realtime channel
  (`VITE_WS_BASE_URL`) must connect **directly** to the Cloud Run service URL, with CORS allowing the
  Hosting origin. (Use SSE only if WebSocket on Cloud Run proves problematic.)
- Update CI/deploy scripts: drop direct `firebase deploy` of app logic where it no longer applies,
  add Cloud Run build/deploy, keep `deploy:rules` for the now-locked-down `firestore.rules`.
- **Document the swap procedure** (the payoff): to move off Firestore, implement
  `MongoRepository`/`PostgresRepository` against the existing `RoomRepository`/`RetroRepository`
  ports (including `watch`), flip the storage selection in config, and migrate data — with **no
  changes** to the HTTP layer, domain/service layer, or frontend.
- Update `CLAUDE.md` / `README.md` to document the new topology (browser → Rust on Cloud Run →
  Firestore-behind-ports; Firebase Auth + Hosting retained).
- **Deliverable:** prod-equivalent end-to-end on Cloud Run + Firebase Hosting; real-time, auth,
  validation, and queries all verified.

---

## Risk notes for the executing agent
- **The `watch` port is the hardest abstraction.** Define it as a stream of **full normalized
  snapshots**, not deltas — Firestore gives doc snapshots directly; Mongo Change Streams give deltas
  you must resolve to a full doc; Postgres needs `NOTIFY` + refetch. A snapshot contract keeps all
  adapters interchangeable.
- **Keep Firestore semantics out of the ports.** If the store-neutral op vocabulary
  (`add_to_array`, `increment`, …) isn't expressive enough, extend *it* — don't let `arrayUnion` or
  Firestore field-transform types leak through the trait, or the swap promise breaks.
- **No official Google Rust SDK** — depend on the `firestore` crate; pin the version and keep the
  REST API as a documented fallback.
- **Hosting → Cloud Run rewrites don't support WebSockets** — plan the realtime channel to hit Cloud
  Run directly (CORS), not via the Hosting rewrite.
- **Firestore `Listen` quota/cost** for server-held listeners — share one upstream listener per doc
  across all subscribers via the broadcast channel.
- **Atomicity:** mutate via Firestore field transforms inside the adapter (not read-modify-write) to
  avoid races on concurrent votes/cards, just as the client did with `arrayUnion`/`deleteField`.
- **Sequencing:** verify the Rust write path end-to-end **before** locking Firestore rules, or the
  app breaks. Migrate/cut over **dev first**, then prod.

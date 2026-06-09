# Migration Plan: JavaScript → TypeScript (React App)

> **Audience:** A Claude AI agent executing this migration step by step.
> **Goal:** Convert the React + Vite frontend from JavaScript (`.js`/`.jsx`) to **TypeScript**
> (`.ts`/`.tsx`) with full type coverage, **without changing any runtime behavior, UI, or styling**.
> This is a pure type-safety/maintainability migration.

---

## Current-State Summary (read before starting)

**Stack:** React 19, Vite 8 (`@vitejs/plugin-react`, esbuild — already transpiles TS natively),
`react-router-dom` 7, `nanoid`, Firebase SDK. Flat ESLint config (`eslint.config.js`).
**Note:** `@types/react` and `@types/react-dom` are **already** in `devDependencies` — but `typescript` itself is **not** installed yet.

**Files to migrate — 21 total (17 `.jsx` + 4 `.js`):**

| Layer | Files |
|-------|-------|
| Entry | `src/main.jsx`, `src/App.jsx` |
| Utils | `src/utils/firebase.js`, `src/utils/retroColumns.js` |
| Data layer | `src/hooks/useRoom.js`, `src/hooks/useRetro.js`, `src/contexts/UserContext.jsx` |
| Pages | `src/pages/HomePage.jsx`, `LandingPage.jsx`, `RoomPage.jsx`, `RetroPage.jsx` |
| Components (11) | `ConnectionStatus`, `PreviousActionItems`, `ProfileWidget`, `RetroCard`, `RetroColumn`, `RetroHostControls`, `RetroTimer`, `RevealedCards`, `VoteBoard`, `VotingDeck` (all `.jsx`) |

**Domain shapes that need types (derived from `useRoom.js` / `useRetro.js` / `firestore.rules`):**
- `User`: `{ id, displayName, photoURL, email }`
- `Participant`: `{ id, displayName, photoURL, isHost, online }`
- `RoomState`: `{ hostId, activeHostId, status, participants[], participantIds[], votes, revealed, round, storyTitle, coHosts, createdAt }` (`status: 'active' | 'ended'`, vote value `number | '?'`)
- `RetroState`: `{ …, columns, cards, previousActionItems, settings, timer, title? }`
- `Card`: `{ columnId, text, authorId, votes[], createdAt }`
- `ActionItem`: `{ text, done, authorId, createdAt }`
- `RetroSettings`: `{ anonymous, hideCards, revealed }`
- `Timer`: `{ duration, startedAt, running }`
- `Column`: `{ id, label, color, icon }` (from `retroColumns.js`)
- `Role`: `'host' | 'client'`; `Status`: `'connecting' | 'ready' | 'connected' | 'ended' | 'disconnected' | 'error'`

**Component prop contracts already exist implicitly** — e.g. `RetroCard` takes
`{ card, cardId, columnColor, userId, isHost, anonymous, hideCards, revealed, onDelete, onEdit, onToggleVote }`.
Each component's destructured props become a `Props` interface.

**Constraints to preserve:**
1. **Zero behavior change** — no logic edits; only type annotations and `.jsx→.tsx` renames.
2. **Vite already handles `.tsx`** via esbuild; no build-pipeline rewrite needed, only config/lint.
3. Keep the hooks' **return signatures** intact (consumers destructure many fields).
4. CSS imports (`import './X.css'`) must keep working under TS.

---

## Step 1 — Install TypeScript tooling and add configuration

**Objective:** Make the project understand TypeScript and type-check, while still building/running exactly as before.

- Add dev deps: `typescript`, `typescript-eslint`, `@types/node` (already have `@types/react`, `@types/react-dom`).
- Create `tsconfig.json` (app) targeting `ESNext`/`bundler` module resolution, `jsx: react-jsx`, `moduleResolution: bundler`, `isolatedModules: true`, `noEmit: true`, `allowJs: true` **initially** (so a mixed `.js`/`.ts` tree compiles during migration). Start with `strict: false` — strict is flipped on in Step 6.
- Create `tsconfig.node.json` for Vite config typing and reference both from a root `tsconfig.json`.
- Add `src/vite-env.d.ts` with `/// <reference types="vite/client" />` so `import.meta.env.*` (e.g. `VITE_FIREBASE_*`, `import.meta.env.DEV`) is typed; declare the app's env vars in an `ImportMetaEnv` interface.
- Add a `"type-check": "tsc --noEmit"` script to `package.json`.
- Rename `vite.config.js` → `vite.config.ts` (and `eslint.config.js` stays JS for now).
- **Deliverable:** `npm run dev` and `npm run build` still work unchanged; `npm run type-check` runs (clean, since `allowJs` + loose settings).

## Step 2 — Define the shared domain type system

**Objective:** Create the single source of truth for all data shapes — the foundation every other file imports.

- Create `src/types/` (e.g. `models.ts` for domain entities, `index.ts` re-exporting). Define: `User`, `Participant`, `RoomState`, `RetroState`, `Card`, `ActionItem`, `RetroSettings`, `Timer`, `Column`, `Role`, `ConnectionStatus`, vote value union (`number | '?'`), and the maps (`Record<string, Card>`, `Record<string, ActionItem>`, `Record<string, VoteValue>`).
- Mirror the exact shapes from `firestore.rules`/the hooks, including the **normalized** form (`participants` as an **array** of `Participant` after `normalizeState`, vs. the keyed map on the wire) — model both the raw doc type and the normalized client type.
- Type the `UserContext` value: `{ user: User | null, loading: boolean, login, loginWithEmail, logout }`.
- **Deliverable:** `src/types` compiles standalone and is importable; no behavior touched.

## Step 3 — Migrate the data layer (utils, hooks, context)

**Objective:** Convert the lowest-level non-UI modules first, since components/pages depend on them.

- `src/utils/firebase.js → firebase.ts`: type the exported `db`, `auth`, `googleProvider`; rely on the Firebase SDK's own types.
- `src/utils/retroColumns.js → retroColumns.ts`: type `ALL_COLUMNS: Column[]`, `DEFAULT_COLUMN_IDS: string[]`, `getColumnById(id: string): Column | undefined`.
- `src/contexts/UserContext.jsx → UserContext.tsx`: type the context with the `UserContext` value type from Step 2; type the Firebase `User` → app `User` mapping in `onAuthStateChanged`.
- `src/hooks/useRoom.js → useRoom.ts` and `useRetro.js → useRetro.ts`: type params (`roomId: string`, `user: User`), the `normalizeState` function, internal `useRef`/`useState` generics, and **annotate the full return object** (the public hook contract). Type all `useCallback` mutation signatures (e.g. `submitVote(value: VoteValue)`, `addCard(columnId: string, text: string)`).
- **Deliverable:** `npm run type-check` passes; data layer is fully typed; app still runs.

## Step 4 — Migrate the components (`.jsx → .tsx`)

**Objective:** Convert all 11 presentational/interactive components, adding an explicit `Props` interface to each.

- For each component, define a `Props` interface from its current destructured props (event handlers typed as `(args) => void`, DOM events as `React.ChangeEvent`/`React.KeyboardEvent`/`React.MouseEvent`, refs as `React.RefObject<HTMLTextAreaElement>` etc. — e.g. `RetroCard`'s `textareaRef`).
- Use the domain types from Step 2 for entity props (`card: Card`, `participants: Participant[]`, `timer: Timer`, …) instead of re-describing shapes inline.
- Type `useState` generics where inference is insufficient (e.g. `useState<string>('')`, `useState<boolean>(false)`).
- Keep JSX, classNames, and CSS imports byte-for-byte identical.
- **Deliverable:** all components are `.tsx` with typed props; `type-check` passes; UI unchanged in the preview browser.

## Step 5 — Migrate pages and the app entry point

**Objective:** Convert the routing/page layer and bootstrap, completing the `.jsx` → `.tsx` sweep.

- `src/main.jsx → main.tsx`: type the `createRoot(document.getElementById('root')!)` non-null assertion; update `index.html`'s `<script src="/src/main.jsx">` → `/src/main.tsx`.
- `src/App.jsx → App.tsx`: type the router setup.
- Pages `HomePage`, `LandingPage`, `RoomPage`, `RetroPage` (`.jsx → .tsx`): type route params via `useParams<{ roomId: string }>()` (react-router 7), type the Firestore query results in `HomePage` using the domain types, and type any local component props.
- After this step **no `.jsx`/`.js` source files remain** under `src` (except generated `.d.ts`).
- **Deliverable:** entire `src` tree is TS; `npm run build` produces a working bundle; preview browser shows all flows working (create/join room, vote, reveal, retro cards/timer/action items, dev sign-in).

## Step 6 — Enable strict mode, finalize lint, verify, and document

**Objective:** Tighten the type checker, wire up TS-aware linting, and lock in the migration.

- In `tsconfig.json`: set `allowJs: false` and turn on `strict: true` (plus `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`). Resolve the resulting errors (null-safety around `roomState?.`, optional fields, narrowing `status` unions). If strict surfaces too many at once, enable flags incrementally (`strictNullChecks` first).
- Update `eslint.config.js`: switch the flat config to use `typescript-eslint` recommended configs, change `files` glob to `**/*.{ts,tsx}`, and add the TS parser. Keep `react-hooks` and `react-refresh` plugins.
- Update `package.json`: add `type-check` to any CI/pre-build step; ensure `lint` covers `.ts`/`.tsx`.
- **Verification gate:** `npm run type-check` (clean) + `npm run lint` (clean) + `npm run build` (succeeds) + preview-browser smoke test of every major flow using the dev sign-in accounts.
- Update `CLAUDE.md` / `README.md` to note the codebase is now TypeScript (file extensions, `type-check` command).
- **Deliverable:** strict, lint-clean, fully typed TypeScript app with identical runtime behavior.

---

## Risk notes for the executing agent
- **Migrate bottom-up** (types → utils/hooks → components → pages) so each file's dependencies are already typed; this minimizes cascading `any`/error churn.
- **`allowJs: true` during Steps 1–5** keeps the app buildable while half-migrated; only disable it in Step 6 once everything is `.ts`/`.tsx`.
- **Do not refactor logic** — if a true bug surfaces under strict typing, note it but keep the migration behavior-preserving; fix bugs in a separate change.
- **Vite needs no loader changes** — esbuild handles `.tsx` already; the risk is config/lint, not bundling. Don't add `ts-loader`/Babel.
- **Watch `import.meta.env`** — the dev-sign-in gate (`import.meta.env.DEV`) and `VITE_*` vars must be declared in `vite-env.d.ts` or strict mode will flag them.
- **`participants` dual shape** (keyed map on the wire vs. array after `normalizeState`) is the most error-prone type — model both explicitly.
- Verify in the **preview browser after each of Steps 3–5**, not just at the end, to catch any accidental behavior change early.

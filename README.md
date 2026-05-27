# Scrum Suite

A real-time agile toolkit for scrum teams. Run sprint planning poker sessions and retrospective boards — all in one place, no account required. Works on any network including corporate firewalls.

## Features

- **Instant rooms** — generate a room with one click and share the URL
- **Real-time sync** — powered by Firestore; works on any network including corporate firewalls
- **Fibonacci voting** — standard planning poker values: 0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?
- **Hidden votes** — cards stay face-down until the host reveals them
- **Co-host support** — host can promote any participant to co-host so the session survives if the host disconnects
- **Story titles** — host can label what's being estimated each round
- **Persistent identity** — display name saved in browser; no re-login on refresh
- **Multiple simultaneous rooms** — each team gets an isolated session

## Tech stack

- [React 19](https://react.dev) + [Vite](https://vite.dev)
- [Cloud Firestore](https://firebase.google.com/docs/firestore) for real-time state sync
- [React Router v7](https://reactrouter.com)
- [Firebase Hosting](https://firebase.google.com/docs/hosting) for deployment
- CSS custom properties — no UI framework

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, set your display name, and create a room.

## How it works

When you create a room, a Firestore document at `rooms/{roomId}` is created with you as the host. Everyone who opens the same link subscribes to that document via `onSnapshot` — all state changes (votes, reveals, new rounds) are written to Firestore and instantly reflected on every participant's screen. Communication goes through Firebase's servers over HTTPS, so it works on any network including corporate firewalls that block WebRTC/UDP.

The host can promote any participant to **co-host** (★ star button in the sidebar). Co-hosts have the same controls as the host (reveal, reset, story title) and the session continues without interruption if the original host disconnects.

## Deployment

The app is hosted at **https://scrumsuite.org**.

To deploy a new version:

```bash
firebase deploy
```

This runs `npm run build` automatically (via the `predeploy` hook in `firebase.json`) and pushes the built `dist/` directory to Firebase. The SPA rewrite rule ensures direct links to rooms (`/room/:roomId`) resolve correctly. Firestore rules are deployed separately with `firebase deploy --only firestore:rules`.

You need the [Firebase CLI](https://firebase.google.com/docs/cli) installed and logged in (`firebase login`) to deploy.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `firebase deploy` | Build and deploy to Firebase Hosting |

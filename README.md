# Sprint Poker

Real-time sprint planning poker for agile teams. Create a room, share the link, and vote on story points simultaneously — no account, no backend, no setup required.

## Features

- **Instant rooms** — generate a room with one click and share the URL
- **Real-time P2P** — powered by WebRTC (PeerJS); no server or database needed
- **Fibonacci voting** — standard planning poker values: 0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?
- **Hidden votes** — cards stay face-down until the host reveals them
- **Co-host support** — host can promote any participant to co-host; if the host drops, a co-host automatically takes over with all state preserved
- **Story titles** — host can label what's being estimated each round
- **Persistent identity** — display name saved in browser; no re-login on refresh
- **Multiple simultaneous rooms** — each team gets an isolated session

## Tech stack

- [React 19](https://react.dev) + [Vite](https://vite.dev)
- [PeerJS](https://peerjs.com) for WebRTC peer-to-peer communication
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

When you create a room, your browser registers as the **host peer** using the room ID as the PeerJS peer identifier. Team members who open the same link connect directly to your browser via WebRTC. The host holds all session state and broadcasts updates to every participant. No data leaves the browser network — there is no backend.

The host can promote any participant to **co-host** (★ star button in the sidebar). If the primary host disconnects, the co-host automatically claims the host role and the session continues uninterrupted — votes, round number, and story title are all preserved. Regular participants reconnect automatically once the co-host takes over.

## Deployment

The app is hosted on Firebase Hosting at **https://vote-9f5e2.web.app**.

To deploy a new version:

```bash
firebase deploy
```

This runs `npm run build` automatically (via the `predeploy` hook in `firebase.json`) and pushes the built `dist/` directory to Firebase. The SPA rewrite rule ensures direct links to rooms (`/room/:roomId`) resolve correctly.

You need the [Firebase CLI](https://firebase.google.com/docs/cli) installed and logged in (`firebase login`) to deploy.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `firebase deploy` | Build and deploy to Firebase Hosting |

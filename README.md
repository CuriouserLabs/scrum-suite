# Sprint Poker

Real-time sprint planning poker for agile teams. Create a room, share the link, and vote on story points simultaneously — no account, no backend, no setup required.

## Features

- **Instant rooms** — generate a room with one click and share the URL
- **Real-time P2P** — powered by WebRTC (PeerJS); no server or database needed
- **Fibonacci voting** — standard planning poker values: 0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?
- **Hidden votes** — cards stay face-down until the host reveals them
- **Story titles** — host can label what's being estimated each round
- **Persistent identity** — display name saved in browser; no re-login on refresh
- **Multiple simultaneous rooms** — each team gets an isolated session

## Tech stack

- [React 19](https://react.dev) + [Vite](https://vite.dev)
- [PeerJS](https://peerjs.com) for WebRTC peer-to-peer communication
- [React Router v7](https://reactrouter.com)
- CSS custom properties — no UI framework

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, set your display name, and create a room.

## How it works

When you create a room, your browser registers as the **host peer** using the room ID as the PeerJS peer identifier. Team members who open the same link connect directly to your browser via WebRTC. The host holds all session state and broadcasts updates to every participant. No data leaves the browser network — there is no backend.

If the host closes their tab, the session ends for all participants.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

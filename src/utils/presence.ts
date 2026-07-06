import {
  updateDoc, serverTimestamp,
  type DocumentReference, type Timestamp,
} from 'firebase/firestore';
import type { ParticipantData, Participant } from '../types';

// ===============================================================
// Presence (online/offline) via heartbeat
// ===============================================================
//
// A participant's `online` flag alone is unreliable: it is set to false only on
// a clean leave (React Router unmount). When a user closes the browser or tab,
// that cleanup never flushes its async Firestore write, so the flag would stay
// true forever. To fix this, every open tab periodically refreshes a
// `lastActive` server timestamp, and `isParticipantOnline` treats a participant
// as offline once that heartbeat goes stale — so a closed tab reliably appears
// offline to everyone else within a minute, even without a clean leave.

/** How often an open tab refreshes its `lastActive` heartbeat. */
export const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * A participant whose last heartbeat is older than this is treated as offline,
 * regardless of their stored `online` flag. Set above two heartbeat intervals
 * so a couple of dropped/slow writes don't cause a false "offline" flicker.
 */
export const OFFLINE_THRESHOLD_MS = 60_000;

function toMillis(ts: Timestamp | null | undefined): number | null {
  // serverTimestamp() resolves to null locally until the server confirms it.
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null;
}

/**
 * Effective online status: the stored `online` flag gated by heartbeat
 * freshness. A participant with no `lastActive` yet (an optimistic local write,
 * or a session created before heartbeats existed) is trusted as-is to avoid
 * flicker; once a heartbeat lands, staleness takes over.
 */
export function isParticipantOnline(
  p: Pick<ParticipantData, 'online' | 'lastActive'>,
  nowMs: number = Date.now(),
): boolean {
  if (!p.online) return false;
  const lastMs = toMillis(p.lastActive);
  if (lastMs === null) return true;
  return nowMs - lastMs < OFFLINE_THRESHOLD_MS;
}

/**
 * Stable ordering for the participant list.
 *
 * `normalizeState` builds the array from `Object.entries(participants)`, but a
 * Firestore map has no guaranteed key order across snapshots — when any nested
 * field updates (a vote, a new card, a presence heartbeat) the keys can come
 * back in a different order, making the rendered list visibly reshuffle. Sorting
 * on immutable/stable keys pins the order so those unrelated updates never move
 * anyone: host first, then by display name, with the (immutable) id as the
 * final tiebreaker for full determinism.
 */
export function compareParticipants(a: Participant, b: Participant): number {
  if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
  const byName = a.displayName.localeCompare(b.displayName, undefined, {
    sensitivity: 'base',
  });
  if (byName !== 0) return byName;
  return a.id.localeCompare(b.id);
}

/**
 * Keeps a participant's presence fresh while their tab is open, and makes a
 * best-effort attempt to mark them offline the moment the tab is hidden/closed.
 * The best-effort write is not guaranteed to flush — which is exactly why
 * `isParticipantOnline` also enforces heartbeat staleness as the real backstop.
 *
 * Returns a cleanup function that stops the heartbeat and removes listeners.
 */
export function startPresenceHeartbeat(
  docRef: DocumentReference,
  userId: string,
): () => void {
  const lastActiveField = `participants.${userId}.lastActive`;
  const onlineField = `participants.${userId}.online`;

  const beat = () => {
    updateDoc(docRef, { [lastActiveField]: serverTimestamp() }).catch(() => {});
  };
  // Heartbeat immediately so a freshly-joined tab is unambiguously online, then
  // on the interval thereafter.
  beat();
  const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);

  const handleHide = () => {
    updateDoc(docRef, { [onlineField]: false }).catch(() => {});
  };
  // `pagehide` covers tab close, navigation and (on mobile) bfcache eviction;
  // `beforeunload` covers desktop window/tab close and reloads.
  window.addEventListener('pagehide', handleHide);
  window.addEventListener('beforeunload', handleHide);

  return () => {
    clearInterval(interval);
    window.removeEventListener('pagehide', handleHide);
    window.removeEventListener('beforeunload', handleHide);
  };
}

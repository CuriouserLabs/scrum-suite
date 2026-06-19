import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase';
import type {
  RoomDoc,
  RetroDoc,
  RetroState,
  PokerHistorySession,
  RetroHistorySession,
} from '../types';

interface SessionHistory {
  poker: PokerHistorySession[];
  retro: RetroHistorySession[];
  loading: boolean;
  error: boolean;
}

/** Flatten a raw retro doc's participant map into the array shape the rest of
 *  the app (and `ExportMenu`) expects. Mirrors `normalizeState` in useRetro. */
function toRetroState(data: RetroDoc): RetroState {
  return {
    ...data,
    participants: Object.entries(data.participants || {}).map(([id, p]) => ({
      id,
      ...p,
    })),
  };
}

function byNewest(a: { createdAt: Date | null }, b: { createdAt: Date | null }) {
  return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
}

/** Most recent sessions to surface per tab — history is a quick glance, not an archive. */
const MAX_HISTORY_ITEMS = 5;

/**
 * Read-only history of the signed-in user's *ended* sessions, for both Sprint
 * Poker and Retro Board. Uses a one-time fetch (not a realtime listener) since
 * ended sessions don't change and history is viewed rarely.
 */
export function useSessionHistory(userId: string): SessionHistory {
  const [history, setHistory] = useState<SessionHistory>({
    poker: [],
    retro: [],
    loading: true,
    error: false,
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      try {
        const [roomSnap, retroSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'rooms'),
            where('participantIds', 'array-contains', userId),
            where('status', '==', 'ended'),
          )),
          getDocs(query(
            collection(db, 'retros'),
            where('participantIds', 'array-contains', userId),
            where('status', '==', 'ended'),
          )),
        ]);

        if (cancelled) return;

        const poker: PokerHistorySession[] = roomSnap.docs.map((d) => {
          const data = d.data() as RoomDoc;
          return {
            id: d.id,
            createdAt: data.createdAt?.toDate?.() || null,
            isHost: data.hostId === userId || data.activeHostId === userId,
            totalParticipants: Object.keys(data.participants || {}).length,
            storyTitle: data.storyTitle,
          };
        }).sort(byNewest).slice(0, MAX_HISTORY_ITEMS);

        const retro: RetroHistorySession[] = retroSnap.docs.map((d) => {
          const data = d.data() as RetroDoc;
          return {
            id: d.id,
            createdAt: data.createdAt?.toDate?.() || null,
            isHost: data.hostId === userId || data.activeHostId === userId,
            totalParticipants: Object.keys(data.participants || {}).length,
            title: data.title || '',
            cardCount: Object.keys(data.cards || {}).length,
            state: toRetroState(data),
          };
        }).sort(byNewest).slice(0, MAX_HISTORY_ITEMS);

        setHistory({ poker, retro, loading: false, error: false });
      } catch (err) {
        console.error('Session history query failed:', err);
        if (!cancelled) {
          setHistory({ poker: [], retro: [], loading: false, error: true });
        }
      }
    }

    setHistory((h) => ({ ...h, loading: true, error: false }));
    load();

    return () => { cancelled = true; };
  }, [userId]);

  return history;
}

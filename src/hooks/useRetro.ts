import { useEffect, useRef, useState, useCallback } from 'react';
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, query, where, getDocs,
  serverTimestamp, arrayUnion, arrayRemove, deleteField,
} from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { db } from '../utils/firebase';
import { DEFAULT_COLUMN_IDS, ACTION_ITEMS_COLUMN_ID } from '../utils/retroColumns';
import type {
  User, Role, ConnectionState, RetroDoc, RetroState, RetroSettings,
  ActionItem, PreviousRetroSummary, UseRetroResult,
} from '../types';

/**
 * Action items worth carrying into a new session from a previous retro. This is
 * the combination of both tabs: the live "Action Items" cards added during that
 * session, plus its still-pending "Previous Action Items" (which were themselves
 * carried over from even earlier sessions). Returns the texts in creation order.
 */
function collectImportableActionItems(data: RetroDoc): string[] {
  const actionCards = Object.values(data.cards || {})
    .filter((c) => c.columnId === ACTION_ITEMS_COLUMN_ID);
  const pendingPrevious = Object.values(data.previousActionItems || {})
    .filter((i) => !i.done);
  return [...actionCards, ...pendingPrevious]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((i) => i.text);
}

function normalizeState(data: RetroDoc | undefined): RetroState | null {
  if (!data) return null;
  return {
    ...data,
    participants: Object.entries(data.participants || {}).map(([id, p]) => ({
      id,
      ...p,
    })),
  };
}

export function useRetro(retroId: string, user: User): UseRetroResult {
  const [role, setRole] = useState<Role | null>(null);
  const [retroState, setRetroState] = useState<RetroState | null>(null);
  const [status, setStatus] = useState<ConnectionState>('connecting');
  const retroStateRef = useRef<RetroState | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    const retroRef = doc(db, 'retros', retroId);
    let unsubscribe: (() => void) | null = null;
    let left = false;
    joinedRef.current = false;

    async function init() {
      const snap = await getDoc(retroRef);

      if (left) return;

      if (!snap.exists()) {
        // Guests can only join existing sessions, never create one.
        if (user.isGuest) {
          setStatus('disconnected');
          return;
        }
        await setDoc(retroRef, {
          hostId: user.id,
          activeHostId: user.id,
          status: 'active',
          participants: {
            [user.id]: {
              displayName: user.displayName,
              photoURL: user.photoURL || null,
              isHost: true,
              online: true,
              isGuest: false,
            },
          },
          participantIds: [user.id],
          coHosts: [],
          columns: DEFAULT_COLUMN_IDS,
          cards: {},
          previousActionItems: {},
          settings: {
            anonymous: false,
            hideCards: false,
            revealed: false,
          },
          timer: { duration: 0, startedAt: 0, running: false },
          createdAt: serverTimestamp(),
        });
        joinedRef.current = true;
        setRole('host');
        setStatus('ready');
      } else {
        const data = snap.data() as RetroDoc;

        if (data.status === 'ended') {
          setStatus('ended');
          return;
        }

        const activeHostId = data.activeHostId || data.hostId;
        const isActiveHost = activeHostId === user.id;
        const isCoHost = data.coHosts?.includes(user.id);
        setRole(isActiveHost || isCoHost ? 'host' : 'client');

        if (data.participants?.[user.id]) {
          await updateDoc(retroRef, {
            [`participants.${user.id}.online`]: true,
            [`participants.${user.id}.displayName`]: user.displayName,
            [`participants.${user.id}.photoURL`]: user.photoURL || null,
          });
        } else {
          await updateDoc(retroRef, {
            [`participants.${user.id}`]: {
              displayName: user.displayName,
              photoURL: user.photoURL || null,
              isHost: data.hostId === user.id,
              online: true,
              isGuest: user.isGuest,
            },
            participantIds: arrayUnion(user.id),
          });
        }
        joinedRef.current = true;
        setStatus('connected');
      }

      if (left) return;

      unsubscribe = onSnapshot(retroRef, (snap) => {
        if (!snap.exists()) {
          setStatus('disconnected');
          return;
        }
        const data = snap.data() as RetroDoc;

        if (data.status === 'ended') {
          setStatus('ended');
          const normalized = normalizeState(data);
          retroStateRef.current = normalized;
          setRetroState(normalized);
          return;
        }

        const activeHostId = data.activeHostId || data.hostId;
        const isActiveHost = activeHostId === user.id;
        const isCoHost = data.coHosts?.includes(user.id);
        setRole(isActiveHost || isCoHost ? 'host' : 'client');

        const normalized = normalizeState(data);
        retroStateRef.current = normalized;
        setRetroState(normalized);
      }, (err) => {
        console.error('Retro listener error:', err);
        setStatus('error');
      });
    }

    init().catch((err) => {
      console.error('Retro init error:', err);
      if (!left) setStatus('error');
    });

    return () => {
      left = true;
      unsubscribe?.();
      // Don't mark offline if the session was ended — it's frozen.
      if (joinedRef.current && retroStateRef.current?.status !== 'ended') {
        updateDoc(retroRef, {
          [`participants.${user.id}.online`]: false,
        }).catch(() => {});
      }
    };
  }, [retroId, user.id, user.displayName, user.photoURL, user.isGuest]);

  const isEnded = () => retroStateRef.current?.status === 'ended';

  const updateTitle = useCallback((title: string) => {
    if (isEnded()) return;
    updateDoc(doc(db, 'retros', retroId), { title }).catch(console.error);
  }, [retroId]);

  const endSession = useCallback(() => {
    updateDoc(doc(db, 'retros', retroId), {
      status: 'ended',
      timer: { duration: 0, startedAt: 0, running: false },
    }).catch(console.error);
  }, [retroId]);

  const addCard = useCallback((columnId: string, text: string) => {
    if (isEnded()) return;
    const cardId = nanoid(12);
    updateDoc(doc(db, 'retros', retroId), {
      [`cards.${cardId}`]: {
        columnId,
        text,
        authorId: user.id,
        votes: [],
        createdAt: Date.now(),
      },
    }).catch(console.error);
  }, [retroId, user.id]);

  const deleteCard = useCallback((cardId: string) => {
    if (isEnded()) return;
    updateDoc(doc(db, 'retros', retroId), {
      [`cards.${cardId}`]: deleteField(),
    }).catch(console.error);
  }, [retroId]);

  const editCard = useCallback((cardId: string, newText: string) => {
    if (isEnded()) return;
    updateDoc(doc(db, 'retros', retroId), {
      [`cards.${cardId}.text`]: newText,
    }).catch(console.error);
  }, [retroId]);

  const toggleVote = useCallback((cardId: string) => {
    if (isEnded()) return;
    const current = retroStateRef.current;
    const card = current?.cards?.[cardId];
    if (!card) return;
    const hasVoted = card.votes?.includes(user.id);
    updateDoc(doc(db, 'retros', retroId), {
      [`cards.${cardId}.votes`]: hasVoted ? arrayRemove(user.id) : arrayUnion(user.id),
    }).catch(console.error);
  }, [retroId, user.id]);

  const updateColumns = useCallback((columnIds: string[]) => {
    if (isEnded()) return;
    updateDoc(doc(db, 'retros', retroId), { columns: columnIds }).catch(console.error);
  }, [retroId]);

  const updateSettings = useCallback((partial: Partial<RetroSettings>) => {
    if (isEnded()) return;
    const updates: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(partial)) {
      updates[`settings.${key}`] = val;
    }
    updateDoc(doc(db, 'retros', retroId), updates).catch(console.error);
  }, [retroId]);

  const revealCards = useCallback(() => {
    if (isEnded()) return;
    updateDoc(doc(db, 'retros', retroId), {
      'settings.revealed': true,
    }).catch(console.error);
  }, [retroId]);

  const makeCoHost = useCallback((userId: string) => {
    if (isEnded()) return;
    const current = retroStateRef.current;
    const alreadyCoHost = current?.coHosts?.includes(userId);
    updateDoc(doc(db, 'retros', retroId), {
      coHosts: alreadyCoHost ? arrayRemove(userId) : arrayUnion(userId),
    }).catch(console.error);
  }, [retroId]);

  const handoverTo = useCallback((userId: string) => {
    if (isEnded()) return;
    updateDoc(doc(db, 'retros', retroId), {
      activeHostId: userId,
    }).catch(console.error);
  }, [retroId]);

  const addActionItem = useCallback((text: string) => {
    if (isEnded()) return;
    const itemId = nanoid(12);
    updateDoc(doc(db, 'retros', retroId), {
      [`previousActionItems.${itemId}`]: {
        text,
        done: false,
        authorId: user.id,
        createdAt: Date.now(),
      },
    }).catch(console.error);
  }, [retroId, user.id]);

  const toggleActionItem = useCallback((itemId: string) => {
    if (isEnded()) return;
    const current = retroStateRef.current;
    const item = current?.previousActionItems?.[itemId];
    if (!item) return;
    updateDoc(doc(db, 'retros', retroId), {
      [`previousActionItems.${itemId}.done`]: !item.done,
    }).catch(console.error);
  }, [retroId]);

  const deleteActionItem = useCallback((itemId: string) => {
    if (isEnded()) return;
    updateDoc(doc(db, 'retros', retroId), {
      [`previousActionItems.${itemId}`]: deleteField(),
    }).catch(console.error);
  }, [retroId]);

  const startTimer = useCallback((duration: number) => {
    if (isEnded()) return;
    updateDoc(doc(db, 'retros', retroId), {
      timer: { duration, startedAt: Date.now(), running: true },
    }).catch(console.error);
  }, [retroId]);

  const stopTimer = useCallback(() => {
    if (isEnded()) return;
    updateDoc(doc(db, 'retros', retroId), {
      timer: { duration: 0, startedAt: 0, running: false },
    }).catch(console.error);
  }, [retroId]);

  const fetchPreviousRetros = useCallback(async (): Promise<PreviousRetroSummary[]> => {
    const q = query(
      collection(db, 'retros'),
      where('participantIds', 'array-contains', user.id),
    );
    const snap = await getDocs(q);
    return snap.docs
      .filter((d) => d.id !== retroId)
      .map((d) => {
        const data = d.data() as RetroDoc;
        const importable = collectImportableActionItems(data);
        return {
          id: d.id,
          title: data.title || '',
          status: data.status,
          createdAt: data.createdAt?.toDate?.() || new Date(0),
          actionItemCount: importable.length,
          pendingCount: importable.length,
        };
      })
      // Show recent sessions even with nothing to import, so the user can
      // confidently pick the correct previous session instead of guessing and
      // re-importing stale items from an older one.
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 3);
  }, [user.id, retroId]);

  const importActionItems = useCallback(async (sourceRetroId: string): Promise<number> => {
    if (isEnded()) return 0;
    const snap = await getDoc(doc(db, 'retros', sourceRetroId));
    if (!snap.exists()) return 0;
    const texts = collectImportableActionItems(snap.data() as RetroDoc);
    if (texts.length === 0) return 0;
    const updates: Record<string, ActionItem> = {};
    texts.forEach((text, idx) => {
      const newId = nanoid(12);
      updates[`previousActionItems.${newId}`] = {
        text,
        done: false,
        authorId: user.id,
        // Preserve ordering with monotonically increasing timestamps.
        createdAt: Date.now() + idx,
      };
    });
    await updateDoc(doc(db, 'retros', retroId), updates);
    return texts.length;
  }, [retroId, user.id]);

  return {
    retroState, status, role,
    endSession, updateTitle,
    addCard, deleteCard, editCard, toggleVote,
    updateColumns, updateSettings, revealCards,
    makeCoHost, handoverTo, startTimer, stopTimer,
    addActionItem, toggleActionItem, deleteActionItem,
    fetchPreviousRetros, importActionItems,
  };
}

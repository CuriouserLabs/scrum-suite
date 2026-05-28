import { useEffect, useRef, useState, useCallback } from 'react';
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove, deleteField,
} from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { db } from '../utils/firebase';
import { DEFAULT_COLUMN_IDS } from '../utils/retroColumns';

function normalizeState(data) {
  if (!data) return null;
  return {
    ...data,
    participants: Object.entries(data.participants || {}).map(([id, p]) => ({
      id,
      ...p,
    })),
  };
}

export function useRetro(retroId, user) {
  const [role, setRole] = useState(null);
  const [retroState, setRetroState] = useState(null);
  const [status, setStatus] = useState('connecting');
  const retroStateRef = useRef(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    const retroRef = doc(db, 'retros', retroId);
    let unsubscribe = null;
    let left = false;
    joinedRef.current = false;

    async function init() {
      const snap = await getDoc(retroRef);

      if (left) return;

      if (!snap.exists()) {
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
        const data = snap.data();

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
        const data = snap.data();

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
      if (joinedRef.current) {
        updateDoc(retroRef, {
          [`participants.${user.id}.online`]: false,
        }).catch(() => {});
      }
    };
  }, [retroId, user.id, user.displayName, user.photoURL]);

  const addCard = useCallback((columnId, text) => {
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

  const deleteCard = useCallback((cardId) => {
    updateDoc(doc(db, 'retros', retroId), {
      [`cards.${cardId}`]: deleteField(),
    }).catch(console.error);
  }, [retroId]);

  const editCard = useCallback((cardId, newText) => {
    updateDoc(doc(db, 'retros', retroId), {
      [`cards.${cardId}.text`]: newText,
    }).catch(console.error);
  }, [retroId]);

  const toggleVote = useCallback((cardId) => {
    const current = retroStateRef.current;
    const card = current?.cards?.[cardId];
    if (!card) return;
    const hasVoted = card.votes?.includes(user.id);
    updateDoc(doc(db, 'retros', retroId), {
      [`cards.${cardId}.votes`]: hasVoted ? arrayRemove(user.id) : arrayUnion(user.id),
    }).catch(console.error);
  }, [retroId, user.id]);

  const updateColumns = useCallback((columnIds) => {
    updateDoc(doc(db, 'retros', retroId), { columns: columnIds }).catch(console.error);
  }, [retroId]);

  const updateSettings = useCallback((partial) => {
    const updates = {};
    for (const [key, val] of Object.entries(partial)) {
      updates[`settings.${key}`] = val;
    }
    updateDoc(doc(db, 'retros', retroId), updates).catch(console.error);
  }, [retroId]);

  const revealCards = useCallback(() => {
    updateDoc(doc(db, 'retros', retroId), {
      'settings.revealed': true,
    }).catch(console.error);
  }, [retroId]);

  const makeCoHost = useCallback((userId) => {
    const current = retroStateRef.current;
    const alreadyCoHost = current?.coHosts?.includes(userId);
    updateDoc(doc(db, 'retros', retroId), {
      coHosts: alreadyCoHost ? arrayRemove(userId) : arrayUnion(userId),
    }).catch(console.error);
  }, [retroId]);

  const handoverTo = useCallback((userId) => {
    updateDoc(doc(db, 'retros', retroId), {
      activeHostId: userId,
    }).catch(console.error);
  }, [retroId]);

  const addActionItem = useCallback((text) => {
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

  const toggleActionItem = useCallback((itemId) => {
    const current = retroStateRef.current;
    const item = current?.previousActionItems?.[itemId];
    if (!item) return;
    updateDoc(doc(db, 'retros', retroId), {
      [`previousActionItems.${itemId}.done`]: !item.done,
    }).catch(console.error);
  }, [retroId]);

  const deleteActionItem = useCallback((itemId) => {
    updateDoc(doc(db, 'retros', retroId), {
      [`previousActionItems.${itemId}`]: deleteField(),
    }).catch(console.error);
  }, [retroId]);

  const startTimer = useCallback((duration) => {
    updateDoc(doc(db, 'retros', retroId), {
      timer: { duration, startedAt: Date.now(), running: true },
    }).catch(console.error);
  }, [retroId]);

  const stopTimer = useCallback(() => {
    updateDoc(doc(db, 'retros', retroId), {
      timer: { duration: 0, startedAt: 0, running: false },
    }).catch(console.error);
  }, [retroId]);

  return {
    retroState, status, role,
    addCard, deleteCard, editCard, toggleVote,
    updateColumns, updateSettings, revealCards,
    makeCoHost, handoverTo, startTimer, stopTimer,
    addActionItem, toggleActionItem, deleteActionItem,
  };
}

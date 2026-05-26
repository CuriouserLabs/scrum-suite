import { useEffect, useRef, useState, useCallback } from 'react';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot,
  runTransaction, serverTimestamp, arrayUnion, arrayRemove, deleteField,
} from 'firebase/firestore';
import { db } from '../utils/firebase';

// Convert Firestore participants map → array the UI expects
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

export function useRoom(roomId, user) {
  const [role, setRole] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [status, setStatus] = useState('connecting');
  const roomStateRef = useRef(null); // stable ref for callbacks

  useEffect(() => {
    const roomRef = doc(db, 'rooms', roomId);
    let unsubscribe = null;
    let left = false;

    async function init() {
      const snap = await getDoc(roomRef);

      if (left) return;

      const isStaleEmpty = snap.exists()
        && Object.keys(snap.data().participants || {}).length === 0;

      if (!snap.exists() || isStaleEmpty) {
        // Room does not exist, or was abandoned (all participants left via
        // browser crash — empty participants map left behind). Claim as host.
        await setDoc(roomRef, {
          hostId: user.id,
          participants: {
            [user.id]: { displayName: user.displayName, isHost: true },
          },
          votes: {},
          revealed: false,
          round: 1,
          storyTitle: '',
          coHosts: [],
          createdAt: serverTimestamp(),
        });
        setRole('host');
        setStatus('ready');
      } else {
        // Active room — join as participant (or rejoin as host/co-host)
        const data = snap.data();
        const isOriginalHost = data.hostId === user.id;
        const isCoHost = data.coHosts?.includes(user.id);
        setRole(isOriginalHost || isCoHost ? 'host' : 'client');
        setStatus('connected');

        // Register ourselves if not already in participants
        if (!data.participants?.[user.id]) {
          await updateDoc(roomRef, {
            [`participants.${user.id}`]: {
              displayName: user.displayName,
              isHost: isOriginalHost,
            },
          });
        }
      }

      if (left) return;

      // Real-time listener
      unsubscribe = onSnapshot(roomRef, (snap) => {
        if (!snap.exists()) {
          setStatus('disconnected');
          return;
        }
        const data = snap.data();
        // Re-evaluate role whenever state updates (co-host may have changed)
        const isOriginalHost = data.hostId === user.id;
        const isCoHost = data.coHosts?.includes(user.id);
        setRole(isOriginalHost || isCoHost ? 'host' : 'client');

        const normalized = normalizeState(data);
        roomStateRef.current = normalized;
        setRoomState(normalized);
      }, () => {
        setStatus('error');
      });
    }

    init().catch(() => { if (!left) setStatus('error'); });

    return () => {
      left = true;
      unsubscribe?.();
      // Atomically remove self; delete the whole room if we were the last one.
      runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return;
        const remaining = Object.keys(snap.data().participants || {})
          .filter((id) => id !== user.id);
        if (remaining.length === 0) {
          tx.delete(roomRef);
        } else {
          tx.update(roomRef, {
            [`participants.${user.id}`]: deleteField(),
            [`votes.${user.id}`]: deleteField(),
          });
        }
      }).catch(() => {});
    };
  }, [roomId, user.id, user.displayName]);

  const submitVote = useCallback((value) => {
    updateDoc(doc(db, 'rooms', roomId), {
      [`votes.${user.id}`]: value,
    }).catch(console.error);
  }, [roomId, user.id]);

  const revealVotes = useCallback(() => {
    updateDoc(doc(db, 'rooms', roomId), { revealed: true }).catch(console.error);
  }, [roomId]);

  const resetRound = useCallback(() => {
    const current = roomStateRef.current;
    updateDoc(doc(db, 'rooms', roomId), {
      votes: {},
      revealed: false,
      round: (current?.round ?? 1) + 1,
    }).catch(console.error);
  }, [roomId]);

  const setStoryTitle = useCallback((title) => {
    updateDoc(doc(db, 'rooms', roomId), { storyTitle: title }).catch(console.error);
  }, [roomId]);

  const makeCoHost = useCallback((userId) => {
    const current = roomStateRef.current;
    const alreadyCoHost = current?.coHosts?.includes(userId);
    updateDoc(doc(db, 'rooms', roomId), {
      coHosts: alreadyCoHost ? arrayRemove(userId) : arrayUnion(userId),
    }).catch(console.error);
  }, [roomId]);

  return { roomState, status, role, submitVote, revealVotes, resetRound, setStoryTitle, makeCoHost };
}

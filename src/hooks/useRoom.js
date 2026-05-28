import { useEffect, useRef, useState, useCallback } from 'react';
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../utils/firebase';

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
  const roomStateRef = useRef(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    const roomRef = doc(db, 'rooms', roomId);
    let unsubscribe = null;
    let left = false;
    joinedRef.current = false;

    async function init() {
      const snap = await getDoc(roomRef);

      if (left) return;

      if (!snap.exists()) {
        await setDoc(roomRef, {
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
          votes: {},
          revealed: false,
          round: 1,
          storyTitle: '',
          coHosts: [],
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

        const isOriginalHost = data.hostId === user.id;
        const activeHostId = data.activeHostId || data.hostId;
        const isActiveHost = activeHostId === user.id;
        const isCoHost = data.coHosts?.includes(user.id);
        setRole(isActiveHost || isCoHost ? 'host' : 'client');

        if (data.participants?.[user.id]) {
          await updateDoc(roomRef, {
            [`participants.${user.id}.online`]: true,
            [`participants.${user.id}.displayName`]: user.displayName,
            [`participants.${user.id}.photoURL`]: user.photoURL || null,
          });
        } else {
          await updateDoc(roomRef, {
            [`participants.${user.id}`]: {
              displayName: user.displayName,
              photoURL: user.photoURL || null,
              isHost: isOriginalHost,
              online: true,
            },
            participantIds: arrayUnion(user.id),
          });
        }
        joinedRef.current = true;
        setStatus('connected');
      }

      if (left) return;

      unsubscribe = onSnapshot(roomRef, (snap) => {
        if (!snap.exists()) {
          setStatus('disconnected');
          return;
        }
        const data = snap.data();

        if (data.status === 'ended') {
          setStatus('ended');
          const normalized = normalizeState(data);
          roomStateRef.current = normalized;
          setRoomState(normalized);
          return;
        }

        const activeHostId = data.activeHostId || data.hostId;
        const isActiveHost = activeHostId === user.id;
        const isCoHost = data.coHosts?.includes(user.id);
        setRole(isActiveHost || isCoHost ? 'host' : 'client');

        const normalized = normalizeState(data);
        roomStateRef.current = normalized;
        setRoomState(normalized);
      }, (err) => {
        console.error('Room listener error:', err);
        setStatus('error');
      });
    }

    init().catch((err) => {
      console.error('Room init error:', err);
      if (!left) setStatus('error');
    });

    return () => {
      left = true;
      unsubscribe?.();
      if (joinedRef.current) {
        updateDoc(roomRef, {
          [`participants.${user.id}.online`]: false,
        }).catch(() => {});
      }
    };
  }, [roomId, user.id, user.displayName, user.photoURL]);

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

  const handoverTo = useCallback((userId) => {
    updateDoc(doc(db, 'rooms', roomId), {
      activeHostId: userId,
    }).catch(console.error);
  }, [roomId]);

  return { roomState, status, role, submitVote, revealVotes, resetRound, setStoryTitle, makeCoHost, handoverTo };
}

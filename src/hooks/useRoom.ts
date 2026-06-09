import { useEffect, useRef, useState, useCallback } from 'react';
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../utils/firebase';
import type {
  User, Role, ConnectionState, RoomDoc, RoomState, VoteValue, UseRoomResult,
} from '../types';

function normalizeState(data: RoomDoc | undefined): RoomState | null {
  if (!data) return null;
  return {
    ...data,
    participants: Object.entries(data.participants || {}).map(([id, p]) => ({
      id,
      ...p,
    })),
  };
}

export function useRoom(roomId: string, user: User): UseRoomResult {
  const [role, setRole] = useState<Role | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<ConnectionState>('connecting');
  const roomStateRef = useRef<RoomState | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    const roomRef = doc(db, 'rooms', roomId);
    let unsubscribe: (() => void) | null = null;
    let left = false;
    joinedRef.current = false;

    async function init() {
      const snap = await getDoc(roomRef);

      if (left) return;

      if (!snap.exists()) {
        // Guests can only join existing sessions, never create one.
        if (user.isGuest) {
          setStatus('disconnected');
          return;
        }
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
              isGuest: false,
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
        const data = snap.data() as RoomDoc;

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
              isGuest: user.isGuest,
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
        const data = snap.data() as RoomDoc;

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
      // Don't mark offline if the session was ended — it's frozen.
      if (joinedRef.current && roomStateRef.current?.status !== 'ended') {
        updateDoc(roomRef, {
          [`participants.${user.id}.online`]: false,
        }).catch(() => {});
      }
    };
  }, [roomId, user.id, user.displayName, user.photoURL, user.isGuest]);

  const isEnded = () => roomStateRef.current?.status === 'ended';

  const endSession = useCallback(() => {
    updateDoc(doc(db, 'rooms', roomId), { status: 'ended' }).catch(console.error);
  }, [roomId]);

  const submitVote = useCallback((value: VoteValue) => {
    if (isEnded()) return;
    updateDoc(doc(db, 'rooms', roomId), {
      [`votes.${user.id}`]: value,
    }).catch(console.error);
  }, [roomId, user.id]);

  const revealVotes = useCallback(() => {
    if (isEnded()) return;
    updateDoc(doc(db, 'rooms', roomId), { revealed: true }).catch(console.error);
  }, [roomId]);

  const resetRound = useCallback(() => {
    if (isEnded()) return;
    const current = roomStateRef.current;
    updateDoc(doc(db, 'rooms', roomId), {
      votes: {},
      revealed: false,
      round: (current?.round ?? 1) + 1,
    }).catch(console.error);
  }, [roomId]);

  const setStoryTitle = useCallback((title: string) => {
    if (isEnded()) return;
    updateDoc(doc(db, 'rooms', roomId), { storyTitle: title }).catch(console.error);
  }, [roomId]);

  const makeCoHost = useCallback((userId: string) => {
    if (isEnded()) return;
    const current = roomStateRef.current;
    const alreadyCoHost = current?.coHosts?.includes(userId);
    updateDoc(doc(db, 'rooms', roomId), {
      coHosts: alreadyCoHost ? arrayRemove(userId) : arrayUnion(userId),
    }).catch(console.error);
  }, [roomId]);

  const handoverTo = useCallback((userId: string) => {
    if (isEnded()) return;
    updateDoc(doc(db, 'rooms', roomId), {
      activeHostId: userId,
    }).catch(console.error);
  }, [roomId]);

  return { roomState, status, role, endSession, submitVote, revealVotes, resetRound, setStoryTitle, makeCoHost, handoverTo };
}

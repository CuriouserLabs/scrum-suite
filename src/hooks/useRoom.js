import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { roomPeerId, send, broadcast } from '../utils/peerUtils';

const INITIAL_STATE = (user) => ({
  participants: [{ id: user.id, displayName: user.displayName, isHost: true }],
  votes: {},
  revealed: false,
  round: 1,
  storyTitle: '',
});

export function useRoom(roomId, user) {
  const peerRef = useRef(null);
  const roleRef = useRef(null);           // 'host' | 'client'
  const connsRef = useRef({});            // host: peerId→conn map
  const connRef = useRef(null);           // client: single conn to host
  const stateRef = useRef(null);

  const [role, setRole] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [status, setStatus] = useState('connecting');

  const pushState = useCallback((next) => {
    stateRef.current = next;
    setRoomState(next);
    broadcast(connsRef.current, { type: 'state', payload: next });
  }, []);

  const updateState = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(stateRef.current) : updater;
    pushState(next);
  }, [pushState]);

  useEffect(() => {
    let destroyed = false;

    // --- Try to claim the host peer ID ---
    const peer = new Peer(roomPeerId(roomId));
    peerRef.current = peer;

    peer.on('open', () => {
      if (destroyed) return;
      // Successfully claimed the host ID → we are host
      roleRef.current = 'host';
      setRole('host');
      setStatus('ready');
      const initial = INITIAL_STATE(user);
      stateRef.current = initial;
      setRoomState(initial);
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        connsRef.current[conn.peer] = conn;
        send(conn, { type: 'state', payload: stateRef.current });
      });

      conn.on('data', (msg) => {
        if (msg.type === 'join') {
          updateState((prev) => {
            if (prev.participants.find((p) => p.id === msg.user.id)) return prev;
            return { ...prev, participants: [...prev.participants, msg.user] };
          });
        } else if (msg.type === 'vote') {
          updateState((prev) => ({
            ...prev,
            votes: { ...prev.votes, [msg.userId]: msg.value },
          }));
        } else if (msg.type === 'leave') {
          updateState((prev) => ({
            ...prev,
            participants: prev.participants.filter((p) => p.id !== msg.userId),
            votes: Object.fromEntries(
              Object.entries(prev.votes).filter(([k]) => k !== msg.userId)
            ),
          }));
        }
      });

      conn.on('close', () => {
        delete connsRef.current[conn.peer];
      });
    });

    peer.on('error', (err) => {
      if (destroyed) return;
      if (err.type === 'unavailable-id') {
        // Host ID taken → join as client
        roleRef.current = 'client';
        setRole('client');
        setStatus('connecting');

        const conn = peer.connect(roomPeerId(roomId), { reliable: true });
        connRef.current = conn;

        conn.on('open', () => {
          if (destroyed) return;
          setStatus('connected');
          send(conn, {
            type: 'join',
            user: { id: user.id, displayName: user.displayName, isHost: false },
          });
        });

        conn.on('data', (msg) => {
          if (msg.type === 'state') setRoomState(msg.payload);
        });

        conn.on('close', () => { if (!destroyed) setStatus('disconnected'); });
        conn.on('error', () => { if (!destroyed) setStatus('error'); });
      } else {
        setStatus('error');
      }
    });

    return () => {
      destroyed = true;
      if (connRef.current?.open) {
        send(connRef.current, { type: 'leave', userId: user.id });
      }
      peer.destroy();
    };
  }, [roomId, user.id, user.displayName, updateState]);

  const submitVote = useCallback((value) => {
    if (roleRef.current === 'host') {
      updateState((prev) => ({
        ...prev,
        votes: { ...prev.votes, [user.id]: value },
      }));
    } else {
      send(connRef.current, { type: 'vote', userId: user.id, value });
    }
  }, [user.id, updateState]);

  const revealVotes = useCallback(() => {
    updateState((prev) => ({ ...prev, revealed: true }));
  }, [updateState]);

  const resetRound = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      votes: {},
      revealed: false,
      round: prev.round + 1,
    }));
  }, [updateState]);

  const setStoryTitle = useCallback((title) => {
    updateState((prev) => ({ ...prev, storyTitle: title }));
  }, [updateState]);

  return { roomState, status, role, submitVote, revealVotes, resetRound, setStoryTitle };
}

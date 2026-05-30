import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useUser } from '../contexts/UserContext';
import './HomePage.css';

function useActiveSessions(userId, mode) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!mode || !userId) {
      return;
    }

    const col = mode === 'poker' ? 'rooms' : 'retros';
    const q = query(
      collection(db, col),
      where('participantIds', 'array-contains', userId),
      where('status', '==', 'active'),
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const results = snap.docs.map((d) => {
        const data = d.data();
        const participants = Object.entries(data.participants || {});
        const onlineCount = participants.filter(([, p]) => p.online).length;
        return {
          id: d.id,
          totalParticipants: participants.length,
          onlineCount,
          createdAt: data.createdAt?.toDate?.() || null,
          isHost: data.hostId === userId,
          storyTitle: data.storyTitle,
          round: data.round,
        };
      });
      setSessions(results);
    }, (err) => {
      console.error('Active sessions query failed:', err);
    });

    return () => {
      unsubscribe();
      setSessions([]);
    };
  }, [userId, mode]);

  return { sessions };
}

function formatTimeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function HomePage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [confirmingEndId, setConfirmingEndId] = useState(null);
  const confirmEndTimerRef = useRef(null);
  const { sessions } = useActiveSessions(user.id, selectedMode);

  const createSession = () => {
    const id = nanoid(8);
    const path = selectedMode === 'poker' ? `/room/${id}` : `/retro/${id}`;
    navigate(path);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    const input = joinCode.trim();
    if (!input) return;

    const match = input.match(/\/(room|retro)\/([a-zA-Z0-9_-]{8,})/);
    if (match) {
      navigate(`/${match[1]}/${match[2]}`);
      return;
    }

    if (input.length < 6) {
      setJoinError('Invalid code. Please check the link and try again.');
      return;
    }

    const path = selectedMode === 'poker' ? `/room/${input}` : `/retro/${input}`;
    navigate(path);
  };

  const rejoinSession = (sessionId) => {
    const path = selectedMode === 'poker' ? `/room/${sessionId}` : `/retro/${sessionId}`;
    navigate(path);
  };

  const handleEndSession = (e, sessionId) => {
    e.stopPropagation();
    if (confirmingEndId !== sessionId) {
      clearTimeout(confirmEndTimerRef.current);
      setConfirmingEndId(sessionId);
      confirmEndTimerRef.current = setTimeout(() => setConfirmingEndId(null), 3000);
    } else {
      clearTimeout(confirmEndTimerRef.current);
      setConfirmingEndId(null);
      const col = selectedMode === 'poker' ? 'rooms' : 'retros';
      updateDoc(doc(db, col, sessionId), { status: 'ended' }).catch(console.error);
    }
  };

  const resetMode = () => {
    clearTimeout(confirmEndTimerRef.current);
    setConfirmingEndId(null);
    setSelectedMode(null);
    setJoinCode('');
    setJoinError('');
  };

  return (
    <div className="home-page">
      <div className="home-hero">
        <h1>Plan smarter,<br />ship faster.</h1>
        <p className="home-tagline">
          Real-time collaboration for agile teams — no logins, no setup, just paste a link.
        </p>
      </div>

      {!selectedMode ? (
        <div className="mode-selector">
          <button className="mode-card mode-poker" onClick={() => setSelectedMode('poker')}>
            <div className="mode-icon">&#9827;</div>
            <h2>Sprint Poker</h2>
            <p>Estimate story points together with your team in real time.</p>
          </button>

          <button className="mode-card mode-retro" onClick={() => setSelectedMode('retro')}>
            <div className="mode-icon">&#128260;</div>
            <h2>Retro Board</h2>
            <p>Reflect on your sprint — what went well, what to improve.</p>
          </button>
        </div>
      ) : (
        <div className="session-actions">
          <button className="back-to-modes" onClick={resetMode}>
            ← Back
          </button>

          <div className="session-mode-badge" data-mode={selectedMode}>
            {selectedMode === 'poker' ? '♣ Sprint Poker' : '🔄 Retro Board'}
          </div>

          {sessions.length > 0 && (
            <div className="active-sessions">
              <h3 className="active-sessions-title">Your active sessions</h3>
              <div className="active-sessions-list">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="active-session-card"
                    data-mode={selectedMode}
                    role="button"
                    tabIndex={0}
                    onClick={() => rejoinSession(s.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') rejoinSession(s.id); }}
                  >
                    <div className="active-session-top">
                      <span className="active-session-code">{s.id}</span>
                      {s.isHost && <span className="active-session-host-badge">host</span>}
                      <span className="active-session-time">{formatTimeAgo(s.createdAt)}</span>
                      {s.isHost && (
                        <button
                          className={`active-session-end-btn ${confirmingEndId === s.id ? 'confirming' : ''}`}
                          onClick={(e) => handleEndSession(e, s.id)}
                        >
                          {confirmingEndId === s.id ? 'Tap again to end' : 'End'}
                        </button>
                      )}
                    </div>
                    {selectedMode === 'poker' && s.storyTitle && (
                      <div className="active-session-story">{s.storyTitle}</div>
                    )}
                    <div className="active-session-bottom">
                      <span className="active-session-participants">
                        <span className="active-session-online-dot" />
                        {s.onlineCount} online
                        <span className="active-session-total"> / {s.totalParticipants} total</span>
                      </span>
                      {selectedMode === 'poker' && s.round > 1 && (
                        <span className="active-session-round">Round {s.round}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="home-actions">
            <div className="action-card create-card">
              <div className="action-icon">{selectedMode === 'poker' ? '♣' : '🔄'}</div>
              <h2>{selectedMode === 'poker' ? 'Create a Room' : 'Create a Retro'}</h2>
              <p>
                {selectedMode === 'poker'
                  ? 'Start a new planning session and share the link with your team.'
                  : 'Start a new retrospective and invite your team to reflect.'}
              </p>
              <button className="btn-primary" onClick={createSession}>
                {selectedMode === 'poker' ? 'Create Room' : 'Create Retro'}
              </button>
            </div>

            <div className="action-divider">or</div>

            <div className="action-card join-card">
              <div className="action-icon">&#128279;</div>
              <h2>Join a Session</h2>
              <p>Paste a session link or code to join an existing session.</p>
              <form onSubmit={handleJoin}>
                <input
                  type="text"
                  placeholder="Paste session link or code"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value);
                    setJoinError('');
                  }}
                />
                {joinError && <p className="join-error">{joinError}</p>}
                <button className="btn-secondary" type="submit" disabled={!joinCode.trim()}>
                  Join Session
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="home-footer-tip">
        Signed in as <strong>{user.displayName}</strong>
      </div>
    </div>
  );
}

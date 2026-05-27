import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useRoom } from '../hooks/useRoom';
import ConnectionStatus from '../components/ConnectionStatus';
import VotingDeck from '../components/VotingDeck';
import VoteBoard from '../components/VoteBoard';
import './RoomPage.css';

export default function RoomPage() {
  const { roomId } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);
  const deckHeightRef = useRef(210);
  const [deckHeight, setDeckHeight] = useState(210);

  const handleDividerDrag = useCallback((e) => {
    const startY = e.clientY;
    const startHeight = deckHeightRef.current;

    const onMove = (ev) => {
      const delta = startY - ev.clientY;
      const next = Math.min(340, Math.max(130, startHeight + delta));
      deckHeightRef.current = next;
      setDeckHeight(next);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const { roomState, status, role, submitVote, revealVotes, resetRound, setStoryTitle, makeCoHost, handoverTo } =
    useRoom(roomId, user);

  const isHost = role === 'host';
  const activeHostId = roomState?.activeHostId || roomState?.hostId;
  const isActiveHost = activeHostId === user.id; // current holder of primary control
  const myVote = roomState?.votes?.[user.id];
  const hasAnyVote = roomState && Object.keys(roomState.votes).length > 0;

  // Local story title — prevents cursor-jump from Firestore echo
  const [localTitle, setLocalTitle] = useState('');
  const lastWrittenTitleRef = useRef('');
  const titleDebounceRef = useRef(null);
  useEffect(() => {
    const remote = roomState?.storyTitle || '';
    if (remote !== lastWrittenTitleRef.current) {
      lastWrittenTitleRef.current = remote;
      setLocalTitle(remote);
    }
  }, [roomState?.storyTitle]);
  const handleTitleChange = (e) => {
    const val = e.target.value;
    setLocalTitle(val);
    lastWrittenTitleRef.current = val;
    clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = setTimeout(() => setStoryTitle(val), 400);
  };

  // Dynamic page title
  useEffect(() => {
    document.title = `Room ${roomId} · Scrum Suite`;
    return () => { document.title = 'Scrum Suite'; };
  }, [roomId]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const prevCountRef = useRef(0);
  useEffect(() => {
    if (!roomState) return;
    const count = roomState.participants.length;
    if (count > prevCountRef.current) {
      const newcomer = roomState.participants[count - 1];
      if (newcomer && newcomer.id !== user.id) {
        setTimeout(() => showToast(`${newcomer.displayName} joined`), 0);
      }
      prevCountRef.current = count;
    }
  }, [roomState, user.id]);

  const copyLink = async () => {
    const url = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'disconnected') {
    return (
      <div className="room-overlay">
        <div className="room-overlay-card">
          <div className="overlay-icon">🔒</div>
          <h2>Session Ended</h2>
          <p>The room host has left. The session is over.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="room-overlay">
        <div className="room-overlay-card">
          <div className="overlay-icon">⚠️</div>
          <h2>Connection Failed</h2>
          <p>Could not connect to this room. The link may be invalid or the session may have ended.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="room-page">
      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Sub-header */}
      <div className="room-header">
        <div className="room-info">
          <button className="back-btn" onClick={() => navigate('/')} title="Leave room">←</button>
          <div>
            <span className="room-label">Room</span>
            <span className="room-code">{roomId}</span>
          </div>
          <ConnectionStatus status={status} role={role} />
        </div>
        <button className="copy-btn" onClick={copyLink}>
          {copied ? '✓ Copied!' : '🔗 Copy Link'}
        </button>
      </div>

      <div className="room-body">
        {/* Participants sidebar */}
        <aside className="participants-panel">
          <h3>Team ({roomState?.participants?.length ?? 0})</h3>
          <div className="participant-list">
            {roomState?.participants?.map((p) => {
              const voted = roomState.votes[p.id] !== undefined;
              const isMe = p.id === user.id;
              const pIsCoHost = roomState.coHosts?.includes(p.id);
              const pIsActiveHost = p.id === activeHostId;
              return (
                <div key={p.id} className={`participant-item ${isMe ? 'self' : ''} ${voted ? 'has-voted' : ''}`}>
                  <div className="participant-avatar" style={{ background: avatarColor(p.id) }}>
                    {getInitials(p.displayName)}
                  </div>
                  <div className="participant-meta">
                    <span className="participant-name">
                      <span className="participant-name-text">{p.displayName}</span>
                      {isMe && <em>(you)</em>}
                    </span>
                    <div className="participant-badges">
                      {pIsActiveHost && <span className="lead-badge">lead</span>}
                      {p.isHost && !pIsActiveHost && <span className="host-badge">host</span>}
                      {pIsCoHost && <span className="cohost-badge">co-host</span>}
                    </div>
                  </div>
                  <div className="participant-actions">
                    {/* Handover — only the active host can transfer primary control */}
                    {isActiveHost && !isMe && (
                      <button
                        className="handover-btn"
                        onClick={() => handoverTo(p.id)}
                        title={`Hand over control to ${p.displayName}`}
                      >
                        →
                      </button>
                    )}
                    {/* Co-host toggle — any host can manage backup hosts */}
                    {isHost && !p.isHost && (
                      <button
                        className={`cohost-toggle ${pIsCoHost ? 'active' : ''}`}
                        onClick={() => makeCoHost(p.id)}
                        title={pIsCoHost ? 'Remove co-host' : 'Make co-host'}
                      >
                        {pIsCoHost ? '★' : '☆'}
                      </button>
                    )}
                    <span
                      className={`vote-indicator ${voted ? 'voted' : 'waiting'}`}
                      title={voted ? 'Voted ✓' : 'Waiting…'}
                    >
                      {voted ? '✓' : '·'}
                    </span>
                  </div>
                </div>
              );
            })}
            {!roomState && <p className="participants-hint">Connecting…</p>}
            {roomState?.participants?.length <= 1 && (
              <p className="participants-hint">Share the link for others to join.</p>
            )}
          </div>
        </aside>

        {/* Main voting area — always split into two zones */}
        <main className="voting-area">
          {!roomState ? (
            <div className="voting-placeholder">
              <div className="spinner" />
              <p>Connecting to room…</p>
            </div>
          ) : (
            <>
              {/* Zone 1 — team vote cards (face-down → reveal) */}
              <div className="zone-votes">
                {/* Story title */}
                {isHost ? (
                  <input
                    className="story-title-input"
                    placeholder="What are we estimating? (optional)"
                    value={localTitle}
                    onChange={handleTitleChange}
                    maxLength={80}
                  />
                ) : roomState.storyTitle ? (
                  <div className="story-title-display">{roomState.storyTitle}</div>
                ) : null}

                <VoteBoard roomState={roomState} userId={user.id} />
              </div>

              {/* Draggable divider */}
              <div className="zone-divider" onMouseDown={handleDividerDrag} />

              {/* Zone 2 — this user's voting deck */}
              <div className="zone-deck" style={{ height: `${deckHeight}px` }}>
                <p className="voting-hint">
                  {roomState.revealed
                    ? 'Round complete — host can start a new round'
                    : myVote !== undefined
                    ? 'Your vote is in — change it anytime before reveal'
                    : 'Pick your estimate'}
                </p>
                <VotingDeck
                  selectedValue={myVote}
                  onVote={submitVote}
                  disabled={roomState.revealed}
                />
              </div>
            </>
          )}
        </main>
      </div>

      {/* Footer controls */}
      <div className="room-footer">
        {isHost ? (
          <>
            <div className="footer-round-badge">Round {roomState?.round ?? 1}</div>
            <button
              className="btn-reveal"
              onClick={revealVotes}
              disabled={!hasAnyVote || roomState?.revealed}
              title={!hasAnyVote ? 'Waiting for at least one vote' : ''}
            >
              Reveal Votes
            </button>
            <button className="btn-reset" onClick={resetRound} disabled={!roomState}>
              New Round
            </button>
          </>
        ) : (
          <p className="guest-footer-note">
            {roomState?.revealed
              ? '📊 Votes revealed · Waiting for host to start next round'
              : myVote !== undefined
              ? `✓ You voted · Waiting for host to reveal`
              : 'Select a card to cast your vote'}
          </p>
        )}
      </div>
    </div>
  );
}

function getInitials(name) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(id) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

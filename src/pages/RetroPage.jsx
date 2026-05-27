import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useRetro } from '../hooks/useRetro';
import { getColumnById } from '../utils/retroColumns';
import ConnectionStatus from '../components/ConnectionStatus';
import RetroColumn from '../components/RetroColumn';
import RetroHostControls from '../components/RetroHostControls';
import RetroTimer from '../components/RetroTimer';
import PreviousActionItems from '../components/PreviousActionItems';
import './RetroPage.css';

export default function RetroPage() {
  const { retroId } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('board');

  const {
    retroState, status, role,
    addCard, deleteCard, editCard, toggleVote,
    updateColumns, updateSettings, revealCards,
    startTimer, stopTimer,
    addActionItem, toggleActionItem, deleteActionItem,
  } = useRetro(retroId, user);

  const isHost = role === 'host';
  const activeHostId = retroState?.activeHostId || retroState?.hostId;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    document.title = `Retro ${retroId} · Scrum Suite`;
    return () => { document.title = 'Scrum Suite'; };
  }, [retroId]);

  const prevCountRef = useRef(0);
  useEffect(() => {
    if (!retroState) return;
    const count = retroState.participants.length;
    if (count > prevCountRef.current) {
      const newcomer = retroState.participants[count - 1];
      if (newcomer && newcomer.id !== user.id) {
        setTimeout(() => showToast(`${newcomer.displayName} joined`), 0);
      }
      prevCountRef.current = count;
    }
  }, [retroState, user.id]);

  const prevRevealedRef = useRef(null);
  useEffect(() => {
    if (!retroState) return;
    const revealed = retroState.settings?.revealed;
    if (prevRevealedRef.current === false && revealed === true) {
      setTimeout(() => showToast('Cards revealed!'), 0);
    }
    prevRevealedRef.current = revealed;
  }, [retroState]);

  const copyLink = async () => {
    const url = `${window.location.origin}/retro/${retroId}`;
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

  const getCardsForColumn = (columnId) => {
    if (!retroState?.cards) return [];
    return Object.entries(retroState.cards)
      .filter(([, c]) => c.columnId === columnId)
      .map(([id, c]) => {
        const author = retroState.participants.find((p) => p.id === c.authorId);
        return { ...c, id, authorName: author?.displayName || '' };
      });
  };

  const getCardCountForUser = (userId) => {
    if (!retroState?.cards) return 0;
    return Object.values(retroState.cards).filter((c) => c.authorId === userId).length;
  };

  if (status === 'disconnected') {
    return (
      <div className="retro-overlay">
        <div className="retro-overlay-card">
          <div className="retro-overlay-icon">🔒</div>
          <h2>Session Ended</h2>
          <p>The retro host has left. The session is over.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="retro-overlay">
        <div className="retro-overlay-card">
          <div className="retro-overlay-icon">⚠️</div>
          <h2>Connection Failed</h2>
          <p>Could not connect to this retro. The link may be invalid or the session may have ended.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    );
  }

  const activeColumns = (retroState?.columns || [])
    .map(getColumnById)
    .filter(Boolean);

  return (
    <div className="retro-page">
      {toast && <div className="retro-toast">{toast}</div>}

      {/* Sub-header */}
      <div className="retro-header">
        <div className="retro-info">
          <button className="back-btn" onClick={() => navigate('/')} title="Leave retro">←</button>
          <div>
            <span className="retro-label">Retro</span>
            <span className="retro-code">{retroId}</span>
          </div>
          <ConnectionStatus status={status} role={role} />
        </div>
        <RetroTimer
          timer={retroState?.timer}
          isHost={isHost}
          onStart={startTimer}
          onStop={stopTimer}
        />
        <button className="copy-btn" onClick={copyLink}>
          {copied ? '✓ Copied!' : '🔗 Copy Link'}
        </button>
      </div>

      <div className="retro-tabs">
        <button
          className={`retro-tab ${activeTab === 'board' ? 'retro-tab--active' : ''}`}
          onClick={() => setActiveTab('board')}
        >
          Retro Board
        </button>
        <button
          className={`retro-tab ${activeTab === 'action-items' ? 'retro-tab--active' : ''}`}
          onClick={() => setActiveTab('action-items')}
        >
          Previous Action Items
          {retroState?.previousActionItems && Object.keys(retroState.previousActionItems).length > 0 && (
            <span className="retro-tab__badge">
              {Object.keys(retroState.previousActionItems).length}
            </span>
          )}
        </button>
      </div>

      <div className="retro-body">
        {/* Participants sidebar */}
        <aside className="retro-participants">
          <h3>Team ({retroState?.participants?.length ?? 0})</h3>
          <div className="retro-participant-list">
            {retroState?.participants?.map((p) => {
              const isMe = p.id === user.id;
              const pIsActiveHost = p.id === activeHostId;
              const pIsCoHost = retroState.coHosts?.includes(p.id);
              const cardCount = getCardCountForUser(p.id);
              return (
                <div key={p.id} className={`retro-participant ${isMe ? 'self' : ''}`}>
                  <div className="retro-participant-avatar" style={{ background: avatarColor(p.id) }}>
                    {getInitials(p.displayName)}
                  </div>
                  <div className="retro-participant-meta">
                    <span className="retro-participant-name">
                      <span className="retro-participant-name-text">{p.displayName}</span>
                      {isMe && <em>(you)</em>}
                    </span>
                    <div className="retro-participant-badges">
                      {pIsActiveHost && <span className="lead-badge">lead</span>}
                      {p.isHost && !pIsActiveHost && <span className="host-badge">host</span>}
                      {pIsCoHost && <span className="cohost-badge">co-host</span>}
                    </div>
                  </div>
                  <span className="retro-participant-card-count" title="Cards added">
                    {cardCount}
                  </span>
                </div>
              );
            })}
            {!retroState && <p className="retro-participants-hint">Connecting…</p>}
            {retroState?.participants?.length <= 1 && (
              <p className="retro-participants-hint">Share the link for others to join.</p>
            )}
          </div>
        </aside>

        {/* Main area — switches between retro board and action items */}
        <main className="retro-board">
          {!retroState ? (
            <div className="retro-loading">
              <div className="spinner" />
              <p>Connecting to retro…</p>
            </div>
          ) : activeTab === 'action-items' ? (
            <PreviousActionItems
              items={retroState.previousActionItems || {}}
              isHost={isHost}
              onAdd={addActionItem}
              onToggle={toggleActionItem}
              onDelete={deleteActionItem}
            />
          ) : (
            <div className="retro-columns">
              {activeColumns.map((col) => (
                <RetroColumn
                  key={col.id}
                  column={col}
                  cards={getCardsForColumn(col.id)}
                  userId={user.id}
                  isHost={isHost}
                  anonymous={retroState.settings?.anonymous}
                  hideCards={retroState.settings?.hideCards}
                  revealed={retroState.settings?.revealed}
                  onAddCard={addCard}
                  onDeleteCard={deleteCard}
                  onEditCard={editCard}
                  onToggleVote={toggleVote}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <div className="retro-footer">
        {isHost ? (
          <RetroHostControls
            retroState={retroState}
            updateColumns={updateColumns}
            updateSettings={updateSettings}
            revealCards={revealCards}
          />
        ) : (
          <p className="retro-guest-note">Add your thoughts to the columns above</p>
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

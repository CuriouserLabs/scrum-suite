import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthUser } from '../contexts/UserContext';
import { useRetro } from '../hooks/useRetro';
import { getColumnById } from '../utils/retroColumns';
import ConnectionStatus from '../components/ConnectionStatus';
import RetroColumn from '../components/RetroColumn';
import RetroHostControls from '../components/RetroHostControls';
import RetroTimer from '../components/RetroTimer';
import PreviousActionItems from '../components/PreviousActionItems';
import type { CardWithId, Column } from '../types';
import './RetroPage.css';

export default function RetroPage() {
  const { retroId } = useParams<{ retroId: string }>();
  const user = useAuthUser();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const confirmEndTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const {
    retroState, status, role,
    endSession, updateTitle,
    addCard, deleteCard, editCard, toggleVote,
    updateColumns, updateSettings, revealCards,
    startTimer, stopTimer,
    addActionItem, toggleActionItem, deleteActionItem,
    fetchPreviousRetros, importActionItems,
  } = useRetro(retroId!, user);

  const isHost = role === 'host';
  const activeHostId = retroState?.activeHostId || retroState?.hostId;

  const [localTitle, setLocalTitle] = useState('');
  const titleSourceRef = useRef<'remote' | 'local'>('remote');
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (titleSourceRef.current === 'local') return;
    setLocalTitle(retroState?.title || '');
  }, [retroState?.title]);

  const handleTitleChange = (val: string) => {
    const clamped = val.slice(0, 100);
    titleSourceRef.current = 'local';
    setLocalTitle(clamped);
    clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = setTimeout(() => {
      updateTitle(clamped);
      titleSourceRef.current = 'remote';
    }, 400);
  };

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    const suffix = retroState?.title ? ` — ${retroState.title}` : '';
    document.title = `Retro ${retroId}${suffix} · Scrum Suite`;
    return () => { document.title = 'Scrum Suite'; };
  }, [retroId, retroState?.title]);

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

  const prevRevealedRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!retroState) return;
    const revealed = retroState.settings?.revealed;
    if (prevRevealedRef.current === false && revealed === true) {
      setTimeout(() => showToast('Cards revealed!'), 0);
    }
    prevRevealedRef.current = revealed;
  }, [retroState]);

  const handleEndSession = () => {
    if (!confirmingEnd) {
      setConfirmingEnd(true);
      confirmEndTimerRef.current = setTimeout(() => setConfirmingEnd(false), 3000);
    } else {
      clearTimeout(confirmEndTimerRef.current);
      setConfirmingEnd(false);
      endSession();
    }
  };

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

  const getCardsForColumn = (columnId: string): CardWithId[] => {
    if (!retroState?.cards) return [];
    return Object.entries(retroState.cards)
      .filter(([, c]) => c.columnId === columnId)
      .map(([id, c]) => {
        const author = retroState.participants.find((p) => p.id === c.authorId);
        return { ...c, id, authorName: author?.displayName || '' };
      });
  };

  const getCardCountForUser = (userId: string) => {
    if (!retroState?.cards) return 0;
    return Object.values(retroState.cards).filter((c) => c.authorId === userId).length;
  };

  if (status === 'ended') {
    return (
      <div className="retro-overlay">
        <div className="retro-overlay-card">
          <div className="retro-overlay-icon">🔒</div>
          <h2>Session Ended</h2>
          <p>This retrospective has been closed by the host.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    );
  }

  if (status === 'disconnected') {
    return (
      <div className="retro-overlay">
        <div className="retro-overlay-card">
          <div className="retro-overlay-icon">🔒</div>
          <h2>Retro Not Found</h2>
          <p>This retro does not exist. The link may be invalid.</p>
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
    .filter((col): col is Column => col != null && col.id !== 'previous-actions');

  const showPreviousActionItems = retroState?.columns?.includes('previous-actions');

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
          {isHost ? (
            <input
              className="retro-title-input"
              type="text"
              placeholder="Add a title…"
              value={localTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              maxLength={100}
            />
          ) : (
            localTitle && <span className="retro-title-display">{localTitle}</span>
          )}
        </div>
        <RetroTimer
          timer={retroState?.timer}
          isHost={isHost}
          onStart={startTimer}
          onStop={stopTimer}
        />
        <div className="retro-header-actions">
          <button className="copy-btn" onClick={copyLink}>
            {copied ? '✓ Copied!' : '🔗 Copy Link'}
          </button>
          {isHost && (
            <button
              className={`btn-end-session ${confirmingEnd ? 'confirming' : ''}`}
              onClick={handleEndSession}
            >
              {confirmingEnd ? 'Tap again to end' : 'End Session'}
            </button>
          )}
        </div>
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
                  <div className="retro-participant-avatar-wrap">
                    <div className="retro-participant-avatar" style={{ background: avatarColor(p.id) }}>
                      {getInitials(p.displayName)}
                    </div>
                    <span className={`presence-dot ${p.online ? 'online' : 'offline'}`} title={p.online ? 'Online' : 'Offline'} />
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
                      {p.isGuest && <span className="guest-badge">guest</span>}
                    </div>
                  </div>
                  <span className="retro-participant-card-count" title="Cards added">
                    {cardCount}
                  </span>
                </div>
              );
            })}
            {!retroState && <p className="retro-participants-hint">Connecting…</p>}
            {retroState && retroState.participants.length <= 1 && (
              <p className="retro-participants-hint">Share the link for others to join.</p>
            )}
          </div>
        </aside>

        {/* Main columns area */}
        <main className="retro-board">
          {!retroState ? (
            <div className="retro-loading">
              <div className="spinner" />
              <p>Connecting to retro…</p>
            </div>
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
              {showPreviousActionItems && (
                <PreviousActionItems
                  items={retroState.previousActionItems || {}}
                  isHost={isHost}
                  onAdd={addActionItem}
                  onToggle={toggleActionItem}
                  onDelete={deleteActionItem}
                  onFetchPreviousRetros={fetchPreviousRetros}
                  onImportActionItems={importActionItems}
                />
              )}
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

function getInitials(name: string) {
  return (name || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(id: string) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

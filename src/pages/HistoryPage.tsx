import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthUser } from '../contexts/UserContext';
import { useSessionHistory } from '../hooks/useSessionHistory';
import ExportMenu from '../components/ExportMenu';
import './HistoryPage.css';

type Tab = 'poker' | 'retro';

function formatDate(date: Date | null) {
  if (!date) return 'Unknown date';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function HistoryPage() {
  const user = useAuthUser();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('poker');
  const { poker, retro, loading, error } = useSessionHistory(user.id);

  const count = tab === 'poker' ? poker.length : retro.length;

  return (
    <div className="history-page">
      <div className="history-head">
        <button className="history-back" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1 className="history-title">Session History</h1>
        <p className="history-sub">Your past Sprint Poker rooms and Retro boards.</p>
      </div>

      <div className="history-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'poker'}
          className={`history-tab ${tab === 'poker' ? 'active' : ''}`}
          onClick={() => setTab('poker')}
        >
          ♣ Sprint Poker
          {!loading && <span className="history-tab-count">{poker.length}</span>}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'retro'}
          className={`history-tab ${tab === 'retro' ? 'active' : ''}`}
          onClick={() => setTab('retro')}
        >
          ↻ Retro Board
          {!loading && <span className="history-tab-count">{retro.length}</span>}
        </button>
      </div>

      <div className="history-body">
        {loading && <p className="history-state">Loading your history…</p>}

        {!loading && error && (
          <p className="history-state history-state--error">
            Couldn’t load your history. Please try again later.
          </p>
        )}

        {!loading && !error && count === 0 && (
          <div className="history-empty">
            <div className="history-empty-icon">{tab === 'poker' ? '♣' : '↻'}</div>
            <p>
              No past {tab === 'poker' ? 'Sprint Poker' : 'Retro Board'} sessions yet.
            </p>
            <span className="history-empty-hint">
              Ended sessions you took part in will appear here.
            </span>
          </div>
        )}

        {!loading && !error && tab === 'poker' && poker.length > 0 && (
          <ul className="history-list">
            {poker.map((s) => (
              <li key={s.id} className="history-item" data-mode="poker">
                <div className="history-item-main">
                  <div className="history-item-top">
                    <span className="history-item-code">{s.id}</span>
                    {s.isHost && <span className="history-item-host">host</span>}
                  </div>
                  {s.storyTitle && (
                    <div className="history-item-story">{s.storyTitle}</div>
                  )}
                  <div className="history-item-meta">
                    <span>{formatDate(s.createdAt)}</span>
                    <span className="history-item-dot">·</span>
                    <span>{s.totalParticipants} participant{s.totalParticipants === 1 ? '' : 's'}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && !error && tab === 'retro' && retro.length > 0 && (
          <ul className="history-list">
            {retro.map((s) => (
              <li key={s.id} className="history-item" data-mode="retro">
                <div className="history-item-main">
                  <div className="history-item-top">
                    <span className="history-item-code">{s.title || s.id}</span>
                    {s.isHost && <span className="history-item-host">host</span>}
                  </div>
                  <div className="history-item-meta">
                    <span>{formatDate(s.createdAt)}</span>
                    <span className="history-item-dot">·</span>
                    <span>{s.totalParticipants} participant{s.totalParticipants === 1 ? '' : 's'}</span>
                    <span className="history-item-dot">·</span>
                    <span>{s.cardCount} card{s.cardCount === 1 ? '' : 's'}</span>
                  </div>
                </div>
                <div className="history-item-actions">
                  <ExportMenu retroState={s.state} retroId={s.id} viewerId={user.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

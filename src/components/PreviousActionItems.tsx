import { useState, useRef, useEffect } from 'react';
import type { ActionItem, PreviousRetroSummary } from '../types';
import './PreviousActionItems.css';

const COLUMN_COLOR = '#14b8a6';

interface ImportResult {
  count: number;
  retroId: string;
}

interface PreviousActionItemsProps {
  items: Record<string, ActionItem>;
  isHost: boolean;
  onToggle: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  onFetchPreviousRetros: () => Promise<PreviousRetroSummary[]>;
  onImportActionItems: (sourceRetroId: string) => Promise<number>;
}

function formatSessionDate(date: Date) {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Yesterday at ${time}`;
  if (diffDays < 7) return `${diffDays} days ago`;

  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined }) + ` at ${time}`;
}

export default function PreviousActionItems({
  items, isHost, onToggle, onDelete,
  onFetchPreviousRetros, onImportActionItems,
}: PreviousActionItemsProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [previousRetros, setPreviousRetros] = useState<PreviousRetroSummary[]>([]);
  const [loadingRetros, setLoadingRetros] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const importRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!importOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (importRef.current && !importRef.current.contains(e.target as Node)) {
        setImportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [importOpen]);

  const handleOpenImport = async () => {
    if (importOpen) {
      setImportOpen(false);
      return;
    }
    setImportOpen(true);
    setLoadingRetros(true);
    setImportResult(null);
    try {
      const retros = await onFetchPreviousRetros();
      setPreviousRetros(retros);
    } catch (err) {
      console.error('Failed to fetch previous retros:', err);
      setPreviousRetros([]);
    }
    setLoadingRetros(false);
  };

  const handleImport = async (sourceRetroId: string) => {
    setImporting(sourceRetroId);
    try {
      const count = await onImportActionItems(sourceRetroId);
      setImportResult({ count, retroId: sourceRetroId });
      setTimeout(() => {
        setImportOpen(false);
        setImporting(null);
        setTimeout(() => setImportResult(null), 2000);
      }, 1200);
    } catch (err) {
      console.error('Failed to import action items:', err);
      setImporting(null);
    }
  };

  const sorted = Object.entries(items)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className="retro-column">
      <div className="retro-column__header" style={{ borderTopColor: COLUMN_COLOR }}>
        <span className="retro-column__icon" style={{ color: COLUMN_COLOR }}>↩</span>
        <h3 className="retro-column__title">Previous Action Items</h3>
        <span className="retro-column__count">{sorted.length}</span>
      </div>

      {isHost && (
        <div className="pai-import-wrapper" ref={importRef}>
          <button
            className={`pai-import-btn ${importOpen ? 'pai-import-btn--active' : ''}`}
            onClick={handleOpenImport}
          >
            ↓ Import from previous retro
          </button>

          {importOpen && (
            <div className="pai-import-dropdown">
              {loadingRetros ? (
                <div className="pai-import-loading">Loading sessions…</div>
              ) : previousRetros.length === 0 ? (
                <div className="pai-import-empty">No previous sessions found</div>
              ) : (
                <>
                  <div className="pai-import-hint">Select a session to import its pending action items</div>
                  <div className="pai-import-list">
                    {previousRetros.map((retro) => (
                      <button
                        key={retro.id}
                        className={`pai-import-session ${importing === retro.id ? 'importing' : ''} ${importResult?.retroId === retro.id ? 'imported' : ''} ${retro.pendingCount === 0 ? 'empty' : ''}`}
                        onClick={() => handleImport(retro.id)}
                        disabled={importing !== null || importResult?.retroId === retro.id || retro.pendingCount === 0}
                      >
                        <div className="pai-import-session__info">
                          <span className="pai-import-session__title">
                            {retro.title || retro.id}
                          </span>
                          <span className="pai-import-session__date">
                            {formatSessionDate(retro.createdAt)}
                          </span>
                        </div>
                        <div className="pai-import-session__meta">
                          {importResult?.retroId === retro.id ? (
                            <span className="pai-import-session__done">✓ {importResult.count} imported</span>
                          ) : importing === retro.id ? (
                            <span className="pai-import-session__spinner">Importing…</span>
                          ) : retro.pendingCount === 0 ? (
                            <span className="pai-import-session__count">Nothing to import</span>
                          ) : (
                            <span className="pai-import-session__count">{retro.pendingCount} pending</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="retro-column__cards">
        {sorted.length === 0 && !(isHost && importOpen) && (
          <p className="retro-column__empty">
            {isHost
              ? 'No previous action items — import them from an earlier retro above.'
              : 'No previous action items'}
          </p>
        )}
        {sorted.map((item) => (
          <div key={item.id} className={`pai-item ${item.done ? 'pai-item--done' : ''}`}>
            <button
              className="pai-item__check"
              onClick={() => onToggle(item.id)}
              title={item.done ? 'Mark incomplete' : 'Mark done'}
              style={{ borderColor: item.done ? COLUMN_COLOR : undefined, background: item.done ? `${COLUMN_COLOR}22` : undefined }}
            >
              {item.done ? '✓' : ''}
            </button>
            <span className="pai-item__text">{item.text}</span>
            {isHost && (
              <button
                className="pai-item__delete"
                onClick={() => onDelete(item.id)}
                title="Delete"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

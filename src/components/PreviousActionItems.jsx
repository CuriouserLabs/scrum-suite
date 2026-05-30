import { useState, useRef, useEffect } from 'react';
import './PreviousActionItems.css';

const COLUMN_COLOR = '#14b8a6';

function formatSessionDate(date) {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Yesterday at ${time}`;
  if (diffDays < 7) return `${diffDays} days ago`;

  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined }) + ` at ${time}`;
}

export default function PreviousActionItems({
  items, isHost, onAdd, onToggle, onDelete,
  onFetchPreviousRetros, onImportActionItems,
}) {
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const textareaRef = useRef(null);

  const [importOpen, setImportOpen] = useState(false);
  const [previousRetros, setPreviousRetros] = useState([]);
  const [loadingRetros, setLoadingRetros] = useState(false);
  const [importing, setImporting] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const importRef = useRef(null);

  useEffect(() => {
    if (adding && textareaRef.current) textareaRef.current.focus();
  }, [adding]);

  useEffect(() => {
    if (!importOpen) return;
    function handleClickOutside(e) {
      if (importRef.current && !importRef.current.contains(e.target)) {
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

  const handleImport = async (sourceRetroId) => {
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

  const handleSubmit = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewText('');
    setAdding(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') { setNewText(''); setAdding(false); }
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
                <div className="pai-import-empty">No previous sessions with action items found</div>
              ) : (
                <>
                  <div className="pai-import-hint">Select a session to import its pending action items</div>
                  <div className="pai-import-list">
                    {previousRetros.map((retro) => (
                      <button
                        key={retro.id}
                        className={`pai-import-session ${importing === retro.id ? 'importing' : ''} ${importResult?.retroId === retro.id ? 'imported' : ''}`}
                        onClick={() => handleImport(retro.id)}
                        disabled={importing !== null || importResult?.retroId === retro.id}
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
        {sorted.length === 0 && !isHost && (
          <p className="retro-column__empty">No previous action items</p>
        )}
        {sorted.length === 0 && isHost && !importOpen && (
          <p className="retro-column__empty">No previous action items</p>
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

      <div className="retro-column__add">
        {adding ? (
          <div className="retro-column__add-form">
            <textarea
              ref={textareaRef}
              className="retro-column__add-input"
              placeholder="Describe the action item..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={500}
              rows={3}
            />
            <div className="retro-column__add-actions">
              <button
                className="retro-column__add-submit"
                onClick={handleSubmit}
                disabled={!newText.trim()}
                style={{ background: COLUMN_COLOR }}
              >
                Add
              </button>
              <button
                className="retro-column__add-cancel"
                onClick={() => { setNewText(''); setAdding(false); }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="retro-column__add-btn"
            onClick={() => setAdding(true)}
            style={{ color: COLUMN_COLOR }}
          >
            + Add a card
          </button>
        )}
      </div>
    </div>
  );
}

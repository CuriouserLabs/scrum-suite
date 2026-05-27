import { useState, useRef, useEffect } from 'react';
import './PreviousActionItems.css';

const COLUMN_COLOR = '#14b8a6';

export default function PreviousActionItems({ items, isHost, onAdd, onToggle, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (adding && textareaRef.current) textareaRef.current.focus();
  }, [adding]);

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

      <div className="retro-column__cards">
        {sorted.length === 0 && (
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

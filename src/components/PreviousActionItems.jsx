import { useState, useRef, useEffect } from 'react';
import './PreviousActionItems.css';

export default function PreviousActionItems({ items, isHost, onAdd, onToggle, onDelete }) {
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
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
    <div className="pai">
      <div className="pai__header">
        <h2 className="pai__title">Previous Action Items</h2>
        <span className="pai__count">{sorted.length} item{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="pai__list">
        {sorted.length === 0 && (
          <p className="pai__empty">No action items yet — add one below.</p>
        )}
        {sorted.map((item) => (
          <div key={item.id} className={`pai__item ${item.done ? 'pai__item--done' : ''}`}>
            <button
              className="pai__check"
              onClick={() => onToggle(item.id)}
              title={item.done ? 'Mark incomplete' : 'Mark done'}
            >
              {item.done ? '✓' : ''}
            </button>
            <span className="pai__text">{item.text}</span>
            {isHost && (
              <button
                className="pai__delete"
                onClick={() => onDelete(item.id)}
                title="Delete item"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="pai__add">
        {adding ? (
          <div className="pai__add-form">
            <textarea
              ref={textareaRef}
              className="pai__add-input"
              placeholder="Describe the action item..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={500}
              rows={3}
            />
            <div className="pai__add-actions">
              <button className="pai__add-submit" onClick={handleSubmit} disabled={!newText.trim()}>
                Add
              </button>
              <button className="pai__add-cancel" onClick={() => { setNewText(''); setAdding(false); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="pai__add-btn" onClick={() => setAdding(true)}>
            + Add action item
          </button>
        )}
      </div>
    </div>
  );
}

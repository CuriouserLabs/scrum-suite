import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import RetroCard from './RetroCard';
import type { Column, CardWithId } from '../types';
import './RetroColumn.css';

interface RetroColumnProps {
  column: Column;
  cards: CardWithId[];
  userId: string;
  isHost: boolean;
  anonymous: boolean;
  hideCards: boolean;
  revealed: boolean;
  onAddCard: (columnId: string, text: string) => void;
  onDeleteCard: (cardId: string) => void;
  onEditCard: (cardId: string, newText: string) => void;
  onToggleVote: (cardId: string) => void;
}

export default function RetroColumn({
  column, cards, userId, isHost,
  anonymous, hideCards, revealed,
  onAddCard, onDeleteCard, onEditCard, onToggleVote,
}: RetroColumnProps) {
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (adding && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [adding]);

  const handleSubmit = () => {
    const trimmed = newText.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    onAddCard(column.id, trimmed);
    setNewText('');
    setSubmitting(false);
    setAdding(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setNewText('');
      setAdding(false);
    }
  };

  const sorted = [...cards].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className="retro-column">
      <div className="retro-column__header" style={{ borderTopColor: column.color }}>
        <span className="retro-column__icon" style={{ color: column.color }}>{column.icon}</span>
        <h3 className="retro-column__title">{column.label}</h3>
        <span className="retro-column__count">{cards.length}</span>
      </div>

      <div className="retro-column__cards">
        {sorted.map((card) => (
          <RetroCard
            key={card.id}
            card={card}
            cardId={card.id}
            columnColor={column.color}
            userId={userId}
            isHost={isHost}
            anonymous={anonymous}
            hideCards={hideCards}
            revealed={revealed}
            onDelete={onDeleteCard}
            onEdit={onEditCard}
            onToggleVote={onToggleVote}
          />
        ))}
        {cards.length === 0 && (
          <p className="retro-column__empty">No cards yet</p>
        )}
      </div>

      <div className="retro-column__add">
        {adding ? (
          <div className="retro-column__add-form">
            <textarea
              ref={textareaRef}
              className="retro-column__add-input"
              placeholder="Type your thought..."
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
                disabled={!newText.trim() || submitting}
                style={{ background: column.color }}
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
            style={{ color: column.color }}
          >
            + Add a card
          </button>
        )}
      </div>
    </div>
  );
}

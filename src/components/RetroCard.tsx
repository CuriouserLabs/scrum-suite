import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import type { CardWithId } from '../types';
import './RetroCard.css';

interface RetroCardProps {
  card: CardWithId;
  cardId: string;
  columnColor: string;
  userId: string;
  isHost: boolean;
  anonymous: boolean;
  hideCards: boolean;
  revealed: boolean;
  onDelete: (cardId: string) => void;
  onEdit: (cardId: string, newText: string) => void;
  onToggleVote: (cardId: string) => void;
}

export default function RetroCard({
  card, cardId, columnColor, userId, isHost,
  anonymous, hideCards, revealed,
  onDelete, onEdit, onToggleVote,
}: RetroCardProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(card.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAuthor = card.authorId === userId;
  const hasVoted = card.votes?.includes(userId);
  const voteCount = card.votes?.length || 0;
  const isHidden = hideCards && !revealed && !isAuthor;

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  const handleEditSubmit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== card.text) {
      onEdit(cardId, trimmed);
    }
    setEditing(false);
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    }
    if (e.key === 'Escape') {
      setEditText(card.text);
      setEditing(false);
    }
  };

  if (isHidden) {
    return (
      <div
        className="retro-card retro-card--hidden"
        style={{ borderLeftColor: columnColor }}
      >
        <span className="retro-card__hidden-icon">?</span>
      </div>
    );
  }

  return (
    <div
      className="retro-card"
      style={{
        borderLeftColor: columnColor,
        background: `${columnColor}12`,
      }}
    >
      <div className="retro-card__actions">
        {isAuthor && !editing && (
          <button
            className="retro-card__action-btn"
            onClick={() => { setEditText(card.text); setEditing(true); }}
            title="Edit"
          >
            ✎
          </button>
        )}
        {(isAuthor || isHost) && (
          <button
            className="retro-card__action-btn retro-card__action-btn--delete"
            onClick={() => onDelete(cardId)}
            title="Delete"
          >
            ×
          </button>
        )}
      </div>

      {editing ? (
        <textarea
          ref={textareaRef}
          className="retro-card__edit-input"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={handleEditSubmit}
          maxLength={500}
          rows={3}
        />
      ) : (
        <p className="retro-card__text">{card.text}</p>
      )}

      <div className="retro-card__footer">
        <span className="retro-card__author">
          {anonymous
            ? (isAuthor ? '(you)' : '')
            : (isAuthor ? '(you)' : card.authorName || '')}
        </span>
        <button
          className={`retro-card__vote-btn ${hasVoted ? 'retro-card__vote-btn--active' : ''}`}
          onClick={() => onToggleVote(cardId)}
          style={hasVoted ? { color: columnColor } : {}}
        >
          ▲ {voteCount > 0 && <span className="retro-card__vote-count">{voteCount}</span>}
        </button>
      </div>
    </div>
  );
}

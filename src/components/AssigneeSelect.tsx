import { useState, useRef, useEffect } from 'react';
import type { Participant } from '../types';
import { truncateAssigneeName } from '../utils/assignee';
import './AssigneeSelect.css';

interface AssigneeSelectProps {
  participants: Participant[];
  assigneeId?: string | null;
  /** Snapshot name — shown even when the assignee isn't a current participant. */
  assigneeName?: string | null;
  /** Only hosts/co-hosts may change the assignment. */
  canAssign: boolean;
  onAssign: (assigneeId: string | null) => void;
  /** Column accent used to tint the chip when assigned. */
  accentColor?: string;
}

export default function AssigneeSelect({
  participants, assigneeId, assigneeName, canAssign, onAssign, accentColor,
}: AssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Prefer the live participant name (kept fresh) and fall back to the stored
  // snapshot for assignees who've left or were carried over from a past retro.
  const liveName = assigneeId
    ? participants.find((p) => p.id === assigneeId)?.displayName
    : null;
  const displayName = liveName || assigneeName || '';
  const isAssigned = !!displayName;

  // A read-only viewer with nothing assigned has nothing to show.
  if (!canAssign && !isAssigned) return null;

  const chipStyle = isAssigned && accentColor
    ? { borderColor: `${accentColor}66`, color: accentColor }
    : undefined;

  const chip = (
    <span className="assignee-chip__icon" aria-hidden="true">👤</span>
  );

  if (!canAssign) {
    return (
      <span className="assignee-chip assignee-chip--static" style={chipStyle} title={`Assigned to ${displayName}`}>
        {chip}
        <span className="assignee-chip__name">{truncateAssigneeName(displayName)}</span>
      </span>
    );
  }

  return (
    <div className="assignee-select" ref={wrapRef}>
      <button
        type="button"
        className={`assignee-chip ${isAssigned ? 'assignee-chip--assigned' : 'assignee-chip--empty'}`}
        style={chipStyle}
        onClick={() => setOpen((v) => !v)}
        title={isAssigned ? `Assigned to ${displayName} — click to reassign` : 'Assign to a member'}
      >
        {chip}
        <span className="assignee-chip__name">
          {isAssigned ? truncateAssigneeName(displayName) : 'Assign'}
        </span>
      </button>

      {open && (
        <div className="assignee-menu">
          <button
            type="button"
            className={`assignee-menu__item ${!assigneeId ? 'assignee-menu__item--active' : ''}`}
            onClick={() => { onAssign(null); setOpen(false); }}
          >
            <span className="assignee-menu__label">Unassigned</span>
            {!assigneeId && <span className="assignee-menu__check">✓</span>}
          </button>
          {participants.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`assignee-menu__item ${assigneeId === p.id ? 'assignee-menu__item--active' : ''}`}
              onClick={() => { onAssign(p.id); setOpen(false); }}
            >
              <span className="assignee-menu__label">{p.displayName}</span>
              {assigneeId === p.id && <span className="assignee-menu__check">✓</span>}
            </button>
          ))}
          {/* The current assignee is no longer in the session — surface who it is
              so a host reassigning knows what they're replacing. */}
          {isAssigned && assigneeId && !participants.some((p) => p.id === assigneeId) && (
            <div className="assignee-menu__note">Currently: {displayName} (not in session)</div>
          )}
        </div>
      )}
    </div>
  );
}

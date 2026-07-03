import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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

const MENU_WIDTH = 200;
const MENU_MAX_HEIGHT = 240;
const GAP = 4;
const VIEWPORT_MARGIN = 8;

interface MenuPos {
  left: number;
  top: number;
  /** 'up' anchors the menu's bottom to the trigger's top. */
  placement: 'up' | 'down';
}

export default function AssigneeSelect({
  participants, assigneeId, assigneeName, canAssign, onAssign, accentColor,
}: AssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // The menu is portalled to <body> so it can escape the retro column's
  // `overflow: hidden` / scrolling card list (which otherwise clip it). That
  // means we position it manually against the trigger's viewport rect, and
  // flip it above the trigger when there isn't room below.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placeUp = spaceBelow < MENU_MAX_HEIGHT + GAP && spaceAbove > spaceBelow;

      let left = rect.left;
      if (left + MENU_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
        left = window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN;
      }
      if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

      setPos({
        left,
        top: placeUp ? rect.top - GAP : rect.bottom + GAP,
        placement: placeUp ? 'up' : 'down',
      });
    };
    update();
    // Keep it pinned to the trigger while the card list / page scrolls.
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
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

  const icon = <span className="assignee-chip__icon" aria-hidden="true">👤</span>;

  if (!canAssign) {
    return (
      <span className="assignee-chip assignee-chip--static" style={chipStyle} title={`Assigned to ${displayName}`}>
        {icon}
        <span className="assignee-chip__name">{truncateAssigneeName(displayName)}</span>
      </span>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`assignee-chip ${isAssigned ? 'assignee-chip--assigned' : 'assignee-chip--empty'}`}
        style={chipStyle}
        onClick={() => setOpen((v) => !v)}
        title={isAssigned ? `Assigned to ${displayName} — click to reassign` : 'Assign to a member'}
      >
        {icon}
        <span className="assignee-chip__name">
          {isAssigned ? truncateAssigneeName(displayName) : 'Assign'}
        </span>
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="assignee-menu"
          style={{
            left: pos.left,
            top: pos.top,
            width: MENU_WIDTH,
            maxHeight: MENU_MAX_HEIGHT,
            transform: pos.placement === 'up' ? 'translateY(-100%)' : undefined,
          }}
        >
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
        </div>,
        document.body,
      )}
    </>
  );
}

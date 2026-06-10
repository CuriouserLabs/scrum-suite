import { useState, useRef, useEffect } from 'react';
import type { RetroState } from '../types';
import type { ExportFormat } from '../utils/retroExport';
import { downloadBoard, copyBoardToClipboard } from '../utils/retroExport';
import './ExportMenu.css';

interface ExportMenuProps {
  retroState: RetroState | null;
  retroId: string;
  viewerId: string;
}

const FORMAT_OPTIONS: { format: ExportFormat; label: string; hint: string }[] = [
  { format: 'csv', label: 'CSV', hint: '.csv — spreadsheet / Confluence table import' },
  { format: 'markdown', label: 'Markdown', hint: '.md — paste into Confluence' },
  { format: 'text', label: 'Plain text', hint: '.txt' },
];

export default function ExportMenu({ retroState, retroId, viewerId }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  if (!retroState) return null;

  const handleDownload = (format: ExportFormat) => {
    downloadBoard(retroState, retroId, viewerId, format);
    setOpen(false);
  };

  const handleCopy = async () => {
    await copyBoardToClipboard(retroState, retroId, viewerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setTimeout(() => setOpen(false), 600);
  };

  return (
    <div className="export-menu" ref={menuRef}>
      <button
        className={`export-menu__btn ${open ? 'export-menu__btn--active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Export this board"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⬇ Export
      </button>

      {open && (
        <div className="export-menu__dropdown" role="menu">
          <button className="export-menu__item" role="menuitem" onClick={handleCopy}>
            <span className="export-menu__item-label">
              {copied ? '✓ Copied!' : 'Copy as Markdown'}
            </span>
            <span className="export-menu__item-hint">Best for pasting into Confluence</span>
          </button>

          <div className="export-menu__divider" />
          <div className="export-menu__section-label">Download</div>

          {FORMAT_OPTIONS.map(({ format, label, hint }) => (
            <button
              key={format}
              className="export-menu__item"
              role="menuitem"
              onClick={() => handleDownload(format)}
            >
              <span className="export-menu__item-label">{label}</span>
              <span className="export-menu__item-hint">{hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

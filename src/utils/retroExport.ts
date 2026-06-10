import { getColumnById, ALL_COLUMNS } from './retroColumns';
import type { RetroState } from '../types';

export type ExportFormat = 'csv' | 'markdown' | 'text';

/** A single card flattened for export. */
interface ExportCard {
  text: string;
  /** Empty when anonymous or the author can't be resolved. */
  author: string;
  votes: number;
  /** Defined only for action-item style columns (e.g. Previous Action Items). */
  done?: boolean;
}

/** One board column with its visible cards, ready to serialize. */
interface ExportSection {
  label: string;
  icon: string;
  cards: ExportCard[];
}

const PREVIOUS_ACTIONS_ID = 'previous-actions';

/**
 * Flatten a retro into ordered sections, applying the same visibility rules the
 * board UI uses: cards hidden by "hide until reveal" (for non-authors) are
 * omitted, and authors are dropped when the board is anonymous.
 */
export function buildBoardExport(retro: RetroState, viewerId: string): ExportSection[] {
  const settings = retro.settings || { anonymous: false, hideCards: false, revealed: false };
  const anonymous = settings.anonymous;
  const hidden = settings.hideCards && !settings.revealed;

  const nameOf = (authorId: string): string => {
    if (anonymous) return '';
    const p = retro.participants.find((x) => x.id === authorId);
    return p?.displayName || '';
  };

  const columnIds = retro.columns?.length ? retro.columns : ALL_COLUMNS.map((c) => c.id);

  const sections: ExportSection[] = [];
  for (const columnId of columnIds) {
    const column = getColumnById(columnId);
    if (!column) continue;

    if (columnId === PREVIOUS_ACTIONS_ID) {
      const items = Object.values(retro.previousActionItems || {})
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((item) => ({ text: item.text, author: '', votes: 0, done: item.done }));
      sections.push({ label: column.label, icon: column.icon, cards: items });
      continue;
    }

    const cards = Object.values(retro.cards || {})
      .filter((c) => c.columnId === columnId)
      .filter((c) => !(hidden && c.authorId !== viewerId))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((c) => ({ text: c.text, author: nameOf(c.authorId), votes: c.votes?.length || 0 }));
    sections.push({ label: column.label, icon: column.icon, cards });
  }

  return sections;
}

function boardTitle(retro: RetroState, retroId: string): string {
  return retro.title?.trim() || `Retro ${retroId}`;
}

function exportDate(): string {
  return new Date().toLocaleString([], {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Markdown ───────────────────────────────────────────────────

export function toMarkdown(retro: RetroState, retroId: string, viewerId: string): string {
  const sections = buildBoardExport(retro, viewerId);
  const lines: string[] = [];
  lines.push(`# ${boardTitle(retro, retroId)}`);
  lines.push('');
  lines.push(`_Retro \`${retroId}\` · Exported ${exportDate()}_`);
  lines.push('');

  for (const section of sections) {
    lines.push(`## ${section.icon} ${section.label}`);
    lines.push('');
    if (section.cards.length === 0) {
      lines.push('_No items_');
      lines.push('');
      continue;
    }
    for (const card of section.cards) {
      const text = card.text.replace(/\r?\n/g, ' ').trim();
      if (card.done !== undefined) {
        lines.push(`- [${card.done ? 'x' : ' '}] ${text}`);
      } else {
        const meta: string[] = [];
        if (card.author) meta.push(card.author);
        if (card.votes > 0) meta.push(`${card.votes} ${card.votes === 1 ? 'vote' : 'votes'}`);
        lines.push(`- ${text}${meta.length ? ` _(${meta.join(', ')})_` : ''}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

// ── CSV ────────────────────────────────────────────────────────

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(retro: RetroState, _retroId: string, viewerId: string): string {
  const sections = buildBoardExport(retro, viewerId);
  const rows: string[] = [];
  rows.push(['Column', 'Card', 'Author', 'Votes', 'Status'].join(','));

  for (const section of sections) {
    for (const card of section.cards) {
      const text = card.text.replace(/\r?\n/g, ' ').trim();
      const status = card.done === undefined ? '' : card.done ? 'Done' : 'Pending';
      rows.push([
        csvCell(section.label),
        csvCell(text),
        csvCell(card.author),
        card.votes ? String(card.votes) : '',
        csvCell(status),
      ].join(','));
    }
  }

  // Prefix a BOM so Excel/Confluence detect UTF-8 correctly.
  return '﻿' + rows.join('\r\n') + '\r\n';
}

// ── Plain text ─────────────────────────────────────────────────

export function toText(retro: RetroState, retroId: string, viewerId: string): string {
  const sections = buildBoardExport(retro, viewerId);
  const lines: string[] = [];
  lines.push(boardTitle(retro, retroId));
  lines.push(`Retro ${retroId} · Exported ${exportDate()}`);
  lines.push('');

  for (const section of sections) {
    lines.push(`${section.label.toUpperCase()}`);
    lines.push('-'.repeat(section.label.length));
    if (section.cards.length === 0) {
      lines.push('  (no items)');
    } else {
      for (const card of section.cards) {
        const text = card.text.replace(/\r?\n/g, ' ').trim();
        if (card.done !== undefined) {
          lines.push(`  [${card.done ? 'x' : ' '}] ${text}`);
        } else {
          const meta: string[] = [];
          if (card.author) meta.push(card.author);
          if (card.votes > 0) meta.push(`${card.votes} ${card.votes === 1 ? 'vote' : 'votes'}`);
          lines.push(`  - ${text}${meta.length ? ` (${meta.join(', ')})` : ''}`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

// ── Serialization helpers ──────────────────────────────────────

const SERIALIZERS: Record<ExportFormat, {
  build: (retro: RetroState, retroId: string, viewerId: string) => string;
  ext: string;
  mime: string;
}> = {
  csv: { build: toCsv, ext: 'csv', mime: 'text/csv;charset=utf-8' },
  markdown: { build: toMarkdown, ext: 'md', mime: 'text/markdown;charset=utf-8' },
  text: { build: toText, ext: 'txt', mime: 'text/plain;charset=utf-8' },
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'retro';
}

export function exportFileName(retro: RetroState, retroId: string, format: ExportFormat): string {
  const base = retro.title?.trim() ? slugify(retro.title) : `retro-${retroId}`;
  const date = new Date().toISOString().slice(0, 10);
  return `${base}-${date}.${SERIALIZERS[format].ext}`;
}

/** Build the export string for the given format. */
export function serializeBoard(
  retro: RetroState, retroId: string, viewerId: string, format: ExportFormat,
): string {
  return SERIALIZERS[format].build(retro, retroId, viewerId);
}

/** Trigger a browser download of the board in the given format. */
export function downloadBoard(
  retro: RetroState, retroId: string, viewerId: string, format: ExportFormat,
): void {
  const content = serializeBoard(retro, retroId, viewerId, format);
  const { mime } = SERIALIZERS[format];
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(retro, retroId, format);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Copy the board (as Markdown) to the clipboard, with a legacy fallback. */
export async function copyBoardToClipboard(
  retro: RetroState, retroId: string, viewerId: string,
): Promise<void> {
  const content = toMarkdown(retro, retroId, viewerId);
  try {
    await navigator.clipboard.writeText(content);
  } catch {
    const el = document.createElement('textarea');
    el.value = content;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

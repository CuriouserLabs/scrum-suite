import { ALL_COLUMNS } from '../utils/retroColumns';
import type { RetroState, RetroSettings } from '../types';
import './RetroHostControls.css';

interface RetroHostControlsProps {
  retroState: RetroState | null;
  updateColumns: (columnIds: string[]) => void;
  updateSettings: (partial: Partial<RetroSettings>) => void;
  revealCards: () => void;
}

export default function RetroHostControls({
  retroState, updateColumns, updateSettings, revealCards,
}: RetroHostControlsProps) {
  const settings: Partial<RetroSettings> = retroState?.settings || {};
  const activeColumnIds = retroState?.columns || [];
  const inactiveColumns = ALL_COLUMNS.filter((c) => !activeColumnIds.includes(c.id));

  const removeColumn = (id: string) => {
    updateColumns(activeColumnIds.filter((cid) => cid !== id));
  };

  const addColumn = (id: string) => {
    const ordered = ALL_COLUMNS.map((c) => c.id).filter(
      (cid) => activeColumnIds.includes(cid) || cid === id
    );
    updateColumns(ordered);
  };

  const toggleAnonymous = () => {
    updateSettings({ anonymous: !settings.anonymous });
  };

  const toggleHideCards = () => {
    if (settings.hideCards) {
      updateSettings({ hideCards: false, revealed: false });
    } else {
      updateSettings({ hideCards: true, revealed: false });
    }
  };

  const handleReveal = () => {
    revealCards();
  };

  const canReveal = settings.hideCards && !settings.revealed;

  return (
    <div className="retro-controls">
      {/* Column management */}
      <div className="retro-controls__section">
        <span className="retro-controls__label">Columns</span>
        <div className="retro-controls__chips">
          {activeColumnIds.map((id) => {
            const col = ALL_COLUMNS.find((c) => c.id === id);
            if (!col) return null;
            return (
              <span
                key={id}
                className="retro-controls__chip retro-controls__chip--active"
                style={{ borderColor: col.color, color: col.color }}
              >
                {col.icon} {col.label}
                {activeColumnIds.length > 1 && (
                  <button
                    className="retro-controls__chip-remove"
                    onClick={() => removeColumn(id)}
                    title={`Remove ${col.label}`}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
          {inactiveColumns.map((col) => (
            <button
              key={col.id}
              className="retro-controls__chip retro-controls__chip--inactive"
              onClick={() => addColumn(col.id)}
              title={`Add ${col.label}`}
            >
              + {col.icon} {col.label}
            </button>
          ))}
        </div>
      </div>

      {/* Settings toggles */}
      <div className="retro-controls__section retro-controls__toggles">
        <label className="retro-controls__toggle">
          <input
            type="checkbox"
            checked={settings.anonymous || false}
            onChange={toggleAnonymous}
          />
          <span className="retro-controls__toggle-label">Anonymous</span>
        </label>

        <label className="retro-controls__toggle">
          <input
            type="checkbox"
            checked={settings.hideCards || false}
            onChange={toggleHideCards}
          />
          <span className="retro-controls__toggle-label">Hide until reveal</span>
        </label>
      </div>

      {/* Reveal button */}
      {canReveal && (
        <button className="retro-controls__reveal-btn" onClick={handleReveal}>
          Reveal All
        </button>
      )}

    </div>
  );
}

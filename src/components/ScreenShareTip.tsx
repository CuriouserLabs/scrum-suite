import './ScreenShareTip.css';

interface ScreenShareTipProps {
  show: boolean;
  message: string;
  onDismiss: () => void;
}

/**
 * Small dismissible coach callout anchored to the "hide my own items" toggle.
 * Must be rendered inside a `position: relative` wrapper that also contains the
 * toggle — the callout floats just above it with an arrow pointing down. It is
 * intentionally compact so it never covers the board or controls.
 */
export default function ScreenShareTip({ show, message, onDismiss }: ScreenShareTipProps) {
  if (!show) return null;
  return (
    <div className="screen-share-tip" role="status">
      <span className="screen-share-tip__icon" aria-hidden="true">🖥️</span>
      <p className="screen-share-tip__text">{message}</p>
      <button
        type="button"
        className="screen-share-tip__dismiss"
        onClick={onDismiss}
      >
        Got it
      </button>
      <span className="screen-share-tip__arrow" aria-hidden="true" />
    </div>
  );
}

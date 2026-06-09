import type { ConnectionState, Role } from '../types';
import './ConnectionStatus.css';

interface ConnectionStatusProps {
  status: ConnectionState;
  role?: Role | null;
}

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const labels: Record<string, { text: string; cls: string }> = {
    connecting:    { text: 'Connecting…',     cls: 'status-connecting' },
    reconnecting:  { text: 'Reconnecting…',   cls: 'status-connecting' },
    ready:         { text: 'Hosting',          cls: 'status-ready' },
    connected:     { text: 'Connected',        cls: 'status-ready' },
    disconnected:  { text: 'Disconnected',     cls: 'status-error' },
    error:         { text: 'Connection failed', cls: 'status-error' },
  };

  const { text, cls } = labels[status] || { text: status, cls: '' };

  return (
    <span className={`conn-status ${cls}`}>
      <span className="conn-dot" />
      {text}
    </span>
  );
}

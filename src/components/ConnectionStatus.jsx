import './ConnectionStatus.css';

export default function ConnectionStatus({ status, role }) {
  const labels = {
    connecting: { text: 'Connecting…', cls: 'status-connecting' },
    ready: { text: 'Hosting', cls: 'status-ready' },
    connected: { text: 'Connected', cls: 'status-ready' },
    disconnected: { text: 'Disconnected', cls: 'status-error' },
    error: { text: 'Connection failed', cls: 'status-error' },
  };

  const { text, cls } = labels[status] || { text: status, cls: '' };

  return (
    <span className={`conn-status ${cls}`}>
      <span className="conn-dot" />
      {text}
    </span>
  );
}

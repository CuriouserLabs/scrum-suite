import { useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import './GuestJoinGate.css';

const isDev = import.meta.env.DEV;

interface GuestJoinGateProps {
  /** Which kind of session the visitor is trying to join. */
  kind: 'poker' | 'retro';
}

/**
 * Shown to unauthenticated visitors who open a session link. Lets them join by
 * name only (anonymous guest), or sign in with Google instead. Once they join,
 * the route re-renders with a user and the real session page takes over.
 */
export default function GuestJoinGate({ kind }: GuestJoinGateProps) {
  const { roomId, retroId } = useParams<{ roomId: string; retroId: string }>();
  const sessionCode = roomId ?? retroId ?? '';
  const { login, loginAsGuest } = useUser();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const label = kind === 'poker' ? 'Sprint Poker' : 'Retro Board';
  const glyph = kind === 'poker' ? '♣' : '↻';

  const handleGuestJoin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setBusy(true);
    try {
      await loginAsGuest(trimmed);
    } catch {
      setError('Could not join. Please try again.');
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await login();
    } catch (err) {
      if ((err as { code?: string }).code !== 'auth/popup-closed-by-user') {
        setError('Sign-in failed. Please try again.');
      }
      setBusy(false);
    }
  };

  return (
    <div className="guest-gate">
      <div className="guest-gate-card" data-mode={kind}>
        <div className="guest-gate-glyph">{glyph}</div>
        <span className="guest-gate-eyebrow">You&apos;ve been invited to join a</span>
        <h1>{label}</h1>
        <p className="guest-gate-code">
          Session <strong>{sessionCode}</strong>
        </p>

        <form className="guest-gate-form" onSubmit={handleGuestJoin}>
          <label htmlFor="guest-name">Join with your name</label>
          <input
            id="guest-name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            maxLength={50}
            autoFocus
            disabled={busy}
          />
          <button className="btn-primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Joining…' : 'Join as Guest'}
          </button>
        </form>

        {error && <p className="guest-gate-error">{error}</p>}

        <div className="guest-gate-divider"><span>or</span></div>

        <button className="guest-gate-google" onClick={handleGoogleSignIn} disabled={busy}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        <p className="guest-gate-note">
          Guests can join sessions but can&apos;t create their own.
        </p>

        {isDev && (
          <p className="guest-gate-dev-hint">
            Dev tip: use the Google sign-in or a dev account from the home screen to create sessions.
          </p>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import type { Timer } from '../types';
import './RetroTimer.css';

const PRESETS = [
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
  { label: '10m', seconds: 600 },
];

interface RetroTimerProps {
  timer: Timer | undefined;
  isHost: boolean;
  onStart: (seconds: number) => void;
  onStop: () => void;
}

export default function RetroTimer({ timer, isHost, onStart, onStop }: RetroTimerProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const isRunning = timer?.running && timer?.startedAt && timer?.duration;

  useEffect(() => {
    if (!isRunning) {
      clearInterval(intervalRef.current);
      return;
    }

    const tick = () => {
      const elapsed = (Date.now() - (timer?.startedAt ?? 0)) / 1000;
      const left = Math.max(0, (timer?.duration ?? 0) - elapsed);
      setRemaining(left);
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isRunning, timer?.startedAt, timer?.duration]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const displayedRemaining = isRunning ? remaining : null;
  const isExpired = displayedRemaining !== null && displayedRemaining <= 0;

  if (!isHost && !isRunning) return null;

  return (
    <div className={`retro-timer ${isExpired ? 'retro-timer--expired' : ''}`}>
      {isRunning ? (
        <>
          <span className={`retro-timer__display ${isExpired ? 'retro-timer__display--expired' : ''}`}>
            {isExpired ? "Time's up!" : formatTime(displayedRemaining ?? 0)}
          </span>
          {isHost && (
            <button className="retro-timer__stop" onClick={onStop}>Stop</button>
          )}
        </>
      ) : isHost ? (
        <div className="retro-timer__presets">
          {PRESETS.map((p) => (
            <button
              key={p.seconds}
              className="retro-timer__preset"
              onClick={() => onStart(p.seconds)}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

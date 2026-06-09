import { useEffect, useState } from 'react';
import type { RoomState } from '../types';
import './RevealedCards.css';

interface RevealedCardsProps {
  roomState: RoomState;
}

export default function RevealedCards({ roomState }: RevealedCardsProps) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    // Trigger flip animation after mount
    const t = setTimeout(() => setFlipped(true), 80);
    return () => clearTimeout(t);
  }, []);

  const votes = roomState.votes;
  const participants = roomState.participants;

  const numericVotes = participants
    .map((p) => votes[p.id])
    .filter((v) => v !== undefined && v !== '?' && !isNaN(Number(v)))
    .map(Number);

  const avg = numericVotes.length
    ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1)
    : null;

  const consensus = numericVotes.length > 0 && numericVotes.every((v) => v === numericVotes[0]);

  // Vote distribution
  const dist: Record<string, number> = {};
  participants.forEach((p) => {
    const v = votes[p.id];
    if (v !== undefined) dist[v] = (dist[v] || 0) + 1;
  });
  const maxCount = Math.max(...Object.values(dist), 1);

  return (
    <div className="revealed-view">
      <div className="revealed-label">
        {consensus ? '🎉 Consensus!' : `Round ${roomState.round} · Votes revealed`}
      </div>

      <div className="revealed-cards">
        {participants.map((p, i) => {
          const vote = votes[p.id];
          return (
            <div
              key={p.id}
              className={`flip-card ${flipped ? 'flipped' : ''}`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="flip-card-inner">
                <div className="flip-card-back">
                  <span className="card-suit">♣</span>
                </div>
                <div className="flip-card-front">
                  <span className="flip-value">{vote ?? '—'}</span>
                </div>
              </div>
              <div className="flip-name">{p.displayName}</div>
            </div>
          );
        })}
      </div>

      {avg !== null && (
        <div className="results-summary">
          <div className="summary-stat">
            <span className="stat-label">Average</span>
            <span className="stat-value">{avg}</span>
          </div>
          {Object.keys(dist).length > 1 && (
            <div className="vote-distribution">
              {Object.entries(dist)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([val, count]) => (
                  <div key={val} className="dist-bar-wrap">
                    <div
                      className="dist-bar"
                      style={{ height: `${(count / maxCount) * 48 + 12}px` }}
                    />
                    <span className="dist-label">{val}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

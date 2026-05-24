import { useEffect, useState, useRef } from 'react';
import './VoteBoard.css';

export default function VoteBoard({ roomState, userId }) {
  const { participants, votes, revealed, round } = roomState;
  const [flipped, setFlipped] = useState(revealed);
  const prevRoundRef = useRef(round);

  // Flip cards when host reveals
  useEffect(() => {
    if (revealed) {
      const t = setTimeout(() => setFlipped(true), 60);
      return () => clearTimeout(t);
    }
  }, [revealed]);

  // Reset flip state when a new round starts
  useEffect(() => {
    if (round !== prevRoundRef.current) {
      prevRoundRef.current = round;
      setFlipped(false);
    }
  }, [round]);

  const numericVotes = participants
    .map((p) => votes[p.id])
    .filter((v) => v !== undefined && v !== '?' && !isNaN(Number(v)))
    .map(Number);

  const avg =
    numericVotes.length
      ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1)
      : null;

  const consensus =
    numericVotes.length > 0 && numericVotes.every((v) => v === numericVotes[0]);

  // Distribution for bar chart (only shown after reveal)
  const dist = {};
  participants.forEach((p) => {
    const v = votes[p.id];
    if (v !== undefined) dist[v] = (dist[v] || 0) + 1;
  });
  const maxCount = Math.max(...Object.values(dist), 1);

  return (
    <div className="vote-board">
      <div className="vote-board-header">
        {revealed ? (
          <span className="vb-label">
            {consensus ? '🎉 Consensus!' : `Round ${round} · Votes revealed`}
          </span>
        ) : (
          <span className="vb-label">
            Team votes &mdash;{' '}
            {Object.keys(votes).length}/{participants.length} submitted
          </span>
        )}

        {revealed && avg !== null && (
          <span className="vb-avg">
            avg <strong>{avg}</strong>
          </span>
        )}
      </div>

      <div className="vote-cards-row">
        {participants.map((p, i) => {
          const hasVoted = votes[p.id] !== undefined;
          const isMe = p.id === userId;

          return (
            <div key={p.id} className="vote-slot">
              <div
                className={`vote-flip-card ${flipped && hasVoted ? 'flipped' : ''}`}
                style={{ transitionDelay: flipped ? `${i * 55}ms` : '0ms' }}
              >
                <div className="vfc-inner">
                  {/* Back: face-down */}
                  <div className={`vfc-back ${!hasVoted ? 'empty' : ''}`}>
                    {hasVoted ? <span className="vfc-suit">♣</span> : <span className="vfc-empty-dot">·</span>}
                  </div>
                  {/* Front: revealed value */}
                  <div className="vfc-front">
                    <span className="vfc-value">{votes[p.id] ?? '—'}</span>
                  </div>
                </div>
              </div>
              <div className={`vote-slot-name ${isMe ? 'is-me' : ''}`}>
                {p.displayName}
                {isMe && <span className="you-tag">you</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Distribution bar chart — only after reveal with differing votes */}
      {revealed && !consensus && Object.keys(dist).length > 1 && (
        <div className="vb-distribution">
          {Object.entries(dist)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([val, count]) => (
              <div key={val} className="dist-col">
                <div className="dist-bar-wrap">
                  <div
                    className="dist-bar"
                    style={{ height: `${(count / maxCount) * 40 + 8}px` }}
                  />
                </div>
                <span className="dist-label">{val}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

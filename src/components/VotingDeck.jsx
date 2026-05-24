import './VotingDeck.css';

const FIBONACCI = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?'];

export default function VotingDeck({ selectedValue, onVote, disabled }) {
  return (
    <div className="voting-deck">
      {FIBONACCI.map((value) => {
        const selected = selectedValue === value;
        return (
          <button
            key={value}
            className={`vote-card ${selected ? 'selected' : ''}`}
            onClick={() => !disabled && onVote(value)}
            disabled={disabled}
            aria-pressed={selected}
          >
            <span className="card-value">{value}</span>
          </button>
        );
      })}
    </div>
  );
}

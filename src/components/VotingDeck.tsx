import type { VoteValue } from '../types';
import './VotingDeck.css';

const FIBONACCI: VoteValue[] = [0, 0.5, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?'];

interface VotingDeckProps {
  selectedValue: VoteValue | undefined;
  onVote: (value: VoteValue) => void;
  disabled: boolean;
  /** When true, the picked card is not highlighted — used by hosts who are
   *  sharing their screen so the deck doesn't reveal their estimate. */
  hideSelection?: boolean;
}

export default function VotingDeck({ selectedValue, onVote, disabled, hideSelection }: VotingDeckProps) {
  return (
    <div className="voting-deck">
      {FIBONACCI.map((value) => {
        const selected = !hideSelection && selectedValue === value;
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

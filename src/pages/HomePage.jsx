import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { useUser } from '../contexts/UserContext';
import './HomePage.css';

export default function HomePage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const createRoom = () => {
    const roomId = nanoid(8);
    navigate(`/room/${roomId}`);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    const input = joinCode.trim();
    if (!input) return;

    // Accept full URL or just the room code
    const match = input.match(/\/room\/([a-zA-Z0-9_-]{8,})/);
    const roomId = match ? match[1] : input;

    if (roomId.length < 6) {
      setJoinError('Invalid room code. Please check the link and try again.');
      return;
    }
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="home-page">
      <div className="home-hero">
        <h1>Plan smarter,<br />ship faster.</h1>
        <p className="home-tagline">
          Real-time story point voting for agile teams — no logins, no setup, just paste a link.
        </p>
      </div>

      <div className="home-actions">
        <div className="action-card create-card">
          <div className="action-icon">&#9827;</div>
          <h2>Create a Room</h2>
          <p>Start a new planning session and share the link with your team.</p>
          <button className="btn-primary" onClick={createRoom}>
            Create Room
          </button>
        </div>

        <div className="action-divider">or</div>

        <div className="action-card join-card">
          <div className="action-icon">&#128279;</div>
          <h2>Join a Room</h2>
          <p>Paste a room link or code to join an existing session.</p>
          <form onSubmit={handleJoin}>
            <input
              type="text"
              placeholder="Paste room link or code"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value);
                setJoinError('');
              }}
            />
            {joinError && <p className="join-error">{joinError}</p>}
            <button className="btn-secondary" type="submit" disabled={!joinCode.trim()}>
              Join Room
            </button>
          </form>
        </div>
      </div>

      <div className="home-footer-tip">
        Signed in as <strong>{user.displayName}</strong> · Not you? Click your name in the header to change it.
      </div>
    </div>
  );
}

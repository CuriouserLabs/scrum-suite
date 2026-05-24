import { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import './ProfileWidget.css';

export default function ProfileWidget() {
  const { user, updateName, logout } = useUser();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName || '');

  if (!user) return null;

  const handleSave = () => {
    if (name.trim()) {
      updateName(name);
      setEditing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setName(user.displayName);
      setEditing(false);
    }
  };

  const initials = user.displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="profile-widget">
      <div className="profile-avatar">{initials}</div>
      {editing ? (
        <input
          className="profile-edit-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          maxLength={30}
          autoFocus
        />
      ) : (
        <span className="profile-name" onClick={() => setEditing(true)}>
          {user.displayName}
        </span>
      )}
      <button className="profile-logout" onClick={logout} title="Logout">
        &times;
      </button>
    </div>
  );
}

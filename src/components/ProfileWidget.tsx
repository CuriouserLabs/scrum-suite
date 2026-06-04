import { useUser } from '../contexts/UserContext';
import './ProfileWidget.css';

export default function ProfileWidget() {
  const { user, logout } = useUser();

  if (!user) return null;

  const initials = (user.displayName || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="profile-widget">
      {user.photoURL ? (
        <img
          className="profile-avatar-img"
          src={user.photoURL}
          alt={user.displayName}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="profile-avatar">{initials}</div>
      )}
      <span className="profile-name">{user.displayName}</span>
      <button className="profile-logout" onClick={logout} title="Sign out">
        &times;
      </button>
    </div>
  );
}

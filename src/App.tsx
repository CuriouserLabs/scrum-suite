import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { UserProvider, useUser } from './contexts/UserContext';
import LandingPage from './pages/LandingPage';
import ProfileWidget from './components/ProfileWidget';
import GuestJoinGate from './components/GuestJoinGate';
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';
import RoomPage from './pages/RoomPage';
import RetroPage from './pages/RetroPage';
import './App.css';

function Shell({ children }: { children: ReactNode }) {
  const { user } = useUser();
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-logo">&#9830; Scrum Suite</Link>
        <div className="app-header-actions">
          {/* History is a secondary, rarely-used view — kept out of the main
              feature UI behind a low-key nav link. Hidden for ephemeral guests. */}
          {user && !user.isGuest && (
            <Link to="/history" className="app-history-link" title="Session history">
              <span aria-hidden="true">&#8634;</span> History
            </Link>
          )}
          <ProfileWidget />
        </div>
      </header>
      {children}
    </div>
  );
}

function AppContent() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-icon">&#9830;</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Shell><HomePage /></Shell> : <LandingPage />} />
      <Route
        path="/history"
        element={user ? <Shell><HistoryPage /></Shell> : <LandingPage />}
      />
      <Route
        path="/room/:roomId"
        element={user ? <Shell><RoomPage /></Shell> : <GuestJoinGate kind="poker" />}
      />
      <Route
        path="/retro/:retroId"
        element={user ? <Shell><RetroPage /></Shell> : <GuestJoinGate kind="retro" />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </UserProvider>
  );
}

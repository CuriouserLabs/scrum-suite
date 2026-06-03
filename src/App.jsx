import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import LandingPage from './pages/LandingPage';
import ProfileWidget from './components/ProfileWidget';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import RetroPage from './pages/RetroPage';
import './App.css';

function AppContent() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-icon">&#9830;</div>
      </div>
    );
  }

  if (!user) return <LandingPage />;

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-logo">&#9830; Scrum Suite</Link>
        <ProfileWidget />
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="/retro/:retroId" element={<RetroPage />} />
      </Routes>
    </div>
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

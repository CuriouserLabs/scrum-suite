import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import LoginScreen from './components/LoginScreen';
import ProfileWidget from './components/ProfileWidget';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import './App.css';

function AppContent() {
  const { user } = useUser();

  if (!user) return <LoginScreen />;

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-logo">&#9827; Sprint Poker</Link>
        <ProfileWidget />
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
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

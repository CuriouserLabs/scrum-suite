import { createContext, useContext, useState, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { getStoredUser, storeUser, clearStoredUser } from '../utils/storage';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());

  const login = useCallback((displayName) => {
    const newUser = { id: nanoid(), displayName: displayName.trim() };
    storeUser(newUser);
    setUser(newUser);
    return newUser;
  }, []);

  const updateName = useCallback((displayName) => {
    setUser((prev) => {
      const updated = { ...prev, displayName: displayName.trim() };
      storeUser(updated);
      return updated;
    });
  }, []);

  const logout = useCallback(() => {
    clearStoredUser();
    setUser(null);
  }, []);

  return (
    <UserContext.Provider value={{ user, login, updateName, logout }}>
      {children}
    </UserContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}

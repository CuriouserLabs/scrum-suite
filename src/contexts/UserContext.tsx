import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signInAnonymously, updateProfile, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../utils/firebase';
import type { User, UserContextValue } from '../types';

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Guest',
          photoURL: firebaseUser.photoURL,
          email: firebaseUser.email,
          isGuest: firebaseUser.isAnonymous,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  const login = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const loginAsGuest = useCallback(async (displayName: string) => {
    const cred = await signInAnonymously(auth);
    await updateProfile(cred.user, { displayName });
    // onAuthStateChanged fires before updateProfile completes (and won't refire
    // for a profile change), so push the resolved name into state ourselves.
    setUser({
      id: cred.user.uid,
      displayName,
      photoURL: null,
      email: null,
      isGuest: true,
    });
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, login, loginWithEmail, loginAsGuest, logout }}>
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

// For components rendered only on authenticated routes (guarded by AppContent),
// where `user` is guaranteed to be present.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuthUser(): User {
  const { user } = useUser();
  if (!user) throw new Error('useAuthUser must be used within an authenticated route');
  return user;
}

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  projectId: 'vote-9f5e2',
  appId: '1:605292698354:web:47de5aec79e27b4a9a8e6b',
  storageBucket: 'vote-9f5e2.firebasestorage.app',
  apiKey: 'AIzaSyA0S2hwmwGmagdlyGACDqD-IGpEVvTM92E',
  authDomain: 'vote-9f5e2.firebaseapp.com',
  messagingSenderId: '605292698354',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

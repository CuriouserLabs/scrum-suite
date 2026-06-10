import type {
  User,
  Role,
  ConnectionState,
  RoomState,
  RetroState,
  VoteValue,
  RetroSettings,
  PreviousRetroSummary,
} from './models';

// ===============================================================
// UserContext
// ===============================================================

export interface UserContextValue {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginAsGuest: (displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ===============================================================
// useRoom
// ===============================================================

export interface UseRoomResult {
  roomState: RoomState | null;
  status: ConnectionState;
  role: Role | null;
  endSession: () => void;
  submitVote: (value: VoteValue) => void;
  revealVotes: () => void;
  resetRound: () => void;
  setStoryTitle: (title: string) => void;
  makeCoHost: (userId: string) => void;
  handoverTo: (userId: string) => void;
}

// ===============================================================
// useRetro
// ===============================================================

export interface UseRetroResult {
  retroState: RetroState | null;
  status: ConnectionState;
  role: Role | null;
  endSession: () => void;
  updateTitle: (title: string) => void;
  addCard: (columnId: string, text: string) => void;
  deleteCard: (cardId: string) => void;
  editCard: (cardId: string, newText: string) => void;
  toggleVote: (cardId: string) => void;
  updateColumns: (columnIds: string[]) => void;
  updateSettings: (partial: Partial<RetroSettings>) => void;
  revealCards: () => void;
  makeCoHost: (userId: string) => void;
  handoverTo: (userId: string) => void;
  startTimer: (duration: number) => void;
  stopTimer: () => void;
  toggleActionItem: (itemId: string) => void;
  deleteActionItem: (itemId: string) => void;
  fetchPreviousRetros: () => Promise<PreviousRetroSummary[]>;
  importActionItems: (sourceRetroId: string) => Promise<number>;
}

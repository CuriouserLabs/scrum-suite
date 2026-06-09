import type { Timestamp } from 'firebase/firestore';

// ===============================================================
// Primitives & unions
// ===============================================================

/** A planning-poker vote: a story-point estimate or the "unsure" marker. */
export type VoteValue = number | '?';

/** Whether the current user controls the session. */
export type Role = 'host' | 'client';

/** Lifecycle of a stored session document. */
export type SessionStatus = 'active' | 'ended';

/** Connection state surfaced by the realtime hooks to the UI. */
export type ConnectionState =
  | 'connecting'
  | 'ready'
  | 'connected'
  | 'ended'
  | 'disconnected'
  | 'error';

// ===============================================================
// Auth
// ===============================================================

/** The app-level authenticated user (mapped from a Firebase user). */
export interface User {
  id: string;
  displayName: string;
  photoURL: string | null;
  email: string | null;
  /** True for anonymous guest users (joined a session by name only). */
  isGuest: boolean;
}

// ===============================================================
// Participants
// ===============================================================

/** A participant as stored inside the `participants` map (keyed by user id). */
export interface ParticipantData {
  displayName: string;
  photoURL: string | null;
  isHost: boolean;
  online: boolean;
  /** True when this participant joined as an anonymous guest. */
  isGuest: boolean;
}

/** A participant after `normalizeState` flattens the map into an array. */
export interface Participant extends ParticipantData {
  id: string;
}

// ===============================================================
// Retro entities
// ===============================================================

/** A retro card as stored inside the `cards` map (keyed by card id). */
export interface Card {
  columnId: string;
  text: string;
  authorId: string;
  votes: string[];
  createdAt: number;
}

/** A card enriched with its id and resolved author name for rendering. */
export interface CardWithId extends Card {
  id: string;
  authorName: string;
}

/** An action item as stored inside the `previousActionItems` map. */
export interface ActionItem {
  text: string;
  done: boolean;
  authorId: string;
  createdAt: number;
}

/** An action item enriched with its id for rendering. */
export interface ActionItemWithId extends ActionItem {
  id: string;
}

/** Retro board settings toggled by the host. */
export interface RetroSettings {
  anonymous: boolean;
  hideCards: boolean;
  revealed: boolean;
}

/** Shared countdown timer state for a retro. */
export interface Timer {
  duration: number;
  startedAt: number;
  running: boolean;
}

/** A retro column definition (static catalog entry). */
export interface Column {
  id: string;
  label: string;
  color: string;
  icon: string;
}

// ===============================================================
// Stored documents (raw, as they live in Firestore)
// ===============================================================

/** Raw planning-poker document — `participants` is a keyed map. */
export interface RoomDoc {
  hostId: string;
  activeHostId: string;
  status: SessionStatus;
  participants: Record<string, ParticipantData>;
  participantIds: string[];
  votes: Record<string, VoteValue>;
  revealed: boolean;
  round: number;
  storyTitle: string;
  coHosts: string[];
  createdAt: Timestamp;
}

/** Raw retro document — `participants`/`cards`/`previousActionItems` are maps. */
export interface RetroDoc {
  hostId: string;
  activeHostId: string;
  status: SessionStatus;
  participants: Record<string, ParticipantData>;
  participantIds: string[];
  coHosts: string[];
  columns: string[];
  cards: Record<string, Card>;
  previousActionItems: Record<string, ActionItem>;
  settings: RetroSettings;
  timer: Timer;
  title?: string;
  createdAt: Timestamp;
}

// ===============================================================
// Normalized client state (what the hooks expose to components)
// ===============================================================

/** Planning-poker state with `participants` flattened into an array. */
export interface RoomState extends Omit<RoomDoc, 'participants'> {
  participants: Participant[];
}

/** Retro state with `participants` flattened into an array. */
export interface RetroState extends Omit<RetroDoc, 'participants'> {
  participants: Participant[];
}

// ===============================================================
// Derived view models
// ===============================================================

/** A summary card for "your active sessions" on the home page. */
export interface ActiveSession {
  id: string;
  totalParticipants: number;
  onlineCount: number;
  createdAt: Date | null;
  isHost: boolean;
  storyTitle?: string;
  round?: number;
}

/** A summary of a previous retro available for action-item import. */
export interface PreviousRetroSummary {
  id: string;
  title: string;
  status: SessionStatus;
  createdAt: Date;
  actionItemCount: number;
  pendingCount: number;
}

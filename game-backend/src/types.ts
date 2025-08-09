// src/types.ts
export type UserId = string;
export type RoomId = string;
export type Passcode = string; // 4-digit string

export interface Player {
  userId: UserId;
  socketId: string | null;
}

export interface GuessEntry {
  pass: string; // user's guess
  correctDigits: number;
  correctPositions: number;
  time: number; // epoch ms
}

export interface Room {
  id: RoomId;
  players: Player[]; // length <= 2
  userSocketMap: Map<UserId, string>; // userId -> socketId
  sharedPassword: Passcode;
  rematchRequests: Set<UserId>;
  currentTurn: UserId | null;
  hintsUsed: Map<UserId, boolean>;
  guessHistory: Map<UserId, GuessEntry[]>;
}

/** Client -> Server events & payloads */
export interface JoinRoomPayload { roomId: RoomId; userId: UserId }
export interface ValidateGuessPayload { roomId: RoomId; userId: UserId; guess: string }
export interface RequestHintPayload { roomId: RoomId; userId: UserId }
export interface RequestRematchPayload { roomId: RoomId; userId: UserId }

export interface ClientToServerEvents {
  'join-room': (payload: JoinRoomPayload) => void;
  'validate-guess': (payload: ValidateGuessPayload) => void;
  'request-hint': (payload: RequestHintPayload) => void;
  'request-rematch': (payload: RequestRematchPayload) => void;
}

/** Server -> Client events & payloads */
export interface GuessHistoryViewEntry {
  pass: string;
  correctDigits: number;
  correctPositions: number;
  time: number;
  player: 'you' | 'opponent';
}

export interface ServerToClientEvents {
  'joined': (roomId: RoomId) => void;
  'room-update': (users: UserId[]) => void;
  'start-game': () => void;
  'start-rematch': () => void;
  'your-turn': (isYourTurn: boolean) => void;
  'guess-history': (payload: { history: GuessHistoryViewEntry[] }) => void;
  'guess-feedback': (entry: GuessEntry) => void;
  'opponent-guess-feedback': (entry: GuessEntry) => void;
  'player-won': (payload: { winner: UserId }) => void;
  'receive-hint': (hint: string | 'already-used' | null) => void;
  'room-full': () => void;
}

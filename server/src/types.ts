// ============================================================================
// Core domain types shared across the server (and mirrored on the client)
// ============================================================================

export type WordMode = "normal" | "hidden" | "combination";

export interface RoomSettings {
  maxPlayers: number; // 2-20
  rounds: number; // 2-10
  drawTimeSec: number; // 15-240
  wordCount: number; // 1-5 choices presented to drawer
  hints: number; // 0-5, 0 = disabled
  wordMode: WordMode;
  isPrivate: boolean;
  customWords?: string[]; // optional custom word list override/append
}

export const DEFAULT_SETTINGS: RoomSettings = {
  maxPlayers: 8,
  rounds: 3,
  drawTimeSec: 80,
  wordCount: 3,
  hints: 2,
  wordMode: "normal",
  isPrivate: false,
};

export type GamePhase = "lobby" | "choosing_word" | "drawing" | "round_end" | "game_over";

export interface PlayerPublic {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  isDrawing: boolean;
  hasGuessedCorrectly: boolean;
  connected: boolean;
  avatarSeed: string;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface StrokeStart {
  strokeId: string;
  x: number;
  y: number;
  color: string;
  size: number;
  tool: "brush" | "eraser";
}

export interface StrokeMove {
  strokeId: string;
  x: number;
  y: number;
}

export interface StrokeEnd {
  strokeId: string;
}

export interface FullStroke {
  strokeId: string;
  color: string;
  size: number;
  tool: "brush" | "eraser";
  points: StrokePoint[];
}

// ----------------------------------------------------------------------------
// Client -> Server payloads
// ----------------------------------------------------------------------------

export interface CreateRoomPayload {
  hostName: string;
  settings: Partial<RoomSettings>;
}

export interface JoinRoomPayload {
  roomId: string;
  playerName: string;
}

export interface WordChosenPayload {
  word: string;
}

export interface DrawStartPayload {
  strokeId: string;
  x: number;
  y: number;
  color: string;
  size: number;
  tool: "brush" | "eraser";
}

export interface DrawMovePayload {
  strokeId: string;
  x: number;
  y: number;
}

export interface DrawEndPayload {
  strokeId: string;
}

export interface GuessPayload {
  text: string;
}

export interface ChatPayload {
  text: string;
}

export interface UpdateSettingsPayload {
  settings: Partial<RoomSettings>;
}

export interface KickPayload {
  playerId: string;
}

// ----------------------------------------------------------------------------
// Server -> Client payloads
// ----------------------------------------------------------------------------

export interface RoomCreatedPayload {
  roomId: string;
  playerId: string;
  settings: RoomSettings;
}

export interface JoinedRoomPayload {
  roomId: string;
  playerId: string;
  players: PlayerPublic[];
  settings: RoomSettings;
  hostId: string;
}

export interface PlayerJoinedPayload {
  player: PlayerPublic;
  players: PlayerPublic[];
}

export interface PlayerLeftPayload {
  playerId: string;
  players: PlayerPublic[];
  newHostId?: string;
}

export interface GameStatePayload {
  phase: GamePhase;
  round: number;
  totalRounds: number;
  drawerId: string | null;
  /** Word is only ever sent to the drawer; everyone else gets `blank` */
  word: string | null;
  blank: string | null; // e.g. "_ _ a _ _"
  timeLeft: number;
  hintsRevealed: number;
}

export interface RoundStartPayload {
  drawerId: string;
  drawerName: string;
  wordOptions: string[] | null; // null for everyone except the drawer
  drawTime: number;
  round: number;
  totalRounds: number;
}

export interface RoundEndPayload {
  word: string;
  scores: PlayerPublic[];
  nextDrawerId: string | null;
  reason: "time_up" | "all_guessed" | "drawer_left";
}

export interface GameOverPayload {
  winner: PlayerPublic;
  leaderboard: PlayerPublic[];
}

export interface DrawDataPayload {
  type: "start" | "move" | "end";
  stroke: DrawStartPayload | DrawMovePayload | DrawEndPayload;
}

export interface GuessResultPayload {
  correct: boolean;
  playerId: string;
  playerName: string;
  points: number;
  isClose?: boolean; // "close guess" feedback, private to guesser
}

export interface ChatMessagePayload {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  type: "chat" | "system" | "correct_guess";
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface HintUpdatePayload {
  blank: string;
  hintsRevealed: number;
}

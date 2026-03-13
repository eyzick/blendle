export type DifficultyLevel = 1 | 2 | 3 | 4;
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface BlendleStats {
  totalPlayed: number;
  currentStreak: number;
  bestAccuracy: number;
  averageAccuracy: number;
}

export interface BlendleAttemptPayload {
  guessHex: string;
  targetHex: string;
  accuracy: number;
  distance: number;
  submittedAt: string;
  durationMs: number;
  shareText: string;
}

export interface BlendleAttemptResponse {
  attempt: BlendleAttemptPayload;
  stats: BlendleStats;
  alreadyPlayed: boolean;
}

export interface BlendleTodayResponse {
  date: string;
  puzzleId: string;
  puzzleNumber: number;
  difficulty: DifficultyLevel;
  difficultyLabel: string;
  colorAHex: string;
  colorBHex: string;
  stats: BlendleStats;
  attempt?: BlendleAttemptPayload;
}

export interface PuzzleRecord {
  id: string;
  puzzleNumber: number;
  dateKey: string;
  difficulty: DifficultyLevel;
  colorAHex: string;
  colorBHex: string;
  targetHex: string;
  seed: string;
  meta: JsonValue;
  createdAt: string;
}

export interface UpsertPuzzleInput {
  puzzleNumber: number;
  dateKey: string;
  difficulty: DifficultyLevel;
  colorAHex: string;
  colorBHex: string;
  targetHex: string;
  seed: string;
  meta: JsonValue;
}

export interface PlayerRecord {
  id: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface AttemptRecord {
  id: string;
  playerId: string;
  puzzleId: string;
  guessHex: string;
  accuracy: number;
  distance: number;
  startedAt: string;
  firstActionAt: string | null;
  submittedAt: string;
  durationMs: number;
  createdAt: string;
}

export interface CreateAttemptInput {
  playerId: string;
  puzzleId: string;
  guessHex: string;
  accuracy: number;
  distance: number;
  startedAt: string;
  firstActionAt: string | null;
  submittedAt: string;
  durationMs: number;
}

export interface AttemptSummary extends AttemptRecord {
  puzzleDateKey: string;
  puzzleNumber: number;
  targetHex: string;
}

export interface GameStore {
  upsertPlayer(playerId: string): Promise<PlayerRecord>;
  getPuzzleByDate(dateKey: string): Promise<PuzzleRecord | null>;
  getPuzzleById(puzzleId: string): Promise<PuzzleRecord | null>;
  savePuzzle(input: UpsertPuzzleInput): Promise<PuzzleRecord>;
  getAttempt(playerId: string, puzzleId: string): Promise<AttemptRecord | null>;
  createAttempt(input: CreateAttemptInput): Promise<AttemptRecord>;
  deleteAttempt(playerId: string, puzzleId: string): Promise<void>;
  getAttemptsForPlayer(playerId: string): Promise<AttemptSummary[]>;
}

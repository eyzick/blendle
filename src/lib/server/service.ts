import "server-only";

import { normalizeHex } from "@/src/lib/color";
import { buildShareText, generateDailyPuzzle, getDifficultyLabel, scoreBlendleGuess } from "@/src/lib/blendle";
import { addDaysToDateKey, getTodayDateKey } from "@/src/lib/date";
import type {
  AttemptRecord,
  AttemptSummary,
  BlendleAttemptPayload,
  BlendleAttemptResponse,
  BlendleStats,
  BlendleTodayResponse,
  PuzzleRecord
} from "@/src/lib/types";
import { getGameStore } from "@/src/lib/server/store";

export class BlendleServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "BlendleServiceError";
    this.statusCode = statusCode;
  }
}

function roundTo(value: number, digits: number) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

async function ensurePuzzle(dateKey: string) {
  const store = getGameStore();
  const existingPuzzle = await store.getPuzzleByDate(dateKey);

  if (existingPuzzle) {
    return existingPuzzle;
  }

  return store.savePuzzle(generateDailyPuzzle(dateKey));
}

function buildAttemptPayload(puzzle: PuzzleRecord, attempt: AttemptRecord): BlendleAttemptPayload {
  return {
    guessHex: attempt.guessHex,
    targetHex: puzzle.targetHex,
    accuracy: roundTo(attempt.accuracy, 1),
    distance: roundTo(attempt.distance, 2),
    submittedAt: attempt.submittedAt,
    durationMs: attempt.durationMs,
    shareText: buildShareText(puzzle.puzzleNumber, attempt.accuracy)
  };
}

function buildStats(attempts: AttemptSummary[], todayDateKey: string): BlendleStats {
  if (attempts.length === 0) {
    return {
      totalPlayed: 0,
      currentStreak: 0,
      bestAccuracy: 0,
      averageAccuracy: 0
    };
  }

  const dateKeys = new Set(attempts.map((attempt) => attempt.puzzleDateKey));
  let currentStreak = 0;
  let cursor = todayDateKey;

  while (dateKeys.has(cursor)) {
    currentStreak += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }

  const bestAccuracy = Math.max(...attempts.map((attempt) => attempt.accuracy));
  const averageAccuracy =
    attempts.reduce((total, attempt) => total + attempt.accuracy, 0) / attempts.length;

  return {
    totalPlayed: attempts.length,
    currentStreak,
    bestAccuracy: roundTo(bestAccuracy, 1),
    averageAccuracy: roundTo(averageAccuracy, 1)
  };
}

function sanitizeTimestamp(
  value: unknown,
  submittedAt: Date,
  earliestAllowed: Date
) {
  if (typeof value !== "string") {
    return null;
  }

  const candidate = new Date(value);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  if (candidate > submittedAt || candidate < earliestAllowed) {
    return null;
  }

  return candidate.toISOString();
}

export async function getTodayBlendle(playerId: string): Promise<BlendleTodayResponse> {
  const store = getGameStore();
  const dateKey = getTodayDateKey();
  const puzzle = await ensurePuzzle(dateKey);

  await store.upsertPlayer(playerId);

  const [attempt, attempts] = await Promise.all([
    store.getAttempt(playerId, puzzle.id),
    store.getAttemptsForPlayer(playerId)
  ]);

  return {
    date: puzzle.dateKey,
    puzzleId: puzzle.id,
    puzzleNumber: puzzle.puzzleNumber,
    difficulty: puzzle.difficulty,
    difficultyLabel: getDifficultyLabel(puzzle.difficulty),
    colorAHex: puzzle.colorAHex,
    colorBHex: puzzle.colorBHex,
    stats: buildStats(attempts, dateKey),
    attempt: attempt ? buildAttemptPayload(puzzle, attempt) : undefined
  };
}

interface SubmitAttemptInput {
  playerId: string;
  puzzleId: string;
  guessHex: string;
  startedAt?: string;
  firstActionAt?: string;
}

export async function submitBlendleAttempt(
  input: SubmitAttemptInput
): Promise<BlendleAttemptResponse> {
  const store = getGameStore();
  const dateKey = getTodayDateKey();
  const puzzle = await ensurePuzzle(dateKey);

  await store.upsertPlayer(input.playerId);

  if (input.puzzleId !== puzzle.id) {
    throw new BlendleServiceError("That puzzle is no longer active.", 409);
  }

  const existingAttempt = await store.getAttempt(input.playerId, puzzle.id);
  if (existingAttempt) {
    const attempts = await store.getAttemptsForPlayer(input.playerId);
    return {
      attempt: buildAttemptPayload(puzzle, existingAttempt),
      stats: buildStats(attempts, dateKey),
      alreadyPlayed: true
    };
  }

  let guessHex = "";
  try {
    guessHex = normalizeHex(input.guessHex);
  } catch {
    throw new BlendleServiceError("Please submit a valid HEX color.", 400);
  }

  const submittedAt = new Date();
  const earliestAllowed = new Date(submittedAt.getTime() - 36 * 60 * 60 * 1000);
  const startedAt = sanitizeTimestamp(input.startedAt, submittedAt, earliestAllowed) ?? submittedAt.toISOString();
  const firstActionAt =
    sanitizeTimestamp(
      input.firstActionAt,
      submittedAt,
      new Date(startedAt)
    ) ?? null;

  const { accuracy, distance } = scoreBlendleGuess(guessHex, puzzle.targetHex);
  const durationMs = Math.max(
    0,
    submittedAt.getTime() - new Date(startedAt).getTime()
  );

  const attempt = await store.createAttempt({
    playerId: input.playerId,
    puzzleId: puzzle.id,
    guessHex,
    accuracy,
    distance,
    startedAt,
    firstActionAt,
    submittedAt: submittedAt.toISOString(),
    durationMs
  });
  const attempts = await store.getAttemptsForPlayer(input.playerId);

  return {
    attempt: buildAttemptPayload(puzzle, attempt),
    stats: buildStats(attempts, dateKey),
    alreadyPlayed: false
  };
}

export async function resetTodayBlendleAttempt(playerId: string) {
  if (process.env.NODE_ENV === "production") {
    throw new BlendleServiceError("Reset is only available in development.", 404);
  }

  const store = getGameStore();
  const dateKey = getTodayDateKey();
  const puzzle = await ensurePuzzle(dateKey);

  await store.deleteAttempt(playerId, puzzle.id);

  return getTodayBlendle(playerId);
}

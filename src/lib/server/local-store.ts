import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  AttemptRecord,
  AttemptSummary,
  GameStore,
  PlayerRecord,
  PuzzleRecord
} from "@/src/lib/types";

interface LocalDatabase {
  puzzles: PuzzleRecord[];
  players: PlayerRecord[];
  attempts: AttemptRecord[];
}

const localDataPath = path.join(process.cwd(), ".data", "blendle-local.json");

function nowIso() {
  return new Date().toISOString();
}

async function readDatabase(): Promise<LocalDatabase> {
  try {
    const raw = await fs.readFile(localDataPath, "utf8");
    return JSON.parse(raw) as LocalDatabase;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { puzzles: [], players: [], attempts: [] };
    }

    throw error;
  }
}

async function writeDatabase(database: LocalDatabase) {
  await fs.mkdir(path.dirname(localDataPath), { recursive: true });
  await fs.writeFile(localDataPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
}

function compareIsoDescending(left: string, right: string) {
  return right.localeCompare(left);
}

export const localStore: GameStore = {
  async upsertPlayer(playerId) {
    const database = await readDatabase();
    const timestamp = nowIso();
    const existingPlayer = database.players.find((player) => player.id === playerId);

    if (existingPlayer) {
      existingPlayer.lastSeenAt = timestamp;
      await writeDatabase(database);
      return existingPlayer;
    }

    const player = {
      id: playerId,
      createdAt: timestamp,
      lastSeenAt: timestamp
    };

    database.players.push(player);
    await writeDatabase(database);
    return player;
  },

  async getPuzzleByDate(dateKey) {
    const database = await readDatabase();
    return database.puzzles.find((puzzle) => puzzle.dateKey === dateKey) ?? null;
  },

  async getPuzzleById(puzzleId) {
    const database = await readDatabase();
    return database.puzzles.find((puzzle) => puzzle.id === puzzleId) ?? null;
  },

  async savePuzzle(input) {
    const database = await readDatabase();
    const existingPuzzle = database.puzzles.find((puzzle) => puzzle.dateKey === input.dateKey);

    if (existingPuzzle) {
      Object.assign(existingPuzzle, input);
      await writeDatabase(database);
      return existingPuzzle;
    }

    const puzzle: PuzzleRecord = {
      id: randomUUID(),
      createdAt: nowIso(),
      ...input
    };

    database.puzzles.push(puzzle);
    await writeDatabase(database);
    return puzzle;
  },

  async getAttempt(playerId, puzzleId) {
    const database = await readDatabase();
    return (
      database.attempts.find(
        (attempt) => attempt.playerId === playerId && attempt.puzzleId === puzzleId
      ) ?? null
    );
  },

  async createAttempt(input) {
    const database = await readDatabase();
    const existingAttempt = database.attempts.find(
      (attempt) => attempt.playerId === input.playerId && attempt.puzzleId === input.puzzleId
    );

    if (existingAttempt) {
      return existingAttempt;
    }

    const attempt: AttemptRecord = {
      id: randomUUID(),
      createdAt: nowIso(),
      ...input
    };

    database.attempts.push(attempt);
    await writeDatabase(database);
    return attempt;
  },

  async deleteAttempt(playerId, puzzleId) {
    const database = await readDatabase();
    const nextAttempts = database.attempts.filter(
      (attempt) => !(attempt.playerId === playerId && attempt.puzzleId === puzzleId)
    );

    if (nextAttempts.length === database.attempts.length) {
      return;
    }

    database.attempts = nextAttempts;
    await writeDatabase(database);
  },

  async getAttemptsForPlayer(playerId) {
    const database = await readDatabase();
    return database.attempts
      .filter((attempt) => attempt.playerId === playerId)
      .map((attempt) => {
        const puzzle = database.puzzles.find((entry) => entry.id === attempt.puzzleId);

        if (!puzzle) {
          return null;
        }

        return {
          ...attempt,
          puzzleDateKey: puzzle.dateKey,
          puzzleNumber: puzzle.puzzleNumber,
          targetHex: puzzle.targetHex
        } satisfies AttemptSummary;
      })
      .filter((attempt): attempt is AttemptSummary => Boolean(attempt))
      .sort((left, right) => compareIsoDescending(left.puzzleDateKey, right.puzzleDateKey));
  }
};

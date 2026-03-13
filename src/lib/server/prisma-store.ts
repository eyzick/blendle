import "server-only";

import { Prisma } from "@prisma/client";

import type {
  AttemptRecord,
  AttemptSummary,
  GameStore,
  PlayerRecord,
  PuzzleRecord
} from "@/src/lib/types";
import { dateKeyToUtcDate } from "@/src/lib/date";

import { prisma } from "@/src/lib/server/prisma";

function mapPuzzle(record: {
  id: string;
  puzzleNumber: number;
  date: Date;
  difficulty: number;
  colorAHex: string;
  colorBHex: string;
  targetHex: string;
  seed: string;
  meta: unknown;
  createdAt: Date;
}): PuzzleRecord {
  return {
    id: record.id,
    puzzleNumber: record.puzzleNumber,
    dateKey: record.date.toISOString().slice(0, 10),
    difficulty: record.difficulty as PuzzleRecord["difficulty"],
    colorAHex: record.colorAHex,
    colorBHex: record.colorBHex,
    targetHex: record.targetHex,
    seed: record.seed,
    meta: (record.meta as PuzzleRecord["meta"]) ?? null,
    createdAt: record.createdAt.toISOString()
  };
}

function mapPlayer(record: {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
}): PlayerRecord {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    lastSeenAt: record.lastSeenAt.toISOString()
  };
}

function mapAttempt(record: {
  id: string;
  playerId: string;
  puzzleId: string;
  guessHex: string;
  accuracy: number;
  distance: number;
  startedAt: Date;
  firstActionAt: Date | null;
  submittedAt: Date;
  durationMs: number;
  createdAt: Date;
}): AttemptRecord {
  return {
    id: record.id,
    playerId: record.playerId,
    puzzleId: record.puzzleId,
    guessHex: record.guessHex,
    accuracy: record.accuracy,
    distance: record.distance,
    startedAt: record.startedAt.toISOString(),
    firstActionAt: record.firstActionAt?.toISOString() ?? null,
    submittedAt: record.submittedAt.toISOString(),
    durationMs: record.durationMs,
    createdAt: record.createdAt.toISOString()
  };
}

export const prismaStore: GameStore = {
  async upsertPlayer(playerId) {
    const player = await prisma.blendlePlayer.upsert({
      where: { id: playerId },
      create: { id: playerId },
      update: { lastSeenAt: new Date() }
    });

    return mapPlayer(player);
  },

  async getPuzzleByDate(dateKey) {
    const puzzle = await prisma.blendlePuzzle.findUnique({
      where: { date: dateKeyToUtcDate(dateKey) }
    });

    return puzzle ? mapPuzzle(puzzle) : null;
  },

  async getPuzzleById(puzzleId) {
    const puzzle = await prisma.blendlePuzzle.findUnique({
      where: { id: puzzleId }
    });

    return puzzle ? mapPuzzle(puzzle) : null;
  },

  async savePuzzle(input) {
    const puzzle = await prisma.blendlePuzzle.upsert({
      where: { date: dateKeyToUtcDate(input.dateKey) },
      update: {
        puzzleNumber: input.puzzleNumber,
        difficulty: input.difficulty,
        colorAHex: input.colorAHex,
        colorBHex: input.colorBHex,
        targetHex: input.targetHex,
        seed: input.seed,
        meta: input.meta ?? Prisma.DbNull
      },
      create: {
        puzzleNumber: input.puzzleNumber,
        date: dateKeyToUtcDate(input.dateKey),
        difficulty: input.difficulty,
        colorAHex: input.colorAHex,
        colorBHex: input.colorBHex,
        targetHex: input.targetHex,
        seed: input.seed,
        meta: input.meta ?? Prisma.DbNull
      }
    });

    return mapPuzzle(puzzle);
  },

  async getAttempt(playerId, puzzleId) {
    const attempt = await prisma.blendleAttempt.findUnique({
      where: {
        playerId_puzzleId: {
          playerId,
          puzzleId
        }
      }
    });

    return attempt ? mapAttempt(attempt) : null;
  },

  async createAttempt(input) {
    const attempt = await prisma.blendleAttempt.create({
      data: {
        playerId: input.playerId,
        puzzleId: input.puzzleId,
        guessHex: input.guessHex,
        accuracy: input.accuracy,
        distance: input.distance,
        startedAt: new Date(input.startedAt),
        firstActionAt: input.firstActionAt ? new Date(input.firstActionAt) : null,
        submittedAt: new Date(input.submittedAt),
        durationMs: input.durationMs
      }
    });

    return mapAttempt(attempt);
  },

  async deleteAttempt(playerId, puzzleId) {
    await prisma.blendleAttempt.deleteMany({
      where: {
        playerId,
        puzzleId
      }
    });
  },

  async getAttemptsForPlayer(playerId) {
    const attempts = await prisma.blendleAttempt.findMany({
      where: { playerId },
      include: {
        puzzle: true
      },
      orderBy: {
        submittedAt: "desc"
      }
    });

    return attempts.map(
      (attempt) =>
        ({
          ...mapAttempt(attempt),
          puzzleDateKey: attempt.puzzle.date.toISOString().slice(0, 10),
          puzzleNumber: attempt.puzzle.puzzleNumber,
          targetHex: attempt.puzzle.targetHex
        }) satisfies AttemptSummary
    );
  }
};

import "server-only";

import type { GameStore } from "@/src/lib/types";
import { localStore } from "@/src/lib/server/local-store";
import { prismaStore } from "@/src/lib/server/prisma-store";

export function getGameStore(): GameStore {
  if (process.env.BLENDLE_STORE === "local") {
    return localStore;
  }

  if (process.env.DATABASE_URL) {
    return prismaStore;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL is required in production. Set your Supabase pooled connection string before deploying."
    );
  }

  return localStore;
}


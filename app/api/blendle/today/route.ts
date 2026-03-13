import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getTodayBlendle } from "@/src/lib/server/service";

const playerCookieName = "blendle_player_id";

function getPlayerId(request: NextRequest) {
  return request.cookies.get(playerCookieName)?.value ?? randomUUID();
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const playerId = getPlayerId(request);
  const payload = await getTodayBlendle(playerId);
  const response = NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store"
    }
  });

  response.cookies.set({
    name: playerCookieName,
    value: playerId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365
  });

  return response;
}


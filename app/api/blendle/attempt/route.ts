import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { BlendleServiceError, submitBlendleAttempt } from "@/src/lib/server/service";

const playerCookieName = "blendle_player_id";

function getPlayerId(request: NextRequest) {
  return request.cookies.get(playerCookieName)?.value ?? randomUUID();
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const playerId = getPlayerId(request);

  try {
    const body = (await request.json()) as {
      puzzleId?: string;
      guessHex?: string;
      startedAt?: string;
      firstActionAt?: string;
    };

    if (!body?.puzzleId || !body?.guessHex) {
      return NextResponse.json(
        { message: "puzzleId and guessHex are required." },
        { status: 400 }
      );
    }

    const payload = await submitBlendleAttempt({
      playerId,
      puzzleId: body.puzzleId,
      guessHex: body.guessHex,
      startedAt: body.startedAt,
      firstActionAt: body.firstActionAt
    });
    const response = NextResponse.json(payload, {
      status: payload.alreadyPlayed ? 409 : 200,
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
  } catch (error) {
    if (error instanceof BlendleServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      { message: "Something went wrong while scoring that guess." },
      { status: 500 }
    );
  }
}


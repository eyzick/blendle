"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import { ColorWheel } from "@/src/components/color-wheel";
import { accuracyToEmoji } from "@/src/lib/blendle";
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from "@/src/lib/color";
import type { BlendleAttemptResponse, BlendleTodayResponse } from "@/src/lib/types";

const defaultControls = {
  hue: 282,
  saturation: 68,
  lightness: 56
};

const confettiPalette = ["#F17160", "#4AC2DD", "#E8B456", "#84CC16", "#8B5CF6"];

function displayDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00.000Z`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function toHslControls(hex: string) {
  const hsl = rgbToHsl(hexToRgb(hex));
  return {
    hue: hsl.h,
    saturation: hsl.s,
    lightness: hsl.l
  };
}

function difficultyTone(difficulty: number) {
  switch (difficulty) {
    case 1:
      return "bg-emerald-100 text-emerald-900";
    case 2:
      return "bg-amber-100 text-amber-900";
    case 3:
      return "bg-rose-100 text-rose-900";
    default:
      return "bg-sky-100 text-sky-900";
  }
}

function getConfettiStyle(piece: {
  color: string;
  delay: string;
  drift: string;
  duration: string;
  left: string;
  rotate: string;
}) {
  return {
    left: piece.left,
    backgroundColor: piece.color,
    animationDelay: piece.delay,
    animationDuration: piece.duration,
    transform: `rotate(${piece.rotate})`,
    ["--confetti-drift" as const]: piece.drift
  } as CSSProperties;
}

export function BlendleGame() {
  const [puzzle, setPuzzle] = useState<BlendleTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [controls, setControls] = useState(defaultControls);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const startedAtRef = useRef<string | null>(null);
  const firstActionAtRef = useRef<string | null>(null);
  const confettiTimeoutRef = useRef<number | null>(null);
  const modalActionRef = useRef<HTMLButtonElement | null>(null);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        left: `${(index * 11 + (index % 4) * 9) % 100}%`,
        delay: `${(index % 7) * 0.05}s`,
        duration: `${1.5 + (index % 5) * 0.16}s`,
        drift: `${-46 + (index % 8) * 12}px`,
        rotate: `${index * 31}deg`,
        color: confettiPalette[index % confettiPalette.length]
      })),
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadToday() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/blendle/today", { cache: "no-store" });
        const data = (await response.json()) as BlendleTodayResponse;

        if (!response.ok) {
          throw new Error("Unable to load today's puzzle.");
        }

        if (cancelled) {
          return;
        }

        setPuzzle(data);
        startedAtRef.current = new Date().toISOString();
        setIsResultModalOpen(false);
        setShowConfetti(false);

        if (data.attempt) {
          setControls(toHslControls(data.attempt.guessHex));
        } else {
          setControls(defaultControls);
          firstActionAtRef.current = null;
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load today's puzzle."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadToday();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isResultModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalActionRef.current?.focus();

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsResultModalOpen(false);
        setShowConfetti(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isResultModalOpen]);

  useEffect(
    () => () => {
      if (confettiTimeoutRef.current) {
        window.clearTimeout(confettiTimeoutRef.current);
      }
    },
    []
  );

  const guessHex = useMemo(
    () =>
      rgbToHex(
        hslToRgb({
          h: controls.hue,
          s: controls.saturation,
          l: controls.lightness
        })
      ),
    [controls]
  );
  const hasPlayed = Boolean(puzzle?.attempt);
  const isDevMode = process.env.NODE_ENV !== "production";

  function recordFirstAction() {
    if (!firstActionAtRef.current) {
      firstActionAtRef.current = new Date().toISOString();
    }
  }

  function openResultModal(withConfetti: boolean) {
    setShareMessage(null);
    setIsResultModalOpen(true);

    if (confettiTimeoutRef.current) {
      window.clearTimeout(confettiTimeoutRef.current);
    }

    if (withConfetti) {
      setShowConfetti(true);
      confettiTimeoutRef.current = window.setTimeout(() => {
        setShowConfetti(false);
      }, 2400);
      return;
    }

    setShowConfetti(false);
  }

  function closeResultModal() {
    setIsResultModalOpen(false);
    setShowConfetti(false);

    if (confettiTimeoutRef.current) {
      window.clearTimeout(confettiTimeoutRef.current);
    }
  }

  async function handleSubmit() {
    if (!puzzle || hasPlayed) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch("/api/blendle/attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          puzzleId: puzzle.puzzleId,
          guessHex,
          startedAt: startedAtRef.current,
          firstActionAt: firstActionAtRef.current
        })
      });
      const data = (await response.json()) as
        | BlendleAttemptResponse
        | { message?: string };

      if (!response.ok && response.status !== 409) {
        throw new Error(
          "message" in data
            ? data.message ?? "Unable to score that guess."
            : "Unable to score that guess."
        );
      }

      const result = data as BlendleAttemptResponse;
      setPuzzle((currentPuzzle) =>
        currentPuzzle
          ? {
              ...currentPuzzle,
              attempt: result.attempt,
              stats: result.stats
            }
          : currentPuzzle
      );

      openResultModal(!result.alreadyPlayed);

      if (result.alreadyPlayed) {
        setError("Today's attempt is already locked in on this device.");
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to score that guess."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShare() {
    if (!puzzle?.attempt) {
      return;
    }

    try {
      setShareMessage(null);

      if (navigator.share) {
        await navigator.share({
          title: `Blendle #${puzzle.puzzleNumber}`,
          text: puzzle.attempt.shareText
        });
        setShareMessage("Shared.");
        return;
      }

      await navigator.clipboard.writeText(puzzle.attempt.shareText);
      setShareMessage("Copied to clipboard.");
    } catch {
      setShareMessage("Share was cancelled.");
    }
  }

  async function handleDevReset() {
    try {
      setResetting(true);
      setError(null);
      setShareMessage(null);
      const response = await fetch("/api/blendle/dev/reset", {
        method: "POST"
      });
      const data = (await response.json()) as
        | BlendleTodayResponse
        | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in data
            ? data.message ?? "Unable to reset today's attempt."
            : "Unable to reset today's attempt."
        );
      }

      const nextPuzzle = data as BlendleTodayResponse;
      setPuzzle(nextPuzzle);
      setControls(defaultControls);
      startedAtRef.current = new Date().toISOString();
      firstActionAtRef.current = null;
      closeResultModal();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to reset today's attempt."
      );
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 md:px-8 md:py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-7rem] top-10 h-48 w-48 rounded-full bg-rose-300/30 blur-3xl animate-drift" />
        <div className="absolute right-[-5rem] top-24 h-56 w-56 rounded-full bg-sky-300/25 blur-3xl animate-drift" />
        <div className="absolute bottom-10 left-1/3 h-52 w-52 rounded-full bg-amber-200/20 blur-3xl animate-drift" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-6">
        <header className="blendle-panel animate-fade-up">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <span className="blendle-chip">Daily color logic</span>
              <div className="space-y-2">
                <h1 className="text-5xl font-semibold tracking-tight text-ink md:text-6xl">
                  Blendle
                </h1>
                <p className="max-w-2xl text-base text-slate-600 md:text-lg">
                  Two source swatches. One hidden mix. Pick a color, nudge the
                  brightness, and see how close your eyes can get.
                </p>
              </div>
            </div>

            {puzzle ? (
              <div className="grid grid-cols-2 gap-3 md:min-w-72">
                <div className="rounded-3xl bg-white/75 px-4 py-3 shadow-soft">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Puzzle</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    #{puzzle.puzzleNumber}
                  </p>
                </div>
                <div className="rounded-3xl bg-white/75 px-4 py-3 shadow-soft">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Date</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {displayDate(puzzle.date)}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="blendle-panel animate-fade-up [animation-delay:120ms]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Today&apos;s blend
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                  Guess the mixed color
                </h2>
              </div>
              {puzzle ? (
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${difficultyTone(
                    puzzle.difficulty
                  )}`}
                >
                  {puzzle.difficultyLabel}
                </span>
              ) : null}
            </div>

            <div className="mt-6 rounded-[2rem] bg-white/70 p-5 shadow-soft">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
                <div className="space-y-3">
                  <div
                    className="mx-auto h-28 w-28 rounded-[2rem] shadow-soft"
                    style={{ backgroundColor: puzzle?.colorAHex ?? "#F97316" }}
                  />
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Color A</p>
                  <p className="font-mono text-sm font-semibold text-slate-900">
                    {puzzle?.colorAHex ?? "......"}
                  </p>
                </div>

                <div className="text-3xl font-semibold text-slate-400">+</div>

                <div className="space-y-3">
                  <div
                    className="mx-auto h-28 w-28 rounded-[2rem] shadow-soft"
                    style={{ backgroundColor: puzzle?.colorBHex ?? "#14B8A6" }}
                  />
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Color B</p>
                  <p className="font-mono text-sm font-semibold text-slate-900">
                    {puzzle?.colorBHex ?? "......"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white/70 px-4 py-4 shadow-soft">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Attempts</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {hasPlayed ? "Locked" : "1 shot"}
                </p>
              </div>
              <div className="rounded-3xl bg-white/70 px-4 py-4 shadow-soft">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Streak</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {puzzle?.stats.currentStreak ?? 0}
                </p>
              </div>
              <div className="rounded-3xl bg-white/70 px-4 py-4 shadow-soft">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Best</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {puzzle ? `${puzzle.stats.bestAccuracy.toFixed(1)}%` : "0.0%"}
                </p>
              </div>
            </div>
          </section>

          <section className="blendle-panel animate-fade-up [animation-delay:220ms]">
            <div className="grid gap-6 md:grid-cols-[1fr_0.95fr]">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Pick the hue
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                    Spin the wheel
                  </h2>
                </div>

                <ColorWheel
                  disabled={loading || hasPlayed}
                  hue={controls.hue}
                  saturation={controls.saturation}
                  lightness={controls.lightness}
                  onInteract={recordFirstAction}
                  onChange={({ hue, saturation }) =>
                    setControls((current) => ({
                      ...current,
                      hue,
                      saturation
                    }))
                  }
                />
              </div>

              <div className="space-y-5">
                <div className="rounded-[2rem] bg-slate-950/90 p-5 text-white shadow-soft">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Preview</p>
                  <div
                    className="mt-4 h-44 rounded-[1.6rem] border border-white/20 shadow-inner"
                    style={{ backgroundColor: guessHex }}
                  />
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Current guess
                      </p>
                      <p className="mt-1 font-mono text-lg font-semibold">{guessHex}</p>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
                      {accuracyToEmoji(puzzle?.attempt?.accuracy ?? 100)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 rounded-[2rem] bg-white/70 p-5 shadow-soft">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"
                      htmlFor="lightness"
                    >
                      Brightness
                    </label>
                    <span className="text-sm font-semibold text-slate-900">
                      {Math.round(controls.lightness)}%
                    </span>
                  </div>
                  <input
                    id="lightness"
                    className="blendle-slider"
                    disabled={loading || hasPlayed}
                    max={85}
                    min={15}
                    onChange={(event) => {
                      recordFirstAction();
                      setControls((current) => ({
                        ...current,
                        lightness: Number(event.target.value)
                      }));
                    }}
                    type="range"
                    value={controls.lightness}
                  />
                  <p className="text-sm text-slate-600">
                    Drag for a lighter or moodier guess once the hue feels right.
                  </p>
                </div>

                <button
                  className="blendle-gradient-border w-full rounded-[1.4rem] px-5 py-4 text-base font-semibold text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading || submitting || hasPlayed}
                  onClick={handleSubmit}
                  type="button"
                >
                  {submitting ? "Scoring..." : hasPlayed ? "Submitted for today" : "Submit guess"}
                </button>

                {puzzle?.attempt ? (
                  <button
                    className="w-full rounded-[1.4rem] bg-slate-950 px-5 py-4 text-base font-semibold text-white transition hover:bg-slate-800"
                    onClick={() => openResultModal(false)}
                    type="button"
                  >
                    View result and share card
                  </button>
                ) : null}

                {puzzle?.attempt && isDevMode ? (
                  <button
                    className="w-full rounded-[1.4rem] border border-dashed border-amber-300 bg-amber-50 px-5 py-4 text-base font-semibold text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={resetting}
                    onClick={handleDevReset}
                    type="button"
                  >
                    {resetting ? "Resetting local attempt..." : "Reset today's solve for local testing"}
                  </button>
                ) : null}

                <p className="text-sm text-slate-600">
                  One attempt per day. Everyone gets the same puzzle based on the
                  New York date.
                </p>
              </div>
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {error}
              </div>
            ) : null}
          </section>
        </div>

        {loading ? (
          <section className="blendle-panel animate-fade-up [animation-delay:320ms]">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="h-40 animate-pulse rounded-[2rem] bg-white/70" />
              <div className="h-40 animate-pulse rounded-[2rem] bg-white/70" />
              <div className="h-40 animate-pulse rounded-[2rem] bg-white/70" />
            </div>
          </section>
        ) : null}

        {puzzle?.attempt ? (
          <section className="blendle-panel animate-fade-up [animation-delay:320ms]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Solved
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                  {puzzle.attempt.accuracy.toFixed(1)}% accuracy
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Your result is locked in for today. Open the result modal to
                  compare swatches and share the card.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                  DeltaE {puzzle.attempt.distance.toFixed(2)}
                </div>
                <button
                  className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950 shadow-soft transition hover:-translate-y-0.5"
                  onClick={() => openResultModal(false)}
                  type="button"
                >
                  Open result modal
                </button>
                {isDevMode ? (
                  <button
                    className="rounded-full border border-dashed border-amber-300 bg-amber-50 px-5 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={resetting}
                    onClick={handleDevReset}
                    type="button"
                  >
                    {resetting ? "Resetting..." : "Reset for dev"}
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {puzzle?.attempt && isResultModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
          <button
            aria-label="Close results"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={closeResultModal}
            type="button"
          />

          {showConfetti ? (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {confettiPieces.map((piece) => (
                <span
                  key={piece.id}
                  className="blendle-confetti-piece"
                  style={getConfettiStyle(piece)}
                />
              ))}
            </div>
          ) : null}

          <div
            aria-labelledby="blendle-result-title"
            aria-modal="true"
            className="blendle-modal-card relative w-full max-w-4xl overflow-hidden rounded-[2.2rem] border border-white/70 bg-[#fffaf1] p-5 shadow-[0_34px_140px_rgba(15,23,42,0.28)] md:p-7"
            role="dialog"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <span className="blendle-chip bg-emerald-100 text-emerald-900">
                Solved
              </span>
              <button
                aria-label="Close results"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-soft transition hover:-translate-y-0.5 hover:bg-slate-50"
                onClick={closeResultModal}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
              <div className="space-y-5">
                <div className="space-y-3">
                  <div>
                    <h2
                      className="text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl"
                      id="blendle-result-title"
                    >
                      {puzzle.attempt.accuracy.toFixed(1)}% accuracy
                    </h2>
                    <p className="mt-2 max-w-xl text-sm text-slate-600 md:text-base">
                      Nice read. Your result is locked in for Blendle #{puzzle.puzzleNumber}.
                      Share it while the reveal is still on screen.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <article className="rounded-[2rem] bg-white p-4 shadow-soft">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Your guess
                    </p>
                    <div
                      className="mt-4 h-40 rounded-[1.5rem] shadow-soft"
                      style={{ backgroundColor: puzzle.attempt.guessHex }}
                    />
                    <p className="mt-4 font-mono text-sm font-semibold text-slate-900">
                      {puzzle.attempt.guessHex}
                    </p>
                  </article>

                  <article className="rounded-[2rem] bg-white p-4 shadow-soft">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Actual blend
                    </p>
                    <div
                      className="mt-4 h-40 rounded-[1.5rem] shadow-soft"
                      style={{ backgroundColor: puzzle.attempt.targetHex }}
                    />
                    <p className="mt-4 font-mono text-sm font-semibold text-slate-900">
                      {puzzle.attempt.targetHex}
                    </p>
                  </article>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-3xl bg-white px-4 py-4 shadow-soft">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">DeltaE</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {puzzle.attempt.distance.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white px-4 py-4 shadow-soft">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Streak</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {puzzle.stats.currentStreak}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white px-4 py-4 shadow-soft">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Average</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {puzzle.stats.averageAccuracy.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white px-4 py-4 shadow-soft">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Time</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {Math.max(1, Math.round(puzzle.attempt.durationMs / 1000))}s
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-[2rem] border border-[#ece2ce] bg-[#f6efe1] p-5 text-slate-900 shadow-soft md:p-6">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Share card
                  </p>
                  <p className="text-sm leading-6 text-slate-600">
                    Copy or share the exact result text while it is front and center.
                  </p>
                </div>

                <pre className="rounded-[1.6rem] border border-white/80 bg-white px-5 py-5 font-mono text-sm leading-7 text-slate-900 shadow-soft">
                  {puzzle.attempt.shareText}
                </pre>

                <button
                  className="w-full rounded-[1.4rem] bg-slate-950 px-5 py-4 text-base font-semibold text-white transition hover:bg-slate-800"
                  onClick={handleShare}
                  ref={modalActionRef}
                  type="button"
                >
                  Share result now
                </button>

                {shareMessage ? (
                  <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {shareMessage}
                  </p>
                ) : null}

                <button
                  className="w-full rounded-[1.4rem] border border-slate-300 bg-white px-5 py-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={closeResultModal}
                  type="button"
                >
                  Back to the board
                </button>

                {isDevMode ? (
                  <button
                    className="w-full rounded-[1.4rem] border border-dashed border-amber-300 bg-amber-100 px-5 py-4 text-base font-semibold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={resetting}
                    onClick={handleDevReset}
                    type="button"
                  >
                    {resetting ? "Resetting local attempt..." : "Reset today's solve in dev"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

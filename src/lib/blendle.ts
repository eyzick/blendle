import {
  blendLinearRgb,
  clamp,
  deltaE,
  hexToRgb,
  hslToRgb,
  rgbToHex,
  rgbToHsl,
  rgbToLab,
  scoreGuess
} from "@/src/lib/color";
import { getWeekday, puzzleNumberForDateKey } from "@/src/lib/date";
import type { DifficultyLevel, JsonValue, UpsertPuzzleInput } from "@/src/lib/types";

interface DifficultyPreset {
  level: DifficultyLevel;
  label: string;
  hueGap: [number, number];
  saturation: [number, number];
  lightness: [number, number];
  saturationDrift: number;
  lightnessDrift: number;
  minSourceDistance: number;
  minTargetDistance: number;
  minTargetSaturation: number;
}

const difficultyPresets: Record<DifficultyLevel, DifficultyPreset> = {
  1: {
    level: 1,
    label: "Easy",
    hueGap: [95, 180],
    saturation: [62, 90],
    lightness: [42, 64],
    saturationDrift: 18,
    lightnessDrift: 10,
    minSourceDistance: 28,
    minTargetDistance: 11,
    minTargetSaturation: 18
  },
  2: {
    level: 2,
    label: "Medium",
    hueGap: [42, 120],
    saturation: [50, 84],
    lightness: [38, 68],
    saturationDrift: 22,
    lightnessDrift: 13,
    minSourceDistance: 22,
    minTargetDistance: 9,
    minTargetSaturation: 14
  },
  3: {
    level: 3,
    label: "Hard",
    hueGap: [10, 58],
    saturation: [45, 78],
    lightness: [35, 70],
    saturationDrift: 14,
    lightnessDrift: 8,
    minSourceDistance: 18,
    minTargetDistance: 8,
    minTargetSaturation: 12
  },
  4: {
    level: 4,
    label: "Special",
    hueGap: [128, 240],
    saturation: [55, 92],
    lightness: [36, 66],
    saturationDrift: 28,
    lightnessDrift: 16,
    minSourceDistance: 26,
    minTargetDistance: 10,
    minTargetSaturation: 16
  }
};

const weekdayDifficultyMap: Record<number, DifficultyLevel> = {
  0: 4,
  1: 1,
  2: 2,
  3: 3,
  4: 1,
  5: 2,
  6: 3
};

function seedFromString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createMulberry32(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(rng: () => number, min: number, max: number) {
  return min + rng() * (max - min);
}

function randomInt(rng: () => number, min: number, max: number) {
  return Math.floor(randomBetween(rng, min, max + 1));
}

function wrapHue(value: number) {
  return ((value % 360) + 360) % 360;
}

function getPreset(difficulty: DifficultyLevel) {
  return difficultyPresets[difficulty];
}

export function getDifficultyForDate(dateKey: string) {
  return weekdayDifficultyMap[getWeekday(dateKey)];
}

export function getDifficultyLabel(difficulty: DifficultyLevel) {
  return difficultyPresets[difficulty].label;
}

function samplePair(rng: () => number, preset: DifficultyPreset) {
  const hueA = randomInt(rng, 0, 359);
  const hueDelta = randomBetween(rng, preset.hueGap[0], preset.hueGap[1]);
  const hueDirection = rng() > 0.5 ? 1 : -1;
  const hueB = wrapHue(hueA + hueDirection * hueDelta);

  const saturationA = randomBetween(rng, preset.saturation[0], preset.saturation[1]);
  const lightnessA = randomBetween(rng, preset.lightness[0], preset.lightness[1]);

  const saturationB = clamp(
    saturationA + randomBetween(rng, -preset.saturationDrift, preset.saturationDrift),
    preset.saturation[0],
    preset.saturation[1]
  );
  const lightnessB = clamp(
    lightnessA + randomBetween(rng, -preset.lightnessDrift, preset.lightnessDrift),
    preset.lightness[0],
    preset.lightness[1]
  );

  return {
    colorAHsl: { h: hueA, s: saturationA, l: lightnessA },
    colorBHsl: { h: hueB, s: saturationB, l: lightnessB }
  };
}

function acceptCandidate(
  colorAHex: string,
  colorBHex: string,
  targetHex: string,
  preset: DifficultyPreset,
  attemptNumber: number
) {
  const sourceDistance = deltaE(
    rgbToLab(hexToRgb(colorAHex)),
    rgbToLab(hexToRgb(colorBHex))
  );
  const targetDistanceFromA = deltaE(
    rgbToLab(hexToRgb(targetHex)),
    rgbToLab(hexToRgb(colorAHex))
  );
  const targetDistanceFromB = deltaE(
    rgbToLab(hexToRgb(targetHex)),
    rgbToLab(hexToRgb(colorBHex))
  );
  const targetHsl = rgbToHsl(hexToRgb(targetHex));
  const relaxedSourceThreshold =
    attemptNumber > 1500 ? preset.minSourceDistance - 3 : preset.minSourceDistance;

  if (sourceDistance < relaxedSourceThreshold) {
    return null;
  }

  if (
    targetDistanceFromA < preset.minTargetDistance ||
    targetDistanceFromB < preset.minTargetDistance
  ) {
    return null;
  }

  if (targetHsl.l < 20 || targetHsl.l > 82) {
    return null;
  }

  if (targetHsl.s < preset.minTargetSaturation) {
    return null;
  }

  return {
    sourceDistance,
    targetDistanceFromA,
    targetDistanceFromB,
    targetHsl
  };
}

export function generateDailyPuzzle(dateKey: string): UpsertPuzzleInput {
  const difficulty = getDifficultyForDate(dateKey);
  const preset = getPreset(difficulty);
  const seed = seedFromString(`blendle:v1:${dateKey}`);
  const rng = createMulberry32(seed);

  for (let attemptNumber = 1; attemptNumber <= 3000; attemptNumber += 1) {
    const { colorAHsl, colorBHsl } = samplePair(rng, preset);
    const colorAHex = rgbToHex(hslToRgb(colorAHsl));
    const colorBHex = rgbToHex(hslToRgb(colorBHsl));
    const targetHex = rgbToHex(
      blendLinearRgb(hexToRgb(colorAHex), hexToRgb(colorBHex))
    );
    const accepted = acceptCandidate(
      colorAHex,
      colorBHex,
      targetHex,
      preset,
      attemptNumber
    );

    if (!accepted) {
      continue;
    }

    const meta = {
      sourceAHsl: { ...colorAHsl },
      sourceBHsl: { ...colorBHsl },
      targetHsl: { ...accepted.targetHsl },
      sourceDistance: accepted.sourceDistance,
      targetDistanceFromA: accepted.targetDistanceFromA,
      targetDistanceFromB: accepted.targetDistanceFromB,
      attempts: attemptNumber
    } satisfies JsonValue;

    return {
      puzzleNumber: puzzleNumberForDateKey(dateKey),
      dateKey,
      difficulty,
      colorAHex,
      colorBHex,
      targetHex,
      seed: seed.toString(16).padStart(8, "0"),
      meta
    };
  }

  throw new Error(`Unable to generate a puzzle for ${dateKey}`);
}

export function accuracyToEmoji(accuracy: number) {
  if (accuracy >= 95) {
    return "🟩";
  }

  if (accuracy >= 85) {
    return "🟨";
  }

  if (accuracy >= 70) {
    return "🟧";
  }

  return "🟥";
}

export function buildShareBar(accuracy: number) {
  return [20, 40, 60, 80, 100]
    .map((threshold) => {
      if (accuracy >= threshold) {
        return "🟩";
      }

      if (accuracy >= threshold - 10) {
        return "🟨";
      }

      if (accuracy >= threshold - 20) {
        return "🟧";
      }

      return "🟥";
    })
    .join("");
}

export function buildShareText(puzzleNumber: number, accuracy: number) {
  return `Blendle #${puzzleNumber}\n🎯 ${accuracy.toFixed(1)}%\n${buildShareBar(accuracy)}`;
}

export function scoreBlendleGuess(guessHex: string, targetHex: string) {
  return scoreGuess(guessHex, targetHex);
}

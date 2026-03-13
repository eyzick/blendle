export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export interface LabColor {
  l: number;
  a: number;
  b: number;
}

const HEX_COLOR_REGEX = /^#?(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{6})$/;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, digits: number) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function normalizeUnit(value: number) {
  return clamp(value, 0, 1);
}

export function isHexColor(value: string) {
  return HEX_COLOR_REGEX.test(value);
}

export function normalizeHex(value: string) {
  if (!isHexColor(value)) {
    throw new Error(`Invalid HEX color: ${value}`);
  }

  const raw = value.startsWith("#") ? value.slice(1) : value;
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((channel) => `${channel}${channel}`)
          .join("")
      : raw;

  return `#${expanded.toUpperCase()}`;
}

export function hexToRgb(value: string): RgbColor {
  const hex = normalizeHex(value).slice(1);

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}

export function rgbToHex(rgb: RgbColor) {
  const toHex = (value: number) =>
    clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0").toUpperCase();

  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const red = clamp(r, 0, 255) / 255;
  const green = clamp(g, 0, 255) / 255;
  const blue = clamp(b, 0, 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: roundTo(lightness * 100, 1) };
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
      break;
    case green:
      hue = (blue - red) / delta + 2;
      break;
    default:
      hue = (red - green) / delta + 4;
      break;
  }

  return {
    h: roundTo((hue / 6) * 360, 1),
    s: roundTo(saturation * 100, 1),
    l: roundTo(lightness * 100, 1)
  };
}

export function hslToRgb({ h, s, l }: HslColor): RgbColor {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = hue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma;
    green = x;
  } else if (huePrime < 2) {
    red = x;
    green = chroma;
  } else if (huePrime < 3) {
    green = chroma;
    blue = x;
  } else if (huePrime < 4) {
    green = x;
    blue = chroma;
  } else if (huePrime < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = lightness - chroma / 2;

  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255)
  };
}

export function srgbToLinear(channel: number) {
  const value = normalizeUnit(channel);
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(channel: number) {
  const value = normalizeUnit(channel);
  return value <= 0.0031308
    ? 12.92 * value
    : 1.055 * value ** (1 / 2.4) - 0.055;
}

export function blendLinearRgb(colorA: RgbColor, colorB: RgbColor): RgbColor {
  const red =
    (srgbToLinear(colorA.r / 255) + srgbToLinear(colorB.r / 255)) / 2;
  const green =
    (srgbToLinear(colorA.g / 255) + srgbToLinear(colorB.g / 255)) / 2;
  const blue =
    (srgbToLinear(colorA.b / 255) + srgbToLinear(colorB.b / 255)) / 2;

  return {
    r: Math.round(linearToSrgb(red) * 255),
    g: Math.round(linearToSrgb(green) * 255),
    b: Math.round(linearToSrgb(blue) * 255)
  };
}

export function rgbToLab(rgb: RgbColor): LabColor {
  const red = srgbToLinear(clamp(rgb.r, 0, 255) / 255);
  const green = srgbToLinear(clamp(rgb.g, 0, 255) / 255);
  const blue = srgbToLinear(clamp(rgb.b, 0, 255) / 255);

  const x = red * 0.4124564 + green * 0.3575761 + blue * 0.1804375;
  const y = red * 0.2126729 + green * 0.7151522 + blue * 0.072175;
  const z = red * 0.0193339 + green * 0.119192 + blue * 0.9503041;

  const referenceWhite = { x: 0.95047, y: 1, z: 1.08883 };

  const transform = (value: number) =>
    value > 216 / 24389
      ? Math.cbrt(value)
      : (24389 / 27 / 116) * value + 16 / 116;

  const fx = transform(x / referenceWhite.x);
  const fy = transform(y / referenceWhite.y);
  const fz = transform(z / referenceWhite.z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function getHueAngle(a: number, b: number) {
  if (a === 0 && b === 0) {
    return 0;
  }

  const angle = radiansToDegrees(Math.atan2(b, a));
  return angle >= 0 ? angle : angle + 360;
}

export function deltaE(colorA: LabColor, colorB: LabColor) {
  const l1 = colorA.l;
  const a1 = colorA.a;
  const b1 = colorA.b;
  const l2 = colorB.l;
  const a2 = colorB.a;
  const b2 = colorB.b;

  const c1 = Math.sqrt(a1 ** 2 + b1 ** 2);
  const c2 = Math.sqrt(a2 ** 2 + b2 ** 2);
  const averageC = (c1 + c2) / 2;
  const averageCPower = averageC ** 7;
  const g =
    0.5 *
    (1 - Math.sqrt(averageCPower / (averageCPower + 25 ** 7)));

  const a1Prime = (1 + g) * a1;
  const a2Prime = (1 + g) * a2;
  const c1Prime = Math.sqrt(a1Prime ** 2 + b1 ** 2);
  const c2Prime = Math.sqrt(a2Prime ** 2 + b2 ** 2);
  const h1Prime = getHueAngle(a1Prime, b1);
  const h2Prime = getHueAngle(a2Prime, b2);

  const deltaLPrime = l2 - l1;
  const deltaCPrime = c2Prime - c1Prime;

  let deltaHue = 0;
  if (c1Prime !== 0 && c2Prime !== 0) {
    const diff = h2Prime - h1Prime;
    if (Math.abs(diff) <= 180) {
      deltaHue = diff;
    } else if (diff > 180) {
      deltaHue = diff - 360;
    } else {
      deltaHue = diff + 360;
    }
  }

  const deltaHPrime =
    2 * Math.sqrt(c1Prime * c2Prime) * Math.sin(degreesToRadians(deltaHue / 2));
  const averageLPrime = (l1 + l2) / 2;
  const averageCPrime = (c1Prime + c2Prime) / 2;

  let averageHPrime = h1Prime + h2Prime;
  if (c1Prime !== 0 && c2Prime !== 0) {
    if (Math.abs(h1Prime - h2Prime) > 180) {
      averageHPrime =
        h1Prime + h2Prime < 360
          ? (h1Prime + h2Prime + 360) / 2
          : (h1Prime + h2Prime - 360) / 2;
    } else {
      averageHPrime = (h1Prime + h2Prime) / 2;
    }
  }

  const t =
    1 -
    0.17 * Math.cos(degreesToRadians(averageHPrime - 30)) +
    0.24 * Math.cos(degreesToRadians(averageHPrime * 2)) +
    0.32 * Math.cos(degreesToRadians(averageHPrime * 3 + 6)) -
    0.2 * Math.cos(degreesToRadians(averageHPrime * 4 - 63));
  const deltaTheta = 30 * Math.exp(-(((averageHPrime - 275) / 25) ** 2));
  const averageCPrimePower = averageCPrime ** 7;
  const rc =
    2 *
    Math.sqrt(averageCPrimePower / (averageCPrimePower + 25 ** 7));
  const sl =
    1 +
    (0.015 * (averageLPrime - 50) ** 2) /
      Math.sqrt(20 + (averageLPrime - 50) ** 2);
  const sc = 1 + 0.045 * averageCPrime;
  const sh = 1 + 0.015 * averageCPrime * t;
  const rt = -Math.sin(degreesToRadians(deltaTheta * 2)) * rc;

  const lightnessTerm = deltaLPrime / sl;
  const chromaTerm = deltaCPrime / sc;
  const hueTerm = deltaHPrime / sh;

  return Math.sqrt(
    lightnessTerm ** 2 +
      chromaTerm ** 2 +
      hueTerm ** 2 +
      rt * chromaTerm * hueTerm
  );
}

export function scoreGuess(guessHex: string, targetHex: string) {
  const guessLab = rgbToLab(hexToRgb(guessHex));
  const targetLab = rgbToLab(hexToRgb(targetHex));
  const distance = roundTo(deltaE(guessLab, targetLab), 2);
  const accuracy = roundTo(clamp(100 - distance, 0, 100), 1);

  return {
    accuracy,
    distance
  };
}

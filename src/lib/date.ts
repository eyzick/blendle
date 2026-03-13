export const BLENDLE_TIME_ZONE = "America/New_York";
export const BLENDLE_EPOCH_DATE = "2026-01-24";

const timeZoneFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BLENDLE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function partsToMap(parts: Intl.DateTimeFormatPart[]) {
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  ) as Record<string, string>;
}

export function getTodayDateKey(now = new Date()) {
  const parts = partsToMap(timeZoneFormatter.formatToParts(now));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

export function dateKeyToUtcDate(dateKey: string) {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

function dateKeyToUtcTime(dateKey: string) {
  return dateKeyToUtcDate(dateKey).getTime();
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const next = new Date(dateKeyToUtcTime(dateKey) + days * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

export function daysBetweenDateKeys(startDateKey: string, endDateKey: string) {
  const diff = dateKeyToUtcTime(endDateKey) - dateKeyToUtcTime(startDateKey);
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

export function puzzleNumberForDateKey(dateKey: string) {
  return daysBetweenDateKeys(BLENDLE_EPOCH_DATE, dateKey) + 1;
}

export function getWeekday(dateKey: string) {
  const date = new Date(dateKeyToUtcTime(dateKey) + 12 * 60 * 60 * 1000);
  return date.getUTCDay();
}


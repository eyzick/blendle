import { generateDailyPuzzle } from "../src/lib/blendle";
import { addDaysToDateKey, getTodayDateKey } from "../src/lib/date";
import { getGameStore } from "../src/lib/server/store";

function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    from: string;
    days: number;
  } = {
    from: getTodayDateKey(),
    days: 30
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if (current === "--from" && next) {
      options.from = next;
      index += 1;
    } else if (current === "--days" && next) {
      options.days = Number(next);
      index += 1;
    }
  }

  return options;
}

async function main() {
  const { from, days } = parseArgs();
  const store = getGameStore();

  for (let offset = 0; offset < days; offset += 1) {
    const dateKey = addDaysToDateKey(from, offset);
    const puzzle = await store.savePuzzle(generateDailyPuzzle(dateKey));
    process.stdout.write(
      `Stored ${puzzle.dateKey} -> #${puzzle.puzzleNumber} (${puzzle.colorAHex} + ${puzzle.colorBHex})\n`
    );
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

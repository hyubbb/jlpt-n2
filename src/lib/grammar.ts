import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Level } from "@/lib/levels";
import type { GrammarPoint } from "@/lib/grammar-types";

export async function loadGrammar(level: Level): Promise<GrammarPoint[]> {
  const file = path.join(process.cwd(), "src/data/grammar", `${level}.json`);

  try {
    return JSON.parse(await readFile(file, "utf8")) as GrammarPoint[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import type { Level } from "@/lib/levels";

export type VocabCard = {
  id: string;
  jlpt_level: Level;
  expression: string;
  reading: string;
  meaning_en: string;
  meaning_ko: string;
  front_text: string;
  back_text: string;
  tags: string;
  source_order: number;
  /** Headword with furigana markup: 畳{たた}む */
  expression_ruby: string;
  part_of_speech: string;
  /** Example sentence with furigana markup and [[target]] */
  example_jp: string;
  example_ko: string;
  example_tip: string;
};

type RawVocabRow = {
  id?: string;
  jlpt_level?: string;
  expression?: string;
  reading?: string;
  meaning_en?: string;
  meaning_ko?: string;
  front_text?: string;
  back_text?: string;
  tags?: string;
  source_order?: string;
  expression_ruby?: string;
  part_of_speech?: string;
  example_jp?: string;
  example_ko?: string;
  example_tip?: string;
};


function normalizeRow(row: RawVocabRow): VocabCard | null {
  const id = row.id?.trim();
  const expression = row.expression?.trim();
  const reading = row.reading?.trim();
  const meaningEn = row.meaning_en?.trim();

  const level = row.jlpt_level?.trim().toLowerCase();

  if (!id || !expression || !reading || !meaningEn || !level) {
    return null;
  }

  const meaningKo = row.meaning_ko?.trim() ?? "";

  return {
    id,
    jlpt_level: level as Level,
    expression,
    reading,
    meaning_en: meaningEn,
    meaning_ko: meaningKo,
    front_text: row.front_text?.trim() || expression,
    back_text:
      row.back_text?.trim() ||
      `읽기: ${reading} | 뜻(KO): ${meaningKo || "준비 중"} | Meaning(EN): ${meaningEn}`,
    // Upstream tags contain internal import metadata such as MediaMissing,
    // Genki_Ln.10, and legacy JLPT numbers. Only the useful level belongs in
    // the learner-facing card.
    tags: `JLPT_${level.toUpperCase()}`,
    source_order: Number(row.source_order) || 0,
    expression_ruby: row.expression_ruby?.trim() || expression,
    part_of_speech: row.part_of_speech?.trim() ?? "",
    example_jp: row.example_jp?.trim() ?? "",
    example_ko: row.example_ko?.trim() ?? "",
    example_tip: row.example_tip?.trim() ?? "",
  };
}

export async function loadVocabCards(level: Level): Promise<VocabCard[]> {
  const csv = await readFile(
    path.join(process.cwd(), "src/data/vocab", `${level}.csv`),
    "utf8",
  );
  const parsed = Papa.parse<RawVocabRow>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    const [firstError] = parsed.errors;
    throw new Error(
      `Failed to parse JLPT ${level.toUpperCase()} vocab CSV: ${firstError.message}`,
    );
  }

  return parsed.data
    .map(normalizeRow)
    .filter((card): card is VocabCard => card !== null)
    .sort((a, b) => a.source_order - b.source_order);
}

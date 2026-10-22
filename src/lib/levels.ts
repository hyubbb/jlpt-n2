export const LEVELS = ["n5", "n4", "n3", "n2", "n1"] as const;

export type Level = (typeof LEVELS)[number];

export const DEFAULT_LEVEL: Level = "n2";

export const LEVEL_LABELS: Record<Level, string> = {
  n5: "입문",
  n4: "기초",
  n3: "중급",
  n2: "중상급",
  n1: "상급",
};

export const LAST_LEVEL_STORAGE_KEY = "jlpt:last-level";

export function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value);
}

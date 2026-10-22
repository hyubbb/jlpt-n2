import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type ShowHide = "show" | "hide";
export type SentenceMode = "show" | "cloze" | "hide";

export type SentenceSettings = {
  word: ShowHide;
  sentence: SentenceMode;
  meaning: ShowHide;
  translation: ShowHide;
  furigana: ShowHide;
  rate: "1" | "0.7";
  hideMemorized: boolean;
};

export const defaultSentenceSettings: SentenceSettings = {
  word: "show",
  sentence: "show",
  meaning: "show",
  translation: "show",
  furigana: "show",
  rate: "1",
  hideMemorized: false,
};

export const sentenceSettingsAtom = atomWithStorage<SentenceSettings>(
  "jlpt-n2:sentence-settings:v1",
  defaultSentenceSettings,
);

export const memorizedSentenceIdsAtom = atomWithStorage<string[]>(
  "jlpt-n2:sentence-memorized:v1",
  [],
);

export const toggleMemorizedSentenceAtom = atom(
  null,
  (get, set, cardId: string) => {
    const ids = new Set(get(memorizedSentenceIdsAtom));

    if (ids.has(cardId)) {
      ids.delete(cardId);
    } else {
      ids.add(cardId);
    }

    set(memorizedSentenceIdsAtom, Array.from(ids));
  },
);

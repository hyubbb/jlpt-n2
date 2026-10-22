import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { VocabCard } from "@/lib/vocab";
import type { Level } from "@/lib/levels";

export type AppMode = "cards" | "sentences" | "grammar" | "quiz" | "progress";
export type DeckFilter = "all" | "due" | "bookmarked" | "weak";
export type StudyRating = "known" | "unsure" | "unknown";

export type CardProgress = {
  rating: StudyRating | null;
  firstStudiedAt: string | null;
  lastStudiedAt: string | null;
  lastRatedAt: string | null;
  reviewDueAt: string | null;
  correct: number;
  incorrect: number;
};

export type StudyProgressStorage = {
  schemaVersion: 1;
  deckId: "jlpt-n2";
  updatedAt: string;
  cards: Record<string, CardProgress>;
  bookmarkedIds: string[];
};

const defaultStudyProgress: StudyProgressStorage = {
  schemaVersion: 1,
  deckId: "jlpt-n2",
  updatedAt: new Date(0).toISOString(),
  cards: {},
  bookmarkedIds: [],
};

const reviewIntervalsByRating: Record<StudyRating, number> = {
  unknown: 1,
  unsure: 3,
  known: 7,
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export const cardsAtom = atom<VocabCard[]>([]);
export const selectedLevelsAtom = atom<Level[]>(["n2"]);
export const activeLevelCardsAtom = atom((get) => {
  const selected = new Set(get(selectedLevelsAtom));
  return get(cardsAtom).filter((card) => selected.has(card.jlpt_level));
});
export const currentCardIndexAtom = atom(0);
export const isFlippedAtom = atom(false);
export const searchQueryAtom = atom("");
// Kept across level pages so switching N1-N5 stays on the same tab.
export const appModeAtom = atomWithStorage<AppMode>("jlpt:app-mode", "cards");
export const deckFilterAtom = atom<DeckFilter>("all");
export const quizCardIndexAtom = atom(0);
export const quizSelectedAnswerAtom = atom<string | null>(null);
export const quizAnsweredCountAtom = atom(0);
export const quizCorrectCountAtom = atom(0);

export const studyProgressAtom = atomWithStorage<StudyProgressStorage>(
  "jlpt-n2:study-progress:v1",
  defaultStudyProgress,
);

export const bookmarkedIdsAtom = atom(
  (get) => new Set(get(studyProgressAtom).bookmarkedIds),
);

export const progressByCardIdAtom = atom((get) => get(studyProgressAtom).cards);

export const toggleBookmarkAtom = atom(null, (get, set, cardId: string) => {
  const studyProgress = get(studyProgressAtom);
  const bookmarkedIds = new Set(studyProgress.bookmarkedIds);

  if (bookmarkedIds.has(cardId)) {
    bookmarkedIds.delete(cardId);
  } else {
    bookmarkedIds.add(cardId);
  }

  set(studyProgressAtom, {
    ...studyProgress,
    bookmarkedIds: Array.from(bookmarkedIds),
    updatedAt: new Date().toISOString(),
  });
});

export const rateCardAtom = atom(
  null,
  (get, set, payload: { cardId: string; rating: StudyRating }) => {
    const studyProgress = get(studyProgressAtom);
    const previous = studyProgress.cards[payload.cardId];
    const now = new Date();
    const nowIso = now.toISOString();

    set(studyProgressAtom, {
      ...studyProgress,
      updatedAt: nowIso,
      cards: {
        ...studyProgress.cards,
        [payload.cardId]: {
          rating: payload.rating,
          firstStudiedAt: previous?.firstStudiedAt ?? nowIso,
          lastStudiedAt: nowIso,
          lastRatedAt: nowIso,
          reviewDueAt: addDays(
            now,
            reviewIntervalsByRating[payload.rating],
          ).toISOString(),
          correct: previous?.correct ?? 0,
          incorrect: previous?.incorrect ?? 0,
        },
      },
    });
  },
);

export const recordQuizAnswerAtom = atom(
  null,
  (get, set, payload: { cardId: string; isCorrect: boolean }) => {
    const studyProgress = get(studyProgressAtom);
    const previous = studyProgress.cards[payload.cardId];
    const nowIso = new Date().toISOString();

    set(studyProgressAtom, {
      ...studyProgress,
      updatedAt: nowIso,
      cards: {
        ...studyProgress.cards,
        [payload.cardId]: {
          rating: previous?.rating ?? null,
          firstStudiedAt: previous?.firstStudiedAt ?? nowIso,
          lastStudiedAt: nowIso,
          lastRatedAt: previous?.lastRatedAt ?? null,
          reviewDueAt: previous?.reviewDueAt ?? null,
          correct: (previous?.correct ?? 0) + (payload.isCorrect ? 1 : 0),
          incorrect: (previous?.incorrect ?? 0) + (payload.isCorrect ? 0 : 1),
        },
      },
    });
  },
);

const normalizedSearchQueryAtom = atom((get) =>
  get(searchQueryAtom).trim().toLocaleLowerCase(),
);

export const filteredCardsAtom = atom((get) => {
  const query = get(normalizedSearchQueryAtom);
  const cards = get(activeLevelCardsAtom);
  const deckFilter = get(deckFilterAtom);
  const bookmarkedIds = get(bookmarkedIdsAtom);
  const progressByCardId = get(progressByCardIdAtom);
  const now = Date.now();

  return cards.filter((card) => {
    const progress = progressByCardId[card.id];
    const reviewDueAt = progress?.reviewDueAt;
    const isDue =
      reviewDueAt !== null &&
      reviewDueAt !== undefined &&
      Date.parse(reviewDueAt) <= now;
    const isWeak =
      progress !== undefined &&
      (progress.rating === "unknown" || progress.incorrect > progress.correct);
    const matchesFilter =
      deckFilter === "all" ||
      (deckFilter === "bookmarked" && bookmarkedIds.has(card.id)) ||
      (deckFilter === "due" && isDue) ||
      (deckFilter === "weak" && isWeak);

    if (!matchesFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchable = [
      card.expression,
      card.reading,
      card.meaning_en,
      card.meaning_ko,
    ]
      .join(" ")
      .toLocaleLowerCase();

    return searchable.includes(query);
  });
});

export const activeCardAtom = atom((get) => {
  const cards = get(filteredCardsAtom);
  const index = get(currentCardIndexAtom);
  return cards[index] ?? null;
});

export const dueCardsAtom = atom((get) => {
  const cards = get(activeLevelCardsAtom);
  const progressByCardId = get(progressByCardIdAtom);
  const now = Date.now();

  return cards.filter((card) => {
    const reviewDueAt = progressByCardId[card.id]?.reviewDueAt;
    return (
      reviewDueAt !== null &&
      reviewDueAt !== undefined &&
      Date.parse(reviewDueAt) <= now
    );
  });
});

export const weakCardsAtom = atom((get) => {
  const cards = get(activeLevelCardsAtom);
  const progressByCardId = get(progressByCardIdAtom);

  return cards.filter((card) => {
    const progress = progressByCardId[card.id];
    return (
      progress !== undefined &&
      (progress.rating === "unknown" || progress.incorrect > progress.correct)
    );
  });
});

export const studyStatsAtom = atom((get) => {
  const cards = get(activeLevelCardsAtom);
  const progressByCardId = get(progressByCardIdAtom);
  const bookmarkedIds = get(bookmarkedIdsAtom);
  const dueCards = get(dueCardsAtom);
  const weakCards = get(weakCardsAtom);
  // Progress for every level shares one store; count only this deck's cards.
  const progressValues = cards
    .map((card) => progressByCardId[card.id])
    .filter((progress): progress is CardProgress => progress !== undefined);
  const bookmarkedInDeck = cards.filter((card) => bookmarkedIds.has(card.id)).length;
  const reviewed = progressValues.filter(
    (progress) =>
      progress.rating !== null || progress.correct > 0 || progress.incorrect > 0,
  ).length;
  const known = progressValues.filter(
    (progress) => progress.rating === "known",
  ).length;
  const unsure = progressValues.filter(
    (progress) => progress.rating === "unsure",
  ).length;
  const unknown = progressValues.filter(
    (progress) => progress.rating === "unknown",
  ).length;
  const totalCorrect = progressValues.reduce(
    (sum, progress) => sum + progress.correct,
    0,
  );
  const totalIncorrect = progressValues.reduce(
    (sum, progress) => sum + progress.incorrect,
    0,
  );
  const totalAttempts = totalCorrect + totalIncorrect;

  return {
    total: cards.length,
    reviewed,
    known,
    unsure,
    unknown,
    due: dueCards.length,
    weak: weakCards.length,
    bookmarked: bookmarkedInDeck,
    completionRate:
      cards.length === 0 ? 0 : Math.round((reviewed / cards.length) * 100),
    knownRate:
      cards.length === 0 ? 0 : Math.round((known / cards.length) * 100),
    totalCorrect,
    totalIncorrect,
    totalAttempts,
    accuracy:
      totalAttempts === 0
        ? null
        : Math.round((totalCorrect / totalAttempts) * 100),
  };
});

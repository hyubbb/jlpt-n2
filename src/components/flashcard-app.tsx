"use client";

import { useEffect, useMemo, useState } from "react";
import { Provider, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import {
  BarChart3,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Filter,
  RotateCcw,
  Search,
  Shuffle,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import type { VocabCard } from "@/lib/vocab";
import type { GrammarPoint } from "@/lib/grammar-types";
import { LAST_LEVEL_STORAGE_KEY, LEVEL_LABELS, LEVELS, type Level } from "@/lib/levels";
import { GrammarPanel } from "@/components/grammar-panel";
import { SentencePanel } from "@/components/sentence-panel";
import {
  activeLevelCardsAtom,
  appModeAtom,
  bookmarkedIdsAtom,
  cardsAtom,
  currentCardIndexAtom,
  deckFilterAtom,
  filteredCardsAtom,
  isFlippedAtom,
  progressByCardIdAtom,
  quizAnsweredCountAtom,
  quizCardIndexAtom,
  quizCorrectCountAtom,
  quizSelectedAnswerAtom,
  rateCardAtom,
  recordQuizAnswerAtom,
  searchQueryAtom,
  selectedLevelsAtom,
  studyStatsAtom,
  toggleBookmarkAtom,
  type AppMode,
  type DeckFilter,
  type StudyRating,
} from "@/store/flashcard-atoms";

type FlashcardAppProps = {
  level: Level;
  cards: VocabCard[];
  grammar: GrammarPoint[];
};

const modeItems: Array<{ id: AppMode; label: string }> = [
  { id: "cards", label: "카드" },
  { id: "sentences", label: "문장" },
  { id: "grammar", label: "문법" },
  { id: "quiz", label: "퀴즈" },
  { id: "progress", label: "진도" },
];

const filterItems: Array<{ id: DeckFilter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "due", label: "복습" },
  { id: "bookmarked", label: "북마크" },
  { id: "weak", label: "약점" },
];

function HydrateAtoms({
  cards,
  level,
  children,
}: React.PropsWithChildren<{ cards: VocabCard[]; level: Level }>) {
  useHydrateAtoms([
    [cardsAtom, cards],
    [selectedLevelsAtom, [level]],
  ]);
  return children;
}

export function FlashcardApp({ level, cards, grammar }: FlashcardAppProps) {
  useEffect(() => {
    localStorage.setItem(LAST_LEVEL_STORAGE_KEY, level);
  }, [level]);

  return (
    <Provider>
      <HydrateAtoms cards={cards} level={level}>
        <FlashcardWorkspace level={level} grammar={grammar} />
      </HydrateAtoms>
    </Provider>
  );
}

function FlashcardWorkspace({ level, grammar }: { level: Level; grammar: GrammarPoint[] }) {
  const allCards = useAtomValue(activeLevelCardsAtom);
  const [selectedLevels, setSelectedLevels] = useAtom(selectedLevelsAtom);
  const stats = useAtomValue(studyStatsAtom);
  const [mode, setMode] = useAtom(appModeAtom);
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const [deckFilter, setDeckFilter] = useAtom(deckFilterAtom);
  const setCurrentIndex = useSetAtom(currentCardIndexAtom);
  const setIsFlipped = useSetAtom(isFlippedAtom);
  const resetQuizAnswer = useSetAtom(quizSelectedAnswerAtom);
  const resetQuizIndex = useSetAtom(quizCardIndexAtom);

  function resetPosition() {
    setCurrentIndex(0);
    setIsFlipped(false);
    resetQuizAnswer(null);
    resetQuizIndex(0);
  }

  function handleSearch(value: string) {
    setSearchQuery(value);
    resetPosition();
  }

  function handleFilter(nextFilter: DeckFilter) {
    setDeckFilter(nextFilter);
    resetPosition();
  }

  function toggleLevel(nextLevel: Level) {
    setSelectedLevels((current) => {
      if (current.includes(nextLevel)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== nextLevel);
      }

      return LEVELS.filter(
        (item) => current.includes(item) || item === nextLevel,
      );
    });
    resetPosition();
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-zinc-200 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <BookOpen aria-hidden="true" className="h-4 w-4" />
                JLPT Study Deck
              </div>
              <h1 className="text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                JLPT 단어·문법
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-zinc-600">
                단어 {allCards.length.toLocaleString()}개 · 문법 {grammar.length.toLocaleString()}개를
                카드, 예문, 퀴즈로 이어서 학습하세요.
              </p>
              {mode === "grammar" ? (
                <nav aria-label="문법 급수" className="flex flex-wrap gap-1.5 pt-1">
                  {LEVELS.map((item) => (
                    <Link
                      key={item}
                      href={`/${item}`}
                      aria-current={item === level ? "page" : undefined}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                        item === level
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500 hover:text-zinc-950"
                      }`}
                    >
                      {item.toUpperCase()}
                      <span className="ml-1 text-xs opacity-65">
                        {LEVEL_LABELS[item]}
                      </span>
                    </Link>
                  ))}
                </nav>
              ) : (
                <fieldset className="flex flex-wrap items-center gap-1.5 pt-1">
                  <legend className="sr-only">학습할 JLPT 급수</legend>
                  {LEVELS.map((item) => {
                    const checked = selectedLevels.includes(item);
                    return (
                      <label
                        key={item}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                          checked
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-300 bg-white text-zinc-500 hover:border-zinc-500 hover:text-zinc-950"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLevel(item)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`grid h-3.5 w-3.5 place-items-center rounded-sm border ${
                            checked
                              ? "border-white/80 bg-white text-zinc-900"
                              : "border-zinc-400"
                          }`}
                        >
                          {checked ? <Check className="h-3 w-3" /> : null}
                        </span>
                        {item.toUpperCase()}
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:w-80">
              <label
                htmlFor="vocab-search"
                className="text-xs font-semibold uppercase tracking-normal text-zinc-500"
              >
                Search
              </label>
              <div className="flex h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 shadow-sm">
                <Search aria-hidden="true" className="h-4 w-4 text-zinc-500" />
                <input
                  id="vocab-search"
                  value={searchQuery}
                  onChange={(event) => handleSearch(event.target.value)}
                  placeholder={mode === "grammar" ? "문법, 뜻, 접속 검색" : "단어, 읽기, 한국어/영어 뜻 검색"}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-white p-1 shadow-sm sm:flex">
              {modeItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`h-10 rounded-md px-4 text-sm font-semibold transition ${
                    mode === item.id
                      ? "bg-emerald-600 text-white"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className={`flex flex-wrap items-center gap-2 ${mode === "grammar" ? "invisible" : ""}`}>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500">
                <Filter aria-hidden="true" className="h-4 w-4" />
                필터
              </span>
              {filterItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleFilter(item.id)}
                  className={`h-9 rounded-md border px-3 text-sm font-medium transition ${
                    deckFilter === item.id
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-zinc-300 bg-white text-zinc-600 hover:border-emerald-300"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <StatsStrip stats={stats} />
        </header>

        {mode === "cards" ? <CardsPanel /> : null}
        {mode === "sentences" ? <SentencePanel /> : null}
        {mode === "grammar" ? <GrammarPanel grammar={grammar} /> : null}
        {mode === "quiz" ? <QuizPanel /> : null}
        {mode === "progress" ? <ProgressPanel /> : null}
      </div>
    </main>
  );
}

function StatsStrip({ stats }: { stats: ReturnType<typeof useAtomValue<typeof studyStatsAtom>> }) {
  const items = [
    { label: "학습", value: `${stats.reviewed.toLocaleString()} / ${stats.total.toLocaleString()}` },
    { label: "암기", value: `${stats.knownRate}%` },
    { label: "복습", value: stats.due.toLocaleString() },
    { label: "약점", value: stats.weak.toLocaleString() },
    { label: "북마크", value: stats.bookmarked.toLocaleString() },
    { label: "퀴즈", value: stats.accuracy === null ? "-" : `${stats.accuracy}%` },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm"
        >
          <p className="text-xs font-semibold text-zinc-500">{item.label}</p>
          <p className="mt-1 text-lg font-semibold text-zinc-950">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function CardsPanel() {
  const filteredCards = useAtomValue(filteredCardsAtom);
  const bookmarkedIds = useAtomValue(bookmarkedIdsAtom);
  const progressByCardId = useAtomValue(progressByCardIdAtom);
  const [currentIndex, setCurrentIndex] = useAtom(currentCardIndexAtom);
  const [isFlipped, setIsFlipped] = useAtom(isFlippedAtom);
  const [shuffledCardIds, setShuffledCardIds] = useState<string[] | null>(null);
  const [revealedReadingCardId, setRevealedReadingCardId] = useState<
    string | null
  >(null);
  const toggleBookmark = useSetAtom(toggleBookmarkAtom);
  const rateCard = useSetAtom(rateCardAtom);

  const visibleCards = useMemo(() => {
    if (!shuffledCardIds) {
      return filteredCards;
    }

    const cardsById = new Map(filteredCards.map((card) => [card.id, card]));
    const shuffledCards = shuffledCardIds
      .map((cardId) => cardsById.get(cardId))
      .filter((card): card is VocabCard => card !== undefined);
    const shuffledIds = new Set(shuffledCards.map((card) => card.id));
    const newFilteredCards = filteredCards.filter(
      (card) => !shuffledIds.has(card.id),
    );

    return [...shuffledCards, ...newFilteredCards];
  }, [filteredCards, shuffledCardIds]);

  const activeCard = visibleCards[currentIndex] ?? null;
  const filteredCount = visibleCards.length;
  const position = activeCard ? currentIndex + 1 : 0;
  const isBookmarked = activeCard ? bookmarkedIds.has(activeCard.id) : false;
  const activeProgress = activeCard ? progressByCardId[activeCard.id] : null;
  const isShuffled = shuffledCardIds !== null;
  const isReadingRevealed =
    activeCard !== null && revealedReadingCardId === activeCard.id;

  useEffect(() => {
    if (filteredCount > 0 && currentIndex >= filteredCount) {
      setCurrentIndex(0);
      setIsFlipped(false);
    }
  }, [currentIndex, filteredCount, setCurrentIndex, setIsFlipped]);

  function goToPrevious() {
    if (filteredCount === 0) {
      return;
    }

    setCurrentIndex((index) => (index - 1 + filteredCount) % filteredCount);
    setIsFlipped(false);
    setRevealedReadingCardId(null);
  }

  function goToNext() {
    if (filteredCount === 0) {
      return;
    }

    setCurrentIndex((index) => (index + 1) % filteredCount);
    setIsFlipped(false);
    setRevealedReadingCardId(null);
  }

  function shuffleCurrentDeck() {
    if (filteredCount < 2) {
      return;
    }

    setShuffledCardIds(
      shuffleCards(filteredCards, String(Date.now())).map((card) => card.id),
    );
    setCurrentIndex(0);
    setIsFlipped(false);
    setRevealedReadingCardId(null);
  }

  function handleRating(rating: StudyRating) {
    if (!activeCard) {
      return;
    }

    rateCard({ cardId: activeCard.id, rating });
    goToNext();
  }

  function flipCard() {
    if (!activeCard) {
      return;
    }

    setIsFlipped((value) => !value);
    setRevealedReadingCardId(null);
  }

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    flipCard();
  }

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-5 py-6 sm:py-8">
      <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
        <span>
          {position.toLocaleString()} / {filteredCount.toLocaleString()} cards
        </span>
        <span>
          {activeProgress?.rating ? ratingLabel(activeProgress.rating) : "미학습"} ·{" "}
          {isBookmarked ? "bookmarked" : "not bookmarked"}
        </span>
      </div>

      <div
        role="button"
        tabIndex={activeCard ? 0 : -1}
        onClick={flipCard}
        onKeyDown={handleCardKeyDown}
        aria-disabled={!activeCard}
        aria-label="Flip current flashcard"
        className={`grid min-h-[360px] w-full max-w-3xl place-items-center rounded-lg border border-zinc-200 bg-white p-5 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:min-h-[420px] sm:p-8 ${
          activeCard
            ? "cursor-pointer hover:border-emerald-300"
            : "cursor-not-allowed opacity-70"
        }`}
      >
        {activeCard ? (
          <FlashcardFace
            card={activeCard}
            isFlipped={isFlipped}
            isReadingRevealed={isReadingRevealed}
            onRevealReading={() => setRevealedReadingCardId(activeCard.id)}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      <div className="grid w-full max-w-3xl grid-cols-4 gap-2 sm:flex sm:items-center sm:justify-center">
        <IconButton label="Previous card" onClick={goToPrevious} disabled={filteredCount === 0}>
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </IconButton>
        <IconButton label="Next card" onClick={goToNext} disabled={filteredCount === 0}>
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </IconButton>
        <IconButton
          label="Shuffle deck"
          onClick={shuffleCurrentDeck}
          disabled={filteredCount < 2}
          active={isShuffled}
        >
          <Shuffle aria-hidden="true" className="h-5 w-5" />
        </IconButton>
        <IconButton
          label={isBookmarked ? "Remove bookmark" : "Bookmark card"}
          onClick={() => activeCard && toggleBookmark(activeCard.id)}
          disabled={!activeCard}
          active={isBookmarked}
        >
          <Star
            aria-hidden="true"
            className={`h-5 w-5 ${isBookmarked ? "fill-current" : ""}`}
          />
        </IconButton>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-3 gap-2">
        <RatingButton
          label="모름"
          description="내일 다시"
          onClick={() => handleRating("unknown")}
          active={activeProgress?.rating === "unknown"}
        />
        <RatingButton
          label="헷갈림"
          description="3일 후"
          onClick={() => handleRating("unsure")}
          active={activeProgress?.rating === "unsure"}
        />
        <RatingButton
          label="앎"
          description="7일 후"
          onClick={() => handleRating("known")}
          active={activeProgress?.rating === "known"}
        />
      </div>

      <button
        type="button"
        onClick={() => {
          setIsFlipped(false);
          setRevealedReadingCardId(null);
        }}
        className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-zinc-600 transition hover:bg-white hover:text-zinc-950"
      >
        <RotateCcw aria-hidden="true" className="h-4 w-4" />
        앞면으로 돌리기
      </button>
    </section>
  );
}

function QuizPanel() {
  const filteredCards = useAtomValue(filteredCardsAtom);
  const [quizIndex, setQuizIndex] = useAtom(quizCardIndexAtom);
  const [selectedAnswer, setSelectedAnswer] = useAtom(quizSelectedAnswerAtom);
  const [answeredCount, setAnsweredCount] = useAtom(quizAnsweredCountAtom);
  const [correctCount, setCorrectCount] = useAtom(quizCorrectCountAtom);
  const recordQuizAnswer = useSetAtom(recordQuizAnswerAtom);
  const quizCard = filteredCards[quizIndex % Math.max(filteredCards.length, 1)] ?? null;
  const choices = useMemo(
    () => (quizCard ? makeMeaningChoices(quizCard, filteredCards, answeredCount) : []),
    [answeredCount, filteredCards, quizCard],
  );
  const correctAnswer = quizCard ? meaningText(quizCard) : "";
  const hasAnswered = selectedAnswer !== null;
  const isCorrect = selectedAnswer === correctAnswer;

  useEffect(() => {
    if (quizIndex >= filteredCards.length && filteredCards.length > 0) {
      setQuizIndex(0);
      setSelectedAnswer(null);
    }
  }, [filteredCards.length, quizIndex, setQuizIndex, setSelectedAnswer]);

  function selectAnswer(answer: string) {
    if (!quizCard || hasAnswered) {
      return;
    }

    const answerIsCorrect = answer === correctAnswer;
    setSelectedAnswer(answer);
    setAnsweredCount((count) => count + 1);
    setCorrectCount((count) => count + (answerIsCorrect ? 1 : 0));
    recordQuizAnswer({ cardId: quizCard.id, isCorrect: answerIsCorrect });
  }

  function nextQuestion() {
    if (filteredCards.length < 2) {
      return;
    }

    setQuizIndex((index) => (index + 1) % filteredCards.length);
    setSelectedAnswer(null);
  }

  function resetQuiz() {
    setQuizIndex(0);
    setSelectedAnswer(null);
    setAnsweredCount(0);
    setCorrectCount(0);
  }

  if (filteredCards.length < 2 || !quizCard) {
    return (
      <section className="grid flex-1 place-items-center py-10">
        <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <CircleHelp aria-hidden="true" className="mx-auto h-8 w-8 text-emerald-700" />
          <h2 className="mt-4 text-xl font-semibold">퀴즈를 만들 카드가 부족합니다</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            현재 검색/필터 결과가 2개 이상이어야 객관식 퀴즈를 만들 수 있어요.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
        <span>문제 {((quizIndex % filteredCards.length) + 1).toLocaleString()} / {filteredCards.length.toLocaleString()}</span>
        <span>
          {correctCount.toLocaleString()} / {answeredCount.toLocaleString()} correct
        </span>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-sm font-semibold text-emerald-700">뜻을 고르세요</p>
        <h2 className="mt-4 break-words text-4xl font-semibold leading-tight sm:text-6xl">
          {quizCard.expression}
        </h2>
        <p className="mt-3 break-words text-xl text-zinc-500">{quizCard.reading}</p>
      </div>

      <div className="grid gap-2">
        {choices.map((choice) => {
          const isChoiceCorrect = choice === correctAnswer;
          const isSelected = selectedAnswer === choice;

          return (
            <button
              key={choice}
              type="button"
              onClick={() => selectAnswer(choice)}
              className={`min-h-12 rounded-lg border px-4 py-3 text-left text-sm font-medium leading-6 transition ${
                hasAnswered && isChoiceCorrect
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : hasAnswered && isSelected
                    ? "border-rose-400 bg-rose-50 text-rose-700"
                    : "border-zinc-300 bg-white text-zinc-800 hover:border-emerald-300"
              }`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {hasAnswered ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm">
          <div className="flex items-center gap-2 font-semibold">
            {isCorrect ? (
              <Check aria-hidden="true" className="h-5 w-5 text-emerald-600" />
            ) : (
              <X aria-hidden="true" className="h-5 w-5 text-rose-600" />
            )}
            {isCorrect ? "정답입니다" : "오답입니다"}
          </div>
          <p className="mt-2 text-zinc-600">
            정답: {correctAnswer} · {quizCard.meaning_en}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={resetQuiz}
          className="h-11 rounded-md border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 transition hover:border-emerald-300"
        >
          다시 시작
        </button>
        <button
          type="button"
          onClick={nextQuestion}
          disabled={!hasAnswered}
          className="h-11 rounded-md bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          다음 문제
        </button>
      </div>
    </section>
  );
}

function ProgressPanel() {
  const stats = useAtomValue(studyStatsAtom);
  const progressByCardId = useAtomValue(progressByCardIdAtom);
  const allCards = useAtomValue(activeLevelCardsAtom);
  const hardestCards = allCards
    .filter((card) => progressByCardId[card.id]?.incorrect > 0)
    .sort(
      (a, b) =>
        (progressByCardId[b.id]?.incorrect ?? 0) -
        (progressByCardId[a.id]?.incorrect ?? 0),
    )
    .slice(0, 8);

  return (
    <section className="mx-auto w-full max-w-5xl py-6 sm:py-8">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <BarChart3 aria-hidden="true" className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-zinc-950">학습 요약</h2>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric label="진도율" value={`${stats.completionRate}%`} />
            <Metric label="암기율" value={`${stats.knownRate}%`} />
            <Metric label="앎" value={stats.known.toLocaleString()} />
            <Metric label="헷갈림" value={stats.unsure.toLocaleString()} />
            <Metric label="모름" value={stats.unknown.toLocaleString()} />
            <Metric label="퀴즈 정확도" value={stats.accuracy === null ? "-" : `${stats.accuracy}%`} />
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">약점 단어</h2>
          <div className="mt-4 space-y-2">
            {hardestCards.length > 0 ? (
              hardestCards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{card.expression}</span>
                  <span className="shrink-0 text-zinc-500">
                    오답 {progressByCardId[card.id]?.incorrect ?? 0}
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-md bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                아직 기록된 오답이 없습니다. 퀴즈를 풀면 여기에 약점이 쌓입니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FlashcardFace({
  card,
  isFlipped,
  isReadingRevealed,
  onRevealReading,
}: {
  card: VocabCard;
  isFlipped: boolean;
  isReadingRevealed: boolean;
  onRevealReading: () => void;
}) {
  const koreanMeaning = card.meaning_ko || "한국어 뜻 준비 중";

  if (isFlipped) {
    return (
      <div className="w-full space-y-7 text-center">
        <div>
          <p className="text-sm font-semibold text-emerald-700">뜻 / Meaning</p>
          <p className="mt-3 text-2xl font-semibold leading-tight text-zinc-950 sm:text-4xl">
            {koreanMeaning}
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">
            {card.meaning_en}
          </p>
        </div>
        <div className="mx-auto min-w-0 max-w-xl overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left">
          <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-[90px_minmax(0,1fr)]">
            <dt className="font-semibold text-zinc-500">표현</dt>
            <dd className="min-w-0 break-words text-zinc-900 [overflow-wrap:anywhere]">
              {card.expression}
            </dd>
            <dt className="font-semibold text-zinc-500">읽기</dt>
            <dd className="min-w-0 break-words text-zinc-900 [overflow-wrap:anywhere]">
              {card.reading}
            </dd>
            <dt className="font-semibold text-zinc-500">태그</dt>
            <dd className="min-w-0 break-words text-zinc-900 [overflow-wrap:anywhere]">
              {card.tags || `JLPT_${card.jlpt_level.toUpperCase()}`}
            </dd>
          </dl>
        </div>
        <p className="text-xs text-zinc-500">카드를 클릭하면 앞면으로 돌아갑니다.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 text-center">
      <div className="inline-flex rounded-md bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        Front
      </div>
      <div className="space-y-3">
        <p className="break-words text-5xl font-semibold leading-tight text-zinc-950 sm:text-7xl">
          {card.front_text}
        </p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRevealReading();
          }}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label="Show furigana reading"
          className="mx-auto block max-w-full rounded-md px-2 py-1 text-xl leading-8 text-zinc-500 transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:text-2xl"
        >
          <span
            className={`block break-words ${
              isReadingRevealed
                ? ""
                : "select-none rounded bg-[repeating-linear-gradient(135deg,#d4d4d8_0_3px,#a1a1aa_3px_6px)] px-2 text-transparent blur-[1px]"
            }`}
          >
            {card.reading}
          </span>
        </button>
      </div>
      <p className="text-xs text-zinc-500">카드를 클릭하면 뜻을 봅니다.</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center">
      <p className="text-xl font-semibold text-zinc-900">검색 결과가 없습니다</p>
      <p className="mt-2 text-sm text-zinc-500">
        다른 표현, 읽기, 한국어/영어 뜻으로 다시 검색해보세요.
      </p>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: React.PropsWithChildren<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-12 items-center justify-center rounded-md border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 sm:w-16 ${
        active
          ? "border-amber-300 bg-amber-100 text-amber-700"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700"
      }`}
    >
      {children}
    </button>
  );
}

function RatingButton({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-14 rounded-lg border px-3 py-2 text-center transition ${
        active
          ? "border-emerald-600 bg-emerald-50 text-emerald-700"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-300"
      }`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className="block text-xs text-zinc-500">{description}</span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function ratingLabel(rating: StudyRating) {
  const labels: Record<StudyRating, string> = {
    unknown: "모름",
    unsure: "헷갈림",
    known: "앎",
  };

  return labels[rating];
}

function meaningText(card: VocabCard) {
  return card.meaning_ko || card.meaning_en;
}

function makeMeaningChoices(card: VocabCard, cards: VocabCard[], seed: number) {
  const correct = meaningText(card);
  const choices = new Set<string>([correct]);
  const candidates = shuffleCards(
    cards.filter((candidate) => candidate.id !== card.id),
    `${card.id}-${seed}`,
  );

  for (const candidate of candidates) {
    const meaning = meaningText(candidate).trim();

    if (meaning && !choices.has(meaning)) {
      choices.add(meaning);
    }

    if (choices.size >= 4) {
      break;
    }
  }

  return shuffleStrings(Array.from(choices), `${seed}-${card.source_order}`);
}

function shuffleCards(cards: VocabCard[], seed: string) {
  return [...cards].sort(
    (a, b) => seededValue(`${seed}-${a.id}`) - seededValue(`${seed}-${b.id}`),
  );
}

function shuffleStrings(items: string[], seed: string) {
  return [...items].sort(
    (a, b) => seededValue(`${seed}-${a}`) - seededValue(`${seed}-${b}`),
  );
}

function seededValue(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashcardApp } from "@/components/flashcard-app";
import { loadGrammar } from "@/lib/grammar";
import { isLevel, LEVEL_LABELS, LEVELS } from "@/lib/levels";
import { loadVocabCards } from "@/lib/vocab";

type LevelPageProps = {
  params: Promise<{ level: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return LEVELS.map((level) => ({ level }));
}

export async function generateMetadata({ params }: LevelPageProps): Promise<Metadata> {
  const { level } = await params;
  if (!isLevel(level)) return {};

  return {
    title: `JLPT ${level.toUpperCase()} 단어·문법`,
    description: `JLPT ${level.toUpperCase()} (${LEVEL_LABELS[level]}) 단어 카드, 예문, 문법을 빈칸과 발음으로 외우는 학습장.`,
  };
}

export default async function LevelPage({ params }: LevelPageProps) {
  const { level } = await params;
  if (!isLevel(level)) notFound();

  const [cardDecks, grammar] = await Promise.all([
    Promise.all(LEVELS.map((item) => loadVocabCards(item))),
    loadGrammar(level),
  ]);

  // key: each level gets a fresh Jotai store so hydrated cards never leak between levels.
  return (
    <FlashcardApp
      key={level}
      level={level}
      cards={cardDecks.flat()}
      grammar={grammar}
    />
  );
}

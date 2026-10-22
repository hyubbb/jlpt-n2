"use client";

import { useMemo } from "react";
import { useAtomValue } from "jotai";
import type { VocabCard } from "@/lib/vocab";
import { rubyToKana } from "@/lib/ruby";
import { filteredCardsAtom } from "@/store/flashcard-atoms";
import { StudyList, type StudyItem } from "@/components/study-list";

const PART_ORDER = ["동사", "명사", "い형용사", "な형용사", "부사", "기타"];

const KANA_ROWS: Array<[string, string]> = [
  ["あ행", "あいうえおぁぃぅぇぉゔ"],
  ["か행", "かきくけこがぎぐげご"],
  ["さ행", "さしすせそざじずぜぞ"],
  ["た행", "たちつてとだぢづでどっ"],
  ["な행", "なにぬねの"],
  ["は행", "はひふへほばびぶべぼぱぴぷぺぽ"],
  ["ま행", "まみむめも"],
  ["や행", "やゆよゃゅょ"],
  ["ら행", "らりるれろ"],
  ["わ행", "わゐゑをん"],
];
const KANA_ROW_ORDER = [...KANA_ROWS.map(([name]) => name), "기타"];

function kanaRowOf(card: VocabCard) {
  const first = rubyToKana(card.expression_ruby).replace(/^[〜～~\s(（]+/, "").charAt(0);
  // Katakana -> hiragana so both share one row.
  const hira = first >= "ァ" && first <= "ヶ" ? String.fromCharCode(first.charCodeAt(0) - 0x60) : first;

  return KANA_ROWS.find(([, chars]) => chars.includes(hira))?.[0] ?? "기타";
}

export function SentencePanel() {
  const filteredCards = useAtomValue(filteredCardsAtom);
  const items = useMemo<StudyItem[]>(
    () =>
      filteredCards
        .filter((card) => card.example_jp)
        .map((card) => ({
          id: card.id,
          head: card.expression_ruby,
          meaning: card.meaning_ko || card.meaning_en,
          examples: [{ jp: card.example_jp, ko: card.example_ko }],
          tip: card.example_tip,
          section: card.part_of_speech || "기타",
          group: kanaRowOf(card),
        })),
    [filteredCards],
  );

  return (
    <StudyList
      items={items}
      sectionOrder={PART_ORDER}
      groupOrder={KANA_ROW_ORDER}
      sectionLabel="품사"
      headLabel="단어"
      emptyMessage={filteredCards.length === 0 ? "검색 결과가 없습니다." : "이 급수의 예문이 아직 준비되지 않았습니다."}
    />
  );
}

"use client";

import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { GRAMMAR_CATEGORIES, type GrammarPoint } from "@/lib/grammar-types";
import { rubyToKana, rubyToPlain } from "@/lib/ruby";
import { searchQueryAtom } from "@/store/flashcard-atoms";
import { StudyList, type StudyItem } from "@/components/study-list";

export function GrammarPanel({ grammar }: { grammar: GrammarPoint[] }) {
  const query = useAtomValue(searchQueryAtom).trim().toLocaleLowerCase();
  const items = useMemo<StudyItem[]>(
    () =>
      grammar
        .filter(
          (point) =>
            !query ||
            [rubyToPlain(point.p), rubyToKana(point.p), point.m, point.c]
              .join(" ")
              .toLocaleLowerCase()
              .includes(query),
        )
        .map((point) => ({
          id: point.id,
          head: point.p,
          meaning: point.m,
          note: `접속 · ${point.c}`,
          explanation: point.e,
          examples: point.ex.map((example) => ({ jp: example.s, ko: example.t })),
          tip: point.tip,
          section: point.category,
          group: "",
        })),
    [grammar, query],
  );

  return (
    <StudyList
      items={items}
      sectionOrder={GRAMMAR_CATEGORIES}
      sectionLabel="문법 분류"
      headLabel="문법"
      emptyMessage={grammar.length === 0 ? "이 급수의 문법이 아직 준비되지 않았습니다." : "검색 결과가 없습니다."}
    />
  );
}

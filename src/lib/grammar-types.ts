/** Shared by server loaders and client panels; must stay free of Node imports. */
export type GrammarPoint = {
  id: string;
  level: string;
  category: string;
  /** Pattern with furigana markup, e.g. 〜に関{かん}して */
  p: string;
  /** Korean meaning */
  m: string;
  /** Connection rule */
  c: string;
  /** Nuance explanation */
  e: string;
  tip: string;
  /** Examples with furigana markup and [[pattern]] */
  ex: Array<{ s: string; t: string }>;
};

export const GRAMMAR_CATEGORIES = [
  "시간·때", "조건·가정", "이유·원인", "역접·양보", "목적·수단", "추측·판단",
  "의지·희망", "의무·허가·금지", "상태·진행·변화", "정도·범위·한정", "비교·대조",
  "전달·인용", "강조·감정", "경어·대인", "조사·문형",
];

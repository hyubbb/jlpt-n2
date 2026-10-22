/**
 * Furigana markup used by the sentence data:
 *   漢字{かんじ}  -> kanji run with its reading
 *   [[...]]       -> the target word inside an example sentence
 */
export type RubyToken = {
  text: string;
  reading: string | null;
  target: boolean;
};

const TOKEN_RE = /\[\[|\]\]|([\u3400-\u9fff\uf900-\ufaff々〆ヶ]+)\{([^{}]+)\}/g;

export function parseRuby(markup: string): RubyToken[] {
  const tokens: RubyToken[] = [];
  let target = false;
  let cursor = 0;

  const pushText = (text: string) => {
    if (text) {
      tokens.push({ text, reading: null, target });
    }
  };

  for (const match of markup.matchAll(TOKEN_RE)) {
    pushText(markup.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    if (match[0] === "[[") {
      target = true;
    } else if (match[0] === "]]") {
      target = false;
    } else {
      tokens.push({ text: match[1], reading: match[2], target });
    }
  }

  pushText(markup.slice(cursor));
  return tokens;
}

/** Sentence as written (kanji kept), for display fallbacks and speech. */
export function rubyToPlain(markup: string) {
  return parseRuby(markup)
    .map((token) => token.text)
    .join("");
}

/** Sentence as kana only, for word pronunciation. */
export function rubyToKana(markup: string) {
  return parseRuby(markup)
    .map((token) => token.reading ?? token.text)
    .join("");
}

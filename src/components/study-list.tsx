"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Check, Volume2 } from "lucide-react";
import { parseRuby, rubyToKana, rubyToPlain } from "@/lib/ruby";
import { SentenceToolbar } from "@/components/sentence-toolbar";
import {
  memorizedSentenceIdsAtom,
  sentenceSettingsAtom,
  toggleMemorizedSentenceAtom,
  type SentenceSettings,
} from "@/store/sentence-atoms";

/** One row of the sentence study list: a vocab word or a grammar point. */
export type StudyItem = {
  id: string;
  /** Headword / pattern with furigana markup. */
  head: string;
  meaning: string;
  /** Extra line under the meaning (grammar connection rule). */
  note?: string;
  /** Short explanation shown under the examples (grammar nuance). */
  explanation?: string;
  examples: Array<{ jp: string; ko: string }>;
  tip: string;
  /** Top-level heading (part of speech, grammar category). */
  section: string;
  /** Sub-heading inside a section; "" for a flat list. */
  group: string;
};

type FieldKey = "word" | "meaning" | "sentence" | "target" | "translation";

type Section = { name: string; groups: Array<{ name: string; items: StudyItem[] }> };

function shuffleById(items: StudyItem[], seed: number) {
  const score = (id: string) => {
    let hash = seed;
    for (let index = 0; index < id.length; index += 1) {
      hash = Math.imul(hash ^ id.charCodeAt(index), 2654435761) >>> 0;
    }
    return hash;
  };

  return [...items].sort((a, b) => score(a.id) - score(b.id));
}

function orderedKeys(values: string[], order: string[]) {
  const present = new Set(values);
  return [...order.filter((key) => present.has(key)), ...[...present].filter((key) => !order.includes(key))];
}

export function StudyList({
  items,
  sectionOrder,
  groupOrder = [],
  sectionLabel,
  headLabel,
  emptyMessage,
}: {
  items: StudyItem[];
  sectionOrder: string[];
  groupOrder?: string[];
  sectionLabel: string;
  headLabel: string;
  emptyMessage: string;
}) {
  const [settings, setSettings] = useAtom(sentenceSettingsAtom);
  const memorizedIds = useAtomValue(memorizedSentenceIdsAtom);
  const toggleMemorized = useSetAtom(toggleMemorizedSentenceAtom);
  const [section, setSection] = useState("all");
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [shuffleSeed, setShuffleSeed] = useState<number | null>(null);
  const speech = useSpeech(Number(settings.rate));

  const memorized = useMemo(() => new Set(memorizedIds), [memorizedIds]);

  const sectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.section, (counts.get(item.section) ?? 0) + 1);
    }
    return counts;
  }, [items]);
  const sectionNames = useMemo(() => orderedKeys([...sectionCounts.keys()], sectionOrder), [sectionCounts, sectionOrder]);

  const visibleItems = useMemo(() => {
    const filtered = items.filter(
      (item) =>
        (section === "all" || item.section === section) &&
        !(settings.hideMemorized && memorized.has(item.id)),
    );
    return shuffleSeed === null ? filtered : shuffleById(filtered, shuffleSeed);
  }, [items, section, settings.hideMemorized, memorized, shuffleSeed]);

  const sections = useMemo<Section[]>(() => {
    if (shuffleSeed !== null) {
      return [{ name: "섞은 순서", groups: [{ name: "", items: visibleItems }] }];
    }

    return (section === "all" ? sectionNames : [section])
      .map((name) => {
        const groups = new Map<string, StudyItem[]>();
        for (const item of visibleItems) {
          if (item.section !== name) continue;
          groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
        }
        return {
          name,
          groups: orderedKeys([...groups.keys()], groupOrder).map((group) => ({ name: group, items: groups.get(group)! })),
        };
      })
      .filter((entry) => entry.groups.length > 0);
  }, [visibleItems, section, sectionNames, groupOrder, shuffleSeed]);

  function updateSettings(patch: Partial<SentenceSettings>) {
    setSettings((previous) => ({ ...previous, ...patch }));
    setRevealed(new Set());
  }

  const toggleReveal = useCallback((key: string) => {
    setRevealed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const memorizedInSet = items.filter((item) => memorized.has(item.id)).length;

  if (items.length === 0) {
    return (
      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
        {emptyMessage}
      </section>
    );
  }

  return (
    <section className="sentence-study mt-6" data-furigana={settings.furigana}>
      <nav className="flex flex-wrap gap-2" aria-label={sectionLabel}>
        <PartChip label="전체" count={items.length} active={section === "all"} onClick={() => setSection("all")} />
        {sectionNames.map((name) => (
          <PartChip
            key={name}
            label={name}
            count={sectionCounts.get(name) ?? 0}
            active={section === name}
            onClick={() => setSection(name)}
          />
        ))}
      </nav>

      <SentenceToolbar
        headLabel={headLabel}
        settings={settings}
        onChange={updateSettings}
        isShuffled={shuffleSeed !== null}
        onShuffle={() => setShuffleSeed((seed) => (seed === null ? Date.now() >>> 0 : null))}
        openedCount={revealed.size}
        onCloseAll={() => setRevealed(new Set())}
        shownCount={visibleItems.length}
        memorizedCount={memorizedInSet}
        totalCount={items.length}
        notice={speech.notice}
      />

      {sections.length === 0 ? (
        <p className="mt-8 rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          표시할 항목이 없습니다.
        </p>
      ) : null}

      {sections.map((entry) => (
        <div key={entry.name} className="mt-8">
          <h2 className="font-jp text-2xl font-semibold text-zinc-950">
            {entry.name}
            <span className="ml-2 align-middle text-xs font-medium text-zinc-500">
              {entry.groups.reduce((sum, group) => sum + group.items.length, 0).toLocaleString()}개
            </span>
          </h2>
          {entry.groups.map((group) => (
            <div key={group.name || "flat"}>
              {group.name ? (
                <h3 className="mb-2 mt-5 flex items-center gap-3 text-sm font-bold text-emerald-700 after:h-px after:flex-1 after:bg-zinc-200">
                  {group.name}
                </h3>
              ) : null}
              <ul className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                {group.items.map((item) => (
                  <StudyRow
                    key={item.id}
                    item={item}
                    headLabel={headLabel}
                    settings={settings}
                    revealed={revealed}
                    onReveal={toggleReveal}
                    isMemorized={memorized.has(item.id)}
                    onToggleMemorized={() => toggleMemorized(item.id)}
                    speakingKey={speech.speakingKey}
                    onSpeak={speech.speak}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function StudyRow({
  item,
  headLabel,
  settings,
  revealed,
  onReveal,
  isMemorized,
  onToggleMemorized,
  speakingKey,
  onSpeak,
}: {
  item: StudyItem;
  headLabel: string;
  settings: SentenceSettings;
  revealed: Set<string>;
  onReveal: (key: string) => void;
  isMemorized: boolean;
  onToggleMemorized: () => void;
  speakingKey: string | null;
  onSpeak: (key: string, text: string) => void;
}) {
  const key = (field: FieldKey, index = 0) => `${item.id}:${field}:${index}`;
  const isHidden = (field: FieldKey, hidden: boolean, index = 0) => hidden && !revealed.has(key(field, index));
  // Tips and explanations usually contain the answer, so keep them out of sight while any answer is blanked.
  const spoilsAnswer =
    isHidden("word", settings.word === "hide") ||
    item.examples.some(
      (_example, index) =>
        isHidden("sentence", settings.sentence === "hide", index) ||
        isHidden("target", settings.sentence === "cloze", index),
    );
  const headSpeechKey = `${item.id}:say-head`;

  return (
    <li
      className={`sentence-row grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] ${
        isMemorized ? "bg-emerald-50/60" : ""
      }`}
    >
      <div className="flex min-w-0 flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <Blank
            hidden={settings.word === "hide"}
            revealed={revealed.has(key("word"))}
            onToggle={() => onReveal(key("word"))}
            className="font-jp text-2xl font-semibold leading-[1.9] text-zinc-950"
            label={headLabel}
          >
            <Ruby markup={item.head} />
          </Blank>
          <SpeakButton
            active={speakingKey === headSpeechKey}
            label={`${headLabel} 발음 듣기`}
            onClick={() => onSpeak(headSpeechKey, rubyToKana(item.head).replace(/[〜～~()（）]/g, ""))}
          />
        </div>
        <Blank
          hidden={settings.meaning === "hide"}
          revealed={revealed.has(key("meaning"))}
          onToggle={() => onReveal(key("meaning"))}
          className="text-sm text-zinc-800"
          label="뜻"
        >
          {item.meaning}
        </Blank>
        {item.note && !spoilsAnswer ? <p className="text-xs leading-5 text-zinc-500">{item.note}</p> : null}
      </div>

      <div className="flex min-w-0 flex-col items-start gap-3">
        {item.examples.map((example, index) => {
          const sayKey = `${item.id}:say-${index}`;
          return (
            <div key={index} className="flex min-w-0 flex-col items-start gap-1">
              <div className="flex items-center gap-2">
                <Blank
                  hidden={settings.sentence === "hide"}
                  revealed={revealed.has(key("sentence", index))}
                  onToggle={() => onReveal(key("sentence", index))}
                  className="font-jp text-lg leading-[2.1] text-zinc-950"
                  label="문장"
                >
                  <Ruby
                    markup={example.jp}
                    clozeHidden={settings.sentence === "cloze" && isHidden("target", true, index)}
                    clozeRevealed={settings.sentence === "cloze" && revealed.has(key("target", index))}
                    onTargetClick={settings.sentence === "cloze" ? () => onReveal(key("target", index)) : undefined}
                  />
                </Blank>
                <SpeakButton
                  active={speakingKey === sayKey}
                  label="문장 발음 듣기"
                  onClick={() => onSpeak(sayKey, rubyToPlain(example.jp))}
                />
              </div>
              <Blank
                hidden={settings.translation === "hide"}
                revealed={revealed.has(key("translation", index))}
                onToggle={() => onReveal(key("translation", index))}
                className="text-sm text-zinc-500"
                label="해석"
              >
                {example.ko}
              </Blank>
            </div>
          );
        })}
        {!spoilsAnswer && (item.explanation || item.tip) ? (
          <div className="flex flex-col gap-1">
            {item.explanation ? <p className="text-xs leading-5 text-zinc-600">{item.explanation}</p> : null}
            {item.tip ? <p className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">{item.tip}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="flex sm:justify-end">
        <button
          type="button"
          aria-pressed={isMemorized}
          onClick={onToggleMemorized}
          className={`inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-semibold transition ${
            isMemorized
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-zinc-300 bg-white text-zinc-500 hover:border-emerald-400 hover:text-emerald-700"
          }`}
        >
          {isMemorized ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : null}
          외움
        </button>
      </div>
    </li>
  );
}

function Ruby({
  markup,
  clozeHidden = false,
  clozeRevealed = false,
  onTargetClick,
}: {
  markup: string;
  clozeHidden?: boolean;
  clozeRevealed?: boolean;
  onTargetClick?: () => void;
}) {
  const tokens = parseRuby(markup);
  const nodes: React.ReactNode[] = [];
  let targetNodes: React.ReactNode[] = [];

  const renderToken = (token: (typeof tokens)[number], index: number) =>
    token.reading ? (
      <ruby key={index}>
        {token.text}
        <rt>{token.reading}</rt>
      </ruby>
    ) : (
      <span key={index}>{token.text}</span>
    );

  const flushTarget = (index: number) => {
    if (targetNodes.length === 0) return;
    const className = `sentence-target${clozeHidden ? " is-blank" : ""}${clozeRevealed ? " is-revealed" : ""}`;
    nodes.push(
      onTargetClick ? (
        <span
          key={`t${index}`}
          role="button"
          tabIndex={0}
          aria-label={clozeHidden ? "빈칸 열기" : "빈칸 닫기"}
          className={`${className} cursor-pointer`}
          onClick={(event) => {
            event.stopPropagation();
            onTargetClick();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onTargetClick();
            }
          }}
        >
          {targetNodes}
        </span>
      ) : (
        <span key={`t${index}`} className={className}>
          {targetNodes}
        </span>
      ),
    );
    targetNodes = [];
  };

  tokens.forEach((token, index) => {
    if (token.target) {
      targetNodes.push(renderToken(token, index));
    } else {
      flushTarget(index);
      nodes.push(renderToken(token, index));
    }
  });
  flushTarget(tokens.length);

  return <>{nodes}</>;
}

function Blank({
  hidden,
  revealed,
  onToggle,
  className,
  label,
  children,
}: React.PropsWithChildren<{
  hidden: boolean;
  revealed: boolean;
  onToggle: () => void;
  className: string;
  label: string;
}>) {
  if (!hidden) {
    return <span className={`px-0.5 ${className}`}>{children}</span>;
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={revealed ? `${label} 가리기` : `${label} 보기`}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      className={`blank-field cursor-pointer px-0.5 ${revealed ? "is-revealed" : "is-blank"} ${className}`}
    >
      {children}
    </span>
  );
}

function SpeakButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-grid h-8 w-8 flex-none place-items-center rounded-full border transition ${
        active
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-zinc-300 bg-white text-emerald-700 hover:bg-emerald-50"
      }`}
    >
      <Volume2 aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}

function PartChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition ${
        active
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-300"
      }`}
    >
      {label}
      <span className={`ml-1.5 tabular-nums ${active ? "text-white/75" : "text-zinc-400"}`}>
        {count.toLocaleString()}
      </span>
    </button>
  );
}

/** Browser Web Speech API with a Japanese voice; pressing the same button again stops. */
function useSpeech(rate: number) {
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const pick = () => {
      const voices = synth.getVoices().filter((voice) => /^ja/i.test(voice.lang));
      voiceRef.current =
        voices.find((voice) => /google|kyoko|o-ren|nanami|natural/i.test(voice.name)) ??
        voices[0] ??
        null;
    };
    pick();
    synth.addEventListener("voiceschanged", pick);
    return () => {
      synth.removeEventListener("voiceschanged", pick);
      synth.cancel();
    };
  }, []);

  const speak = useCallback(
    (key: string, text: string) => {
      const synth = typeof window === "undefined" ? undefined : window.speechSynthesis;
      if (!synth) {
        setNotice("이 브라우저는 음성 읽기를 지원하지 않습니다");
        return;
      }

      synth.cancel();
      if (speakingKey === key) {
        setSpeakingKey(null);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      utterance.rate = rate;
      if (voiceRef.current) {
        utterance.voice = voiceRef.current;
      } else {
        setNotice("일본어 음성이 설치되어 있지 않아 발음이 어색할 수 있습니다");
      }
      const finish = () => setSpeakingKey((current) => (current === key ? null : current));
      utterance.onend = finish;
      utterance.onerror = finish;
      setSpeakingKey(key);
      synth.speak(utterance);
    },
    [rate, speakingKey],
  );

  return { speak, speakingKey, notice };
}

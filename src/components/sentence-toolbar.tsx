"use client";

import {
  BookOpenText,
  Eye,
  EyeOff,
  Languages,
  PenLine,
  Puzzle,
  Rabbit,
  RotateCcw,
  Shuffle,
  Turtle,
} from "lucide-react";
import type { SentenceSettings } from "@/store/sentence-atoms";

type BlankFields = Pick<SentenceSettings, "word" | "sentence" | "meaning" | "translation">;

type Preset = {
  id: string;
  label: string;
  hint: string;
  icon: typeof Eye;
  fields: BlankFields;
};

/** Each preset is a study goal; the hint replaces a separate how-to section. */
export const STUDY_PRESETS: Preset[] = [
  {
    id: "read",
    label: "훑어보기",
    hint: "전부 펼쳐 두고 문장을 소리 내어 따라 읽으세요.",
    icon: BookOpenText,
    fields: { word: "show", sentence: "show", meaning: "show", translation: "show" },
  },
  {
    id: "meaning",
    label: "뜻 맞히기",
    hint: "일본어만 보고 뜻과 해석을 떠올린 뒤 점선 칸을 눌러 확인하세요.",
    icon: Languages,
    fields: { word: "show", sentence: "show", meaning: "hide", translation: "hide" },
  },
  {
    id: "cloze",
    label: "빈칸 채우기",
    hint: "해석을 보고 문장 속 빈칸에 들어갈 활용형을 말해 보세요.",
    icon: Puzzle,
    fields: { word: "hide", sentence: "cloze", meaning: "show", translation: "show" },
  },
  {
    id: "compose",
    label: "문장 만들기",
    hint: "{head}·해석만 보고 일본어 문장을 직접 만들어 보세요.",
    icon: PenLine,
    fields: { word: "show", sentence: "hide", meaning: "show", translation: "show" },
  },
];

const CUSTOM_HINT = "가릴 항목을 직접 골랐어요. 점선 칸을 누르면 열리고 다시 누르면 닫혀요.";

function matchPreset(settings: SentenceSettings) {
  return STUDY_PRESETS.find((preset) =>
    (Object.keys(preset.fields) as Array<keyof BlankFields>).every(
      (key) => preset.fields[key] === settings[key],
    ),
  );
}

type HideChip = {
  label: string;
  active: (settings: SentenceSettings) => boolean;
  toggle: (settings: SentenceSettings) => Partial<SentenceSettings>;
};

const HIDE_CHIPS: HideChip[] = [
  {
    label: "{head}",
    active: (s) => s.word === "hide",
    toggle: (s) => ({ word: s.word === "hide" ? "show" : "hide" }),
  },
  {
    label: "뜻",
    active: (s) => s.meaning === "hide",
    toggle: (s) => ({ meaning: s.meaning === "hide" ? "show" : "hide" }),
  },
  {
    label: "문장 속 {head}",
    active: (s) => s.sentence === "cloze",
    toggle: (s) => ({ sentence: s.sentence === "cloze" ? "show" : "cloze" }),
  },
  {
    label: "문장 전체",
    active: (s) => s.sentence === "hide",
    toggle: (s) => ({ sentence: s.sentence === "hide" ? "show" : "hide" }),
  },
  {
    label: "해석",
    active: (s) => s.translation === "hide",
    toggle: (s) => ({ translation: s.translation === "hide" ? "show" : "hide" }),
  },
];

export function SentenceToolbar({
  headLabel,
  settings,
  onChange,
  isShuffled,
  onShuffle,
  openedCount,
  onCloseAll,
  shownCount,
  memorizedCount,
  totalCount,
  notice,
}: {
  headLabel: string;
  settings: SentenceSettings;
  onChange: (patch: Partial<SentenceSettings>) => void;
  isShuffled: boolean;
  onShuffle: () => void;
  openedCount: number;
  onCloseAll: () => void;
  shownCount: number;
  memorizedCount: number;
  totalCount: number;
  notice: string | null;
}) {
  const preset = matchPreset(settings);
  const withHead = (text: string) => text.replace("{head}", headLabel);
  const progress = totalCount === 0 ? 0 : Math.round((memorizedCount / totalCount) * 100);
  const isSlow = settings.rate === "0.7";

  return (
    <div className="sticky top-0 z-10 -mx-4 mt-4 border-b border-zinc-200 bg-[#f6f7f4]/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="radiogroup"
          aria-label="학습 방식"
          className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-zinc-200 sm:grid-cols-4"
        >
          {STUDY_PRESETS.map((item) => {
            const Icon = item.icon;
            const active = preset?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(item.fields)}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition ${
                  active
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <ToolButton
            label={settings.furigana === "show" ? "후리가나 숨기기" : "후리가나 보이기"}
            active={settings.furigana === "hide"}
            onClick={() => onChange({ furigana: settings.furigana === "show" ? "hide" : "show" })}
          >
            <span className="font-jp text-[13px] font-semibold leading-none">
              {settings.furigana === "show" ? "あ" : <s>あ</s>}
            </span>
          </ToolButton>
          <ToolButton
            label={isSlow ? "발음 보통 속도로" : "발음 느리게"}
            active={isSlow}
            onClick={() => onChange({ rate: isSlow ? "1" : "0.7" })}
          >
            {isSlow ? <Turtle aria-hidden="true" className="h-4 w-4" /> : <Rabbit aria-hidden="true" className="h-4 w-4" />}
          </ToolButton>
          <ToolButton label={isShuffled ? "원래 순서로" : "순서 섞기"} active={isShuffled} onClick={onShuffle}>
            <Shuffle aria-hidden="true" className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label={settings.hideMemorized ? "외운 문장 다시 보이기" : "외운 문장 숨기기"}
            active={settings.hideMemorized}
            onClick={() => onChange({ hideMemorized: !settings.hideMemorized })}
          >
            {settings.hideMemorized ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
          </ToolButton>
          <ToolButton
            label={`연 칸 모두 닫기 (${openedCount})`}
            disabled={openedCount === 0}
            onClick={onCloseAll}
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            {openedCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                {openedCount}
              </span>
            ) : null}
          </ToolButton>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-semibold text-zinc-500">가리기</span>
        {HIDE_CHIPS.map((chip) => {
          const active = chip.active(settings);
          return (
            <button
              key={chip.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(chip.toggle(settings))}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                active
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-zinc-500 ring-1 ring-zinc-200 hover:text-zinc-900"
              }`}
            >
              {withHead(chip.label)}
            </button>
          );
        })}
        <p className="min-w-0 flex-1 basis-60 text-xs text-zinc-500">{withHead(preset?.hint ?? CUSTOM_HINT)}</p>
      </div>

      <div className="mt-2.5 flex items-center gap-3" aria-live="polite">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200"
          role="progressbar"
          aria-label="외운 문장 비율"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <p className="shrink-0 text-xs tabular-nums text-zinc-500">
          외움 <b className="text-zinc-800">{memorizedCount.toLocaleString()}</b> / {totalCount.toLocaleString()} ·{" "}
          {shownCount.toLocaleString()}개 표시
        </p>
      </div>
      {notice ? <p className="mt-1 text-xs text-amber-700">{notice}</p> : null}
    </div>
  );
}

function ToolButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: React.PropsWithChildren<{
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative grid h-9 w-9 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-emerald-600 bg-emerald-50 text-emerald-700"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
      }`}
    >
      {children}
    </button>
  );
}

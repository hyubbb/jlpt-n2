#!/usr/bin/env python3
"""Build JLPT grammar data (src/data/grammar/<level>.json) with the local `claude` CLI.

Step 1 asks for the canonical grammar-point list of a level (cached in
scripts/grammar-list-cache.json). Step 2 writes each point in detail with two
example sentences (cached in scripts/grammar-cache.json). Re-running resumes.

Usage: generate_grammar.py [level ...]   (default: all levels)
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src/data/grammar"
LIST_CACHE = ROOT / "scripts/grammar-list-cache.json"
DETAIL_CACHE = ROOT / "scripts/grammar-cache.json"
LEVELS = ["n5", "n4", "n3", "n2", "n1"]
TARGET_COUNTS = {"n5": 80, "n4": 110, "n3": 150, "n2": 170, "n1": 170}
BATCH_SIZE = 12
WORKERS = int(os.environ.get("GENERATOR_WORKERS", "3"))
MODEL = "sonnet"
CATEGORIES = [
    "시간·때", "조건·가정", "이유·원인", "역접·양보", "목적·수단", "추측·판단",
    "의지·희망", "의무·허가·금지", "상태·진행·변화", "정도·범위·한정", "비교·대조",
    "전달·인용", "강조·감정", "경어·대인", "조사·문형",
]

LIST_PROMPT = """List the grammar points tested at JLPT {level}, as covered by standard prep books (新完全マスター文法, 日本語総まとめ, JLPT Sensei).
Return about {count} points that are new at this level (do not repeat lower-level basics). Merge trivial variants into one entry (e.g. 〜ようにする / 〜ようになる may stay separate, but 〜てしまう / 〜ちゃう are one).
Output ONLY a JSON array, no prose, no code fences. Each element: {"p": "pattern as usually written, with 〜 for the attachment point", "cat": one of {categories}}.
"""

DETAIL_PROMPT = """You are writing JLPT {level} grammar study material for Korean learners. For EACH grammar point, output one entry.
Output ONLY a JSON array, no prose, no code fences.

Fields:
- "id": copy the input id.
- "p": the pattern with furigana markup: every kanji run is followed by its reading in braces, e.g. 〜に関{かん}して, 〜わけにはいかない.
- "m": concise natural Korean meaning (e.g. "~할 수는 없다").
- "c": the connection rule in Korean (e.g. "동사 사전형 + わけにはいかない", "명사 + に関して").
- "e": one or two Korean sentences explaining nuance and when to use it (max 90 chars).
- "ex": exactly 2 examples, each {"s": Japanese sentence, "t": Korean translation}. In "s", wrap the grammar-pattern part (the words that realize the pattern, not the whole sentence) in [[ ]]; a split pattern such as 〜ば〜ほど may use two [[ ]] spans. Every kanji run in "s", including inside [[ ]], MUST be followed by its {hiragana reading}. Keep other vocabulary around JLPT {level}. Example: 約束{やくそく}したから、[[行{い}かないわけにはいかない]]。
- "tip": "" or one short tip written in Korean (Japanese only for quoted patterns, max 50 chars) starting with "💡 " comparing a confusable pattern or warning about a common mistake.

Grammar points (id | pattern | category):
{items}
"""

RUBY_RE = re.compile(r"\{([^{}]*)\}")
KANA_RE = re.compile(r"^[\u3040-\u30ffー・]+$")
KANJI_RUN_RE = re.compile(r"[\u3400-\u9fff々〆ヶ]+")
TARGET_RE = re.compile(r"\[\[(.+?)\]\]")
lock = Lock()


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def save(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")


def strip_spaces(text: str) -> str:
    return re.sub(r"[ \u3000]+", "", text)


def ruby_ok(text: str) -> bool:
    if text.count("{") != text.count("}"):
        return False
    if not all(KANA_RE.match(reading) for reading in RUBY_RE.findall(text)):
        return False
    bare = TARGET_RE.sub(r"\1", text)
    return all(bare[match.end() :].startswith("{") for match in KANJI_RUN_RE.finditer(bare))


def fill(template: str, **values: str) -> str:
    # str.format would choke on the furigana braces in the prompt examples.
    for key, value in values.items():
        template = template.replace("{" + key + "}", value)
    return template


def ask(prompt: str) -> list:
    if os.environ.get("GENERATOR") != "codex":
        result = subprocess.run(
            ["claude", "-p", "--model", MODEL, prompt],
            capture_output=True, text=True, timeout=900, cwd="/tmp",
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip())
        text = result.stdout.strip()
    else:
        with tempfile.NamedTemporaryFile() as output:
            result = subprocess.run(
                [
                    "codex", "exec", "--ephemeral", "--ignore-user-config", "--ignore-rules",
                    "--skip-git-repo-check", "-o", output.name, prompt,
                ],
                capture_output=True, text=True, timeout=900, cwd="/tmp",
            )
            if result.returncode != 0:
                raise RuntimeError(result.stderr.strip() or result.stdout.strip())
            output.seek(0)
            text = output.read().decode("utf-8").strip()
    start, end = text.find("["), text.rfind("]")
    if start < 0 or end < 0:
        raise ValueError("no JSON array in output")
    return json.loads(text[start : end + 1])


def grammar_list(level: str, cache: dict) -> list[dict]:
    if level not in cache:
        items = ask(
            fill(LIST_PROMPT, level=level.upper(), count=str(TARGET_COUNTS[level]), categories=json.dumps(CATEGORIES, ensure_ascii=False))
        )
        seen, points = set(), []
        for item in items:
            pattern = str(item.get("p", "")).strip()
            if not pattern or pattern in seen:
                continue
            seen.add(pattern)
            category = item.get("cat") if item.get("cat") in CATEGORIES else "조사·문형"
            points.append({"id": f"{level}-gram-{len(points) + 1:03d}", "p": pattern, "cat": category})
        with lock:
            cache[level] = points
            save(LIST_CACHE, cache)
    return cache[level]


def validate(entry: dict) -> str | None:
    for key in ("id", "p", "m", "c", "e", "tip"):
        if not isinstance(entry.get(key), str):
            return f"missing {key}"
    examples = entry.get("ex")
    if not isinstance(examples, list) or len(examples) != 2:
        return "examples"
    for example in examples:
        if not isinstance(example, dict) or not isinstance(example.get("s"), str) or not isinstance(example.get("t"), str):
            return "example shape"
        if not TARGET_RE.search(example["s"]) or not ruby_ok(example["s"]):
            return f"example markup :: {example['s']}"
    if not ruby_ok(entry["p"]):
        return f"pattern ruby :: {entry['p']}"
    return None


def detail_batch(level: str, points: list[dict], cache: dict) -> int:
    items = "\n".join(f"{point['id']} | {point['p']} | {point['cat']}" for point in points)
    try:
        entries = ask(fill(DETAIL_PROMPT, level=level.upper(), items=items))
    except Exception as error:  # noqa: BLE001 - rerun retries failed batches
        print(f"batch failed: {error}", file=sys.stderr)
        return 0
    wanted = {point["id"]: point for point in points}
    ok = 0
    with lock:
        for entry in entries:
            if not isinstance(entry, dict) or entry.get("id") not in wanted:
                continue
            problem = validate(entry)
            if problem:
                print(f"invalid {entry['id']}: {problem}", file=sys.stderr)
                continue
            cache[entry["id"]] = {
                "p": strip_spaces(entry["p"]),
                "m": entry["m"].strip(),
                "c": entry["c"].strip(),
                "e": entry["e"].strip(),
                "tip": entry["tip"].strip(),
                "ex": [{"s": strip_spaces(x["s"]), "t": x["t"].strip()} for x in entry["ex"]],
            }
            ok += 1
        save(DETAIL_CACHE, cache)
    return ok


def main() -> None:
    levels = sys.argv[1:] or LEVELS
    list_cache, detail_cache = load(LIST_CACHE), load(DETAIL_CACHE)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        lists = dict(zip(levels, pool.map(lambda level: grammar_list(level, list_cache), levels)))
    for level in levels:
        print(f"{level}: {len(lists[level])} grammar points", flush=True)

    batches = []
    for level in levels:
        missing = [point for point in lists[level] if point["id"] not in detail_cache]
        batches += [(level, missing[i : i + BATCH_SIZE]) for i in range(0, len(missing), BATCH_SIZE)]
    total = sum(len(batch) for _level, batch in batches)
    print(f"{total} points in {len(batches)} batches", flush=True)

    done = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [pool.submit(detail_batch, level, batch, detail_cache) for level, batch in batches]
        for future in as_completed(futures):
            done += future.result()
            print(f"filled {done} / {total}", flush=True)

    for level in levels:
        points = []
        for point in lists[level]:
            detail = detail_cache.get(point["id"])
            if detail:
                points.append({"id": point["id"], "level": level.upper(), "category": point["cat"], **detail})
        (OUT_DIR / f"{level}.json").write_text(json.dumps(points, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{level}: wrote {len(points)} / {len(lists[level])}")


if __name__ == "__main__":
    main()

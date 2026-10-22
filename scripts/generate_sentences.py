#!/usr/bin/env python3
"""Fill example sentences for every JLPT level CSV using the local `claude` CLI.

Writes, per CSV row:
  expression_ruby  headword with furigana markup   例: 畳{たた}む
  part_of_speech   명사 | 동사 | い형용사 | な형용사 | 부사 | 기타
  example_jp       sentence with furigana markup and [[target]]
  example_ko       Korean translation
  example_tip      optional short Korean usage tip

Results are cached in scripts/sentence-cache.json keyed by card id, so the
script can be re-run to resume or to regenerate only missing/invalid rows.

Usage: generate_sentences.py [level ...] [--limit N]   (default: all levels)
"""
import csv
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
VOCAB_DIR = ROOT / "src/data/vocab"
LEVELS = ["n5", "n4", "n3", "n2", "n1"]
CACHE_PATH = ROOT / "scripts/sentence-cache.json"
BATCH_SIZE = 30
WORKERS = int(os.environ.get("GENERATOR_WORKERS", "8"))
MODEL = "sonnet"
POS_VALUES = {"명사", "동사", "い형용사", "な형용사", "부사", "기타"}
NEW_FIELDS = ["expression_ruby", "example_tip"]

PROMPT = """You are writing study material for Korean learners of Japanese (JLPT {level}).
For EACH input word, produce one entry. Output ONLY a JSON array, no prose, no code fences.

Entry fields:
- "id": copy the input id exactly.
- "w": the headword in dictionary form with furigana markup. Put the reading of each kanji run in braces right after it: 畳{たた}む, 洗濯物{せんたくもの}, 一生懸命{いっしょうけんめい}. Pure kana words have no braces. Drop helper notes like (かさを～) or 〜 from the headword unless the 〜 is part of a suffix/prefix entry.
- "m": a concise, natural Korean meaning (1-3 short senses separated by ", "). The given Korean is machine-translated; fix it.
- "pos": exactly one of 명사, 동사, い형용사, な형용사, 부사, 기타.
- "s": ONE natural everyday Japanese sentence (about 12-35 characters; keep grammar and other vocabulary at or below JLPT {level} difficulty) that uses the word, conjugated as natural. Wrap exactly the word occurrence (including its inflected ending) in [[ ]]. Every kanji run in the sentence, including inside [[ ]], MUST have a {hiragana reading} right after it. Example: 洗濯物{せんたくもの}を[[畳{たた}んで]]ください。
- "t": a natural Korean translation of the sentence.
- "tip": either "" or one short Korean tip (max 40 chars) starting with "💡 " about a common collocation, a confusable word, or a nuance. Only include when genuinely useful.

Input words (id | expression | reading | english | korean):
{items}
"""

RUBY_RE = re.compile(r"\{([^{}]*)\}")
KANA_RE = re.compile(r"^[\u3040-\u30ffー・]+$")
KANJI_RE = re.compile(r"[\u3400-\u9fff々〆ヶ]")
TARGET_RE = re.compile(r"\[\[(.+?)\]\]")

cache_lock = Lock()


def load_cache() -> dict:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict) -> None:
    CACHE_PATH.write_text(
        json.dumps(cache, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def ruby_is_valid(text: str) -> bool:
    if text.count("{") != text.count("}"):
        return False
    if not all(KANA_RE.match(reading) for reading in RUBY_RE.findall(text)):
        return False
    # Every kanji must be followed (within its run) by a reading.
    bare = TARGET_RE.sub(r"\1", text)
    for match in re.finditer(r"[\u3400-\u9fff々〆ヶ]+", bare):
        if not bare[match.end() :].startswith("{"):
            return False
    return True


def validate(entry: dict) -> str | None:
    for key in ("id", "w", "m", "pos", "s", "t", "tip"):
        if not isinstance(entry.get(key), str):
            return f"missing {key}"
    if entry["pos"] not in POS_VALUES:
        return f"bad pos {entry['pos']}"
    if not entry["w"].strip() or not entry["m"].strip() or not entry["t"].strip():
        return "empty field"
    if len(TARGET_RE.findall(entry["s"])) != 1:
        return "target count"
    if not ruby_is_valid(entry["w"]) or not ruby_is_valid(entry["s"]):
        return "ruby"
    return None


def run_model(prompt: str) -> str:
    if os.environ.get("GENERATOR") != "codex":
        result = subprocess.run(
            ["claude", "-p", "--model", MODEL, prompt],
            capture_output=True,
            text=True,
            timeout=600,
            cwd="/tmp",
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip())
        return result.stdout.strip()

    with tempfile.NamedTemporaryFile() as output:
        result = subprocess.run(
            [
                "codex", "exec", "--ephemeral", "--ignore-user-config", "--ignore-rules",
                "--skip-git-repo-check", "-o", output.name, prompt,
            ],
            capture_output=True,
            text=True,
            timeout=900,
            cwd="/tmp",
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip())
        output.seek(0)
        return output.read().decode("utf-8").strip()


def call_model(rows: list[dict]) -> list[dict]:
    items = "\n".join(
        f"{row['id']} | {row['expression']} | {row['reading']} | {row['meaning_en']} | {row['meaning_ko']}"
        for row in rows
    )
    prompt = PROMPT.replace("{level}", rows[0]["jlpt_level"]).replace("{items}", items)
    text = run_model(prompt)
    start, end = text.find("["), text.rfind("]")
    if start < 0 or end < 0:
        raise ValueError("no JSON array in output")
    return json.loads(text[start : end + 1])


def process_batch(rows: list[dict], cache: dict) -> tuple[int, int]:
    wanted = {row["id"] for row in rows}
    try:
        entries = call_model(rows)
    except Exception as error:  # noqa: BLE001 - report and let the rerun retry
        print(f"batch failed: {error}", file=sys.stderr)
        return 0, len(rows)

    ok = 0
    with cache_lock:
        for entry in entries:
            if not isinstance(entry, dict) or entry.get("id") not in wanted:
                continue
            problem = validate(entry)
            if problem:
                print(f"invalid {entry.get('id')}: {problem} :: {entry.get('s')}", file=sys.stderr)
                continue
            cache[entry["id"]] = {key: entry[key].strip() for key in ("w", "m", "pos", "s", "t", "tip")}
            ok += 1
        save_cache(cache)
    return ok, len(rows) - ok


def strip_spaces(text: str) -> str:
    """Japanese sentences have no word spacing; drop stray ASCII/ideographic spaces."""
    return re.sub(r"[ \u3000]+", "", text)


def write_csv(path: Path, rows: list[dict], fieldnames: list[str], cache: dict) -> None:
    for row in rows:
        entry = cache.get(row["id"])
        if not entry:
            continue
        row["expression_ruby"] = strip_spaces(entry["w"])
        row["part_of_speech"] = entry["pos"]
        row["example_jp"] = strip_spaces(entry["s"])
        row["example_ko"] = entry["t"]
        row["example_tip"] = entry["tip"]
        row["meaning_ko"] = entry["m"]
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    args = sys.argv[1:]
    limit = None
    if "--limit" in args:
        index = args.index("--limit")
        limit = int(args[index + 1])
        del args[index : index + 2]
    levels = args or LEVELS

    tables = {}
    for level in levels:
        path = VOCAB_DIR / f"{level}.csv"
        with path.open("r", encoding="utf-8", newline="") as source:
            reader = csv.DictReader(source)
            rows = list(reader)
            fieldnames = list(reader.fieldnames or [])
        for field in NEW_FIELDS:
            if field not in fieldnames:
                fieldnames.append(field)
        tables[level] = (path, rows, fieldnames)

    cache = load_cache()
    batches = []
    for level, (_path, rows, _fields) in tables.items():
        missing = [row for row in rows if row["id"] not in cache]
        if limit is not None:
            missing = missing[:limit]
        batches += [missing[i : i + BATCH_SIZE] for i in range(0, len(missing), BATCH_SIZE)]
        print(f"{level}: missing {len(missing)}")
    total = sum(len(batch) for batch in batches)
    print(f"{total} rows in {len(batches)} batches", flush=True)

    done = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [pool.submit(process_batch, batch, cache) for batch in batches]
        for future in as_completed(futures):
            ok, _failed = future.result()
            done += ok
            print(f"filled {done} / {total}", flush=True)

    for level, (path, rows, fieldnames) in tables.items():
        write_csv(path, rows, fieldnames, cache)
        filled = sum(1 for row in rows if row["id"] in cache)
        print(f"{level}: {filled} / {len(rows)} filled")


if __name__ == "__main__":
    main()

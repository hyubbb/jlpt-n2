#!/usr/bin/env python3
import csv
import json
import ssl
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "src/data/jlpt-n2-vocab.csv"
CACHE_PATH = ROOT / "scripts/meaning-ko-cache.json"
TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single"
BATCH_SIZE = 40


def load_cache() -> dict[str, str]:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict[str, str]) -> None:
    CACHE_PATH.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def translate_batch(items: list[str]) -> list[str]:
    query = "\n".join(items)
    params = urlencode(
        {
            "client": "gtx",
            "sl": "en",
            "tl": "ko",
            "dt": "t",
            "q": query,
        }
    )
    request = Request(
        f"{TRANSLATE_URL}?{params}",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    context = ssl._create_unverified_context()

    with urlopen(request, timeout=20, context=context) as response:
        data = json.loads(response.read().decode("utf-8"))

    translated_text = "".join(segment[0] for segment in data[0])
    translations = [line.strip() for line in translated_text.splitlines()]

    if len(translations) != len(items):
        raise ValueError(
            f"Translation count mismatch: expected {len(items)}, got {len(translations)}"
        )

    return translations


def translate_missing(meanings: list[str], cache: dict[str, str]) -> None:
    missing = [meaning for meaning in meanings if meaning not in cache]
    total = len(missing)

    for start in range(0, total, BATCH_SIZE):
        batch = missing[start : start + BATCH_SIZE]

        try:
            translations = translate_batch(batch)
        except Exception:
            translations = []
            for item in batch:
                translations.extend(translate_batch([item]))
                time.sleep(0.1)

        for source, translation in zip(batch, translations):
            cache[source] = translation

        save_cache(cache)
        print(f"translated {min(start + len(batch), total)} / {total}")
        time.sleep(0.15)


def build_back_text(reading: str, meaning_en: str, meaning_ko: str) -> str:
    return f"읽기: {reading} | 뜻(KO): {meaning_ko} | Meaning(EN): {meaning_en}"


def main() -> None:
    with CSV_PATH.open("r", encoding="utf-8", newline="") as source:
        reader = csv.DictReader(source)
        rows = list(reader)
        fieldnames = reader.fieldnames

    if not fieldnames:
        raise ValueError("CSV has no header")

    cache = load_cache()
    meanings = sorted({row["meaning_en"].strip() for row in rows if row["meaning_en"].strip()})
    translate_missing(meanings, cache)

    for row in rows:
        meaning_en = row["meaning_en"].strip()
        meaning_ko = cache.get(meaning_en, "").strip()
        row["meaning_ko"] = meaning_ko
        row["back_text"] = build_back_text(row["reading"].strip(), meaning_en, meaning_ko)

    with CSV_PATH.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    filled = sum(1 for row in rows if row["meaning_ko"].strip())
    print(f"updated {CSV_PATH}")
    print(f"meaning_ko filled: {filled} / {len(rows)}")


if __name__ == "__main__":
    main()

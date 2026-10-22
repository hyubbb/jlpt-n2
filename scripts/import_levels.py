#!/usr/bin/env python3
"""Import JLPT vocab lists from open-anki-jlpt-decks into src/data/vocab/<level>.csv.

Existing rows (matched by source guid) keep their id and generated fields, so
re-running never resets study progress or regenerates sentences.
Korean meanings and example sentences are filled afterwards by
scripts/generate_sentences.py.
"""
import csv
import hashlib
import io
import sys
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
VOCAB_DIR = ROOT / "src/data/vocab"
SOURCE_URL = "https://raw.githubusercontent.com/jamsinclair/open-anki-jlpt-decks/main/src/{level}.csv"
LEVELS = ["n5", "n4", "n3", "n2", "n1"]
FIELDNAMES = [
    "id", "jlpt_level", "item_type", "expression", "reading", "meaning_en", "meaning_ko",
    "part_of_speech", "example_jp", "example_ko", "tags", "needs_audio", "front_text",
    "back_text", "source_name", "source_url", "source_license", "source_guid", "source_order",
    "expression_ruby", "example_tip",
]


def load_existing(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8", newline="") as source:
        return {row["source_guid"]: row for row in csv.DictReader(source)}


def convert(level: str, order: int, source: dict, existing: dict | None) -> dict:
    label = level.upper()
    url = SOURCE_URL.format(level=level)
    extra_tags = [tag for tag in source["tags"].split() if tag not in {"JLPT", f"JLPT_{label[1]}"}]
    digest = hashlib.sha1(f"{level}:{source['guid']}".encode()).hexdigest()[:10]
    row = {key: "" for key in FIELDNAMES}
    row.update(
        {
            "id": f"{level}-vocab-{order:04d}-{digest}",
            "jlpt_level": label,
            "item_type": "vocab",
            "expression": source["expression"].strip(),
            "reading": source["reading"].strip(),
            "meaning_en": source["meaning"].strip(),
            "tags": ";".join([f"JLPT_{label}", *extra_tags]),
            "needs_audio": "true" if "MediaMissing" in extra_tags else "false",
            "front_text": source["expression"].strip(),
            "source_name": "open-anki-jlpt-decks",
            "source_url": url,
            "source_license": "MIT; original JLPT list based on Tanos/Jonathan Waller CC BY",
            "source_guid": source["guid"],
            "source_order": str(order),
        }
    )
    if existing:
        # Keep id and everything generated later (meaning_ko, sentences, ruby).
        for key in FIELDNAMES:
            if existing.get(key):
                row[key] = existing[key]
    return row


def main() -> None:
    levels = sys.argv[1:] or LEVELS
    VOCAB_DIR.mkdir(parents=True, exist_ok=True)
    for level in levels:
        path = VOCAB_DIR / f"{level}.csv"
        existing = load_existing(path)
        with urlopen(SOURCE_URL.format(level=level), timeout=30) as response:
            text = response.read().decode("utf-8")
        sources, seen = [], set()
        for row in csv.DictReader(io.StringIO(text)):
            # The upstream N2 list repeats one entry (やかん) with the same guid.
            if row.get("expression", "").strip() and row["guid"] not in seen:
                seen.add(row["guid"])
                sources.append(row)
        rows = [convert(level, index + 1, source, existing.get(source["guid"])) for index, source in enumerate(sources)]
        with path.open("w", encoding="utf-8", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=FIELDNAMES)
            writer.writeheader()
            writer.writerows(rows)
        print(f"{level}: {len(rows)} rows ({len(existing)} existing kept)")


if __name__ == "__main__":
    main()

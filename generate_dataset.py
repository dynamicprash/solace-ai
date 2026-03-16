"""
generate_dataset.py
====================
Loads the raw mental_health_dataset.csv, cleans and preprocesses it,
applies label encoding, and saves a ready-to-train version back to datasets/.

Run:
    python generate_dataset.py

Output:
    datasets/processed_dataset.csv
    datasets/label_encoders.pkl   (category + severity LabelEncoders)
"""

import os
import re
import pickle
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split

# ── Paths ──────────────────────────────────────────────────────────────────
RAW_PATH       = os.path.join("datasets", "mental_health_dataset.csv")
OUTPUT_PATH    = os.path.join("datasets", "processed_dataset.csv")
ENCODERS_PATH  = os.path.join("datasets", "label_encoders.pkl")

# ── Severity normalisation map ─────────────────────────────────────────────
SEVERITY_MAP = {
    0: "low", 1: "medium", 2: "high",
    "0": "low", "1": "medium", "2": "high",
    "low": "low", "medium": "medium", "high": "high",
    "neutral": "low",
}

VALID_CATEGORIES = {"anxiety", "depression", "self_harm", "neutral"}
VALID_SEVERITIES = {"low", "medium", "high"}


def clean_text(text: str) -> str:
    """Basic text cleaning — lowercase, strip extra whitespace, remove noise."""
    if not isinstance(text, str):
        return ""
    text = text.lower().strip()
    text = re.sub(r"http\S+|www\S+", "", text)          # remove URLs
    text = re.sub(r"[^\w\s'.,!?]", " ", text)           # keep basic punctuation
    text = re.sub(r"\s+", " ", text)                     # normalise whitespace
    return text.strip()


def load_and_clean(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    print(f"  Loaded {len(df):,} rows from {path}")

    # Rename columns to standard names if needed
    col_map = {}
    for c in df.columns:
        if c.lower() in ("text", "statement", "sentence"):
            col_map[c] = "text"
        elif c.lower() in ("category_name", "status", "label"):
            col_map[c] = "category_name"
        elif c.lower() in ("severity",):
            col_map[c] = "severity"
    df = df.rename(columns=col_map)

    required = {"text", "category_name", "severity"}
    missing  = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns: {missing}. Available: {list(df.columns)}")

    # Clean text
    df["text"] = df["text"].apply(clean_text)

    # Normalise severity
    df["severity"] = df["severity"].map(
        lambda x: SEVERITY_MAP.get(x, SEVERITY_MAP.get(str(x).lower().strip(), None))
    )

    # Normalise category
    df["category_name"] = df["category_name"].str.lower().str.strip()

    # Drop bad rows
    before = len(df)
    df = df[df["text"].str.len() > 3]
    df = df[df["category_name"].isin(VALID_CATEGORIES)]
    df = df[df["severity"].isin(VALID_SEVERITIES)]
    df = df.dropna(subset=["text", "category_name", "severity"])
    df = df.drop_duplicates(subset=["text"])
    print(f"  Dropped {before - len(df):,} invalid/duplicate rows → {len(df):,} clean rows")

    return df.reset_index(drop=True)


def encode_labels(df: pd.DataFrame):
    cat_enc = LabelEncoder()
    sev_enc = LabelEncoder()

    df["category_id"] = cat_enc.fit_transform(df["category_name"])
    df["severity_id"]  = sev_enc.fit_transform(df["severity"])

    print(f"\n  Categories : {dict(enumerate(cat_enc.classes_))}")
    print(f"  Severities : {dict(enumerate(sev_enc.classes_))}")

    return df, cat_enc, sev_enc


def show_stats(df: pd.DataFrame):
    print("\n  ── Category distribution ─────────────────")
    for cat, cnt in df["category_name"].value_counts().items():
        bar = "█" * int(cnt / len(df) * 40)
        print(f"    {cat:<15} {cnt:>5}  {bar}")

    print("\n  ── Severity distribution ─────────────────")
    for sev, cnt in df["severity"].value_counts().items():
        bar = "█" * int(cnt / len(df) * 40)
        print(f"    {sev:<10} {cnt:>5}  {bar}")


def main():
    print("\n" + "=" * 55)
    print("  DATASET GENERATOR")
    print("=" * 55)

    df = load_and_clean(RAW_PATH)
    df, cat_enc, sev_enc = encode_labels(df)
    show_stats(df)

    # Save processed dataset
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"\n  ✓ Saved processed dataset → {OUTPUT_PATH}")

    # Save encoders
    with open(ENCODERS_PATH, "wb") as f:
        pickle.dump({"category": cat_enc, "severity": sev_enc}, f)
    print(f"  ✓ Saved label encoders    → {ENCODERS_PATH}")

    # Quick train/val split check
    train_df, val_df = train_test_split(df, test_size=0.15, random_state=42,
                                         stratify=df["category_id"])
    print(f"\n  Train: {len(train_df):,}  |  Val: {len(val_df):,}")
    print("\n  Dataset generation complete. Run train.py next.\n")


if __name__ == "__main__":
    main()

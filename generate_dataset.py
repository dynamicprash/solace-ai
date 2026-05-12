"""
generate_dataset.py
====================
Loads the GoEmotions dataset, maps 27 fine-grained emotions to 15
broader categories, and saves a multi-hot encoded dataset ready for
multi-label BERT + BiLSTM + Attention training.

Run:
    python generate_dataset.py

Output:
    datasets/processed_dataset.csv
    datasets/label_encoders.pkl   (15 emotion class names)
"""

import os
import re
import pickle
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

# ── Paths ──────────────────────────────────────────────────────────────────
RAW_PATH       = os.path.join("datasets", "goemotions.csv")
OUTPUT_PATH    = os.path.join("datasets", "processed_dataset.csv")
ENCODERS_PATH  = os.path.join("datasets", "label_encoders.pkl")

# ── GoEmotions original columns (27 emotions + neutral) ────────────────────
GOEMO_COLUMNS = [
    "admiration", "amusement", "anger", "annoyance", "approval",
    "caring", "confusion", "curiosity", "desire", "disappointment",
    "disapproval", "disgust", "embarrassment", "excitement", "fear",
    "gratitude", "grief", "joy", "love", "nervousness",
    "optimism", "pride", "realization", "relief", "remorse",
    "sadness", "surprise", "neutral",
]

# ── 27 → 15 Mapping ───────────────────────────────────────────────────────
# Each GoEmotions label maps to one of 15 broader categories.
EMOTION_MAP = {
    # Negative
    "nervousness"    : "Anxiety",
    "fear"           : "Anxiety",
    "sadness"        : "Sadness",
    "grief"          : "Sadness",
    "anger"          : "Anger",
    "annoyance"      : "Anger",
    "disgust"        : "Anger",
    "remorse"        : "Guilt",
    "embarrassment"  : "Guilt",
    "disappointment" : "Disappointment",
    "disapproval"    : "Disappointment",
    "confusion"      : "Confusion",
    # Positive
    "optimism"       : "Hopefulness",
    "relief"         : "Hopefulness",
    "joy"            : "Joy",
    "excitement"     : "Joy",
    "amusement"      : "Joy",
    "love"           : "Love",
    "admiration"     : "Love",
    "caring"         : "Gratitude",
    "gratitude"      : "Gratitude",
    "approval"       : "Gratitude",
    "curiosity"      : "Curiosity",
    "desire"         : "Curiosity",
    "pride"          : "Joy",
    "surprise"       : "Surprise",
    "realization"    : "Surprise",
    # Baseline
    "neutral"        : "Neutral",
}

# Ordered list of the 13 target classes
MAPPED_CLASSES = [
    "Anxiety", "Sadness", "Anger", "Guilt", "Disappointment",
    "Confusion", "Hopefulness", "Joy", "Love", "Gratitude",
    "Curiosity", "Surprise", "Neutral",
]


def clean_text(text: str) -> str:
    """Basic text cleaning — lowercase, strip extra whitespace, remove noise."""
    if not isinstance(text, str):
        return ""
    text = text.lower().strip()
    text = re.sub(r"http\S+|www\S+", "", text)          # remove URLs
    text = re.sub(r"[^\w\s'.,!?]", " ", text)           # keep basic punctuation
    text = re.sub(r"\s+", " ", text)                     # normalise whitespace
    return text.strip()


def load_and_map(path: str) -> pd.DataFrame:
    """Load GoEmotions CSV and map 27 emotions → 15 categories (multi-hot)."""
    df = pd.read_csv(path)
    print(f"  Loaded {len(df):,} rows from {path}")
    print(f"  Columns: {list(df.columns[:5])} ... ({len(df.columns)} total)")

    # Verify expected emotion columns exist
    missing = [c for c in GOEMO_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing emotion columns: {missing}")

    # Clean text
    df["text"] = df["text"].apply(clean_text)

    # Build multi-hot vectors for the 15 mapped classes
    for mapped_class in MAPPED_CLASSES:
        df[f"emo_{mapped_class}"] = 0

    for goemo_col in GOEMO_COLUMNS:
        mapped = EMOTION_MAP.get(goemo_col)
        if mapped and mapped in MAPPED_CLASSES:
            target_col = f"emo_{mapped}"
            # OR the values: if any source emotion is 1, the mapped class is 1
            df[target_col] = df[target_col] | df[goemo_col].astype(int)

    # If a row has NO emotions at all, set Neutral
    emo_cols = [f"emo_{c}" for c in MAPPED_CLASSES]
    row_sums = df[emo_cols].sum(axis=1)
    df.loc[row_sums == 0, "emo_Neutral"] = 1

    # Drop rows with empty/too-short text
    before = len(df)
    df = df[df["text"].str.len() > 3]
    df = df.drop_duplicates(subset=["text"])
    print(f"  Dropped {before - len(df):,} invalid/duplicate rows → {len(df):,} clean rows")

    # Keep only text + multi-hot columns
    keep_cols = ["text"] + emo_cols
    df = df[keep_cols].reset_index(drop=True)

    return df


def show_stats(df: pd.DataFrame):
    """Print distribution of mapped emotion categories."""
    emo_cols = [f"emo_{c}" for c in MAPPED_CLASSES]

    print("\n  ── Emotion distribution (multi-label counts) ─────────────")
    total = len(df)
    for col, name in zip(emo_cols, MAPPED_CLASSES):
        count = df[col].sum()
        pct = count / total * 100
        bar = "█" * int(pct / 2)
        print(f"    {name:<16} {count:>6}  ({pct:5.1f}%)  {bar}")

    # Labels per row stats
    row_sums = df[emo_cols].sum(axis=1)
    print(f"\n  ── Labels per row ────────────────────────────────────────")
    print(f"    Mean:   {row_sums.mean():.2f}")
    print(f"    Median: {row_sums.median():.0f}")
    print(f"    Max:    {row_sums.max():.0f}")
    print(f"    Single-label rows: {(row_sums == 1).sum():,} ({(row_sums == 1).sum()/total*100:.1f}%)")
    print(f"    Multi-label rows:  {(row_sums > 1).sum():,} ({(row_sums > 1).sum()/total*100:.1f}%)")


def main():
    print("\n" + "=" * 60)
    print("  GOEMOTIONS DATASET GENERATOR (27 → 15 mapping)")
    print("=" * 60)

    df = load_and_map(RAW_PATH)
    show_stats(df)

    # Save processed dataset
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"\n  ✓ Saved processed dataset → {OUTPUT_PATH}")

    # Save class names (label encoder equivalent)
    with open(ENCODERS_PATH, "wb") as f:
        pickle.dump({"emotion_classes": MAPPED_CLASSES}, f)
    print(f"  ✓ Saved label encoders    → {ENCODERS_PATH}")

    # Quick train/val split check
    train_df, val_df = train_test_split(df, test_size=0.15, random_state=42)
    print(f"\n  Train: {len(train_df):,}  |  Val: {len(val_df):,}")
    print("\n  Dataset generation complete. Run train.py next.\n")


if __name__ == "__main__":
    main()

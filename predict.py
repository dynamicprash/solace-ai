"""
predict.py
===========
Loads the trained BERT + LSTM model and exposes a Predictor class
used by app.py and suggestions.py.

Also runnable as a CLI test:
    python predict.py "I feel so anxious and can't sleep at all"
"""

import os
import sys
import json
import torch
import torch.nn as nn
from transformers import BertTokenizer, BertModel

# ── Paths ──────────────────────────────────────────────────────────────────
MODEL_PATH  = os.path.join("saved_models", "bert_lstm_model.pt")
CONFIG_PATH = os.path.join("saved_models", "model_config.json")
DEVICE      = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ══════════════════════════════════════════════════════════════════════════════
#  MODEL DEFINITION  (must match train.py exactly)
# ══════════════════════════════════════════════════════════════════════════════

class BertLSTMClassifier(nn.Module):
    def __init__(self, bert_name, num_categories, num_severities,
                 lstm_hidden=256, lstm_layers=2, dropout=0.3):
        super().__init__()
        self.bert       = BertModel.from_pretrained(bert_name)
        bert_hidden     = self.bert.config.hidden_size
        lstm_out        = lstm_hidden * 2

        self.lstm = nn.LSTM(
            bert_hidden, lstm_hidden, lstm_layers,
            batch_first=True, bidirectional=True,
            dropout=dropout if lstm_layers > 1 else 0,
        )
        self.dropout    = nn.Dropout(dropout)
        self.layer_norm = nn.LayerNorm(lstm_out)

        self.category_head = nn.Sequential(
            nn.Linear(lstm_out, 128), nn.ReLU(),
            nn.Dropout(dropout), nn.Linear(128, num_categories)
        )
        self.severity_head = nn.Sequential(
            nn.Linear(lstm_out, 128), nn.ReLU(),
            nn.Dropout(dropout), nn.Linear(128, num_severities)
        )

    def forward(self, input_ids, attention_mask):
        bert_out    = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        token_out   = bert_out.last_hidden_state
        lstm_out, _ = self.lstm(token_out)
        cls         = self.layer_norm(self.dropout(lstm_out[:, 0, :]))
        return self.category_head(cls), self.severity_head(cls)


# ══════════════════════════════════════════════════════════════════════════════
#  PREDICTOR CLASS
# ══════════════════════════════════════════════════════════════════════════════

class Predictor:
    """
    Loads and wraps the trained model.

    Usage:
        predictor = Predictor()
        result    = predictor.predict("I haven't slept in days and feel hopeless")
        # result = {
        #   "category"  : "depression",
        #   "severity"  : "high",
        #   "cat_conf"  : 0.89,
        #   "sev_conf"  : 0.76,
        #   "all_cat"   : {"depression": 0.89, "anxiety": 0.07, ...},
        #   "all_sev"   : {"high": 0.76, "medium": 0.18, "low": 0.06},
        # }
    """

    _instance = None  # singleton

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._loaded = False
        return cls._instance

    def _load(self):
        if self._loaded:
            return

        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Model not found at '{MODEL_PATH}'.\n"
                "Run:  python generate_dataset.py\n"
                "Then: python train.py"
            )

        checkpoint = torch.load(MODEL_PATH, map_location=DEVICE)

        self.cat_classes = checkpoint["cat_classes"]
        self.sev_classes = checkpoint["sev_classes"]
        bert_name        = checkpoint["bert_name"]

        # Load config for architecture params
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH) as f:
                cfg = json.load(f)
            lstm_hidden = cfg.get("lstm_hidden", 256)
            lstm_layers = cfg.get("lstm_layers", 2)
            dropout     = cfg.get("dropout", 0.3)
        else:
            lstm_hidden, lstm_layers, dropout = 256, 2, 0.3

        self.tokenizer = BertTokenizer.from_pretrained(bert_name)
        self.model     = BertLSTMClassifier(
            bert_name,
            num_categories = len(self.cat_classes),
            num_severities = len(self.sev_classes),
            lstm_hidden    = lstm_hidden,
            lstm_layers    = lstm_layers,
            dropout        = dropout,
        ).to(DEVICE)
        self.model.load_state_dict(checkpoint["model_state"])
        self.model.eval()
        self._loaded = True

    def predict(self, text: str, max_len: int = 128) -> dict:
        """
        Predict category and severity for a given text.
        Returns a dict with category, severity, confidence scores.
        """
        self._load()

        if not isinstance(text, str) or not text.strip():
            return {
                "category" : "neutral",
                "severity" : "low",
                "cat_conf" : 1.0,
                "sev_conf" : 1.0,
                "all_cat"  : {"neutral": 1.0},
                "all_sev"  : {"low": 1.0},
            }

        enc = self.tokenizer(
            text.strip(),
            add_special_tokens    = True,
            max_length            = max_len,
            padding               = "max_length",
            truncation            = True,
            return_attention_mask = True,
            return_tensors        = "pt",
        )

        with torch.no_grad():
            cat_logits, sev_logits = self.model(
                enc["input_ids"].to(DEVICE),
                enc["attention_mask"].to(DEVICE),
            )

        cat_probs = torch.softmax(cat_logits, dim=1)[0].cpu().tolist()
        sev_probs = torch.softmax(sev_logits, dim=1)[0].cpu().tolist()

        cat_idx = int(torch.tensor(cat_probs).argmax())
        sev_idx = int(torch.tensor(sev_probs).argmax())

        return {
            "category" : self.cat_classes[cat_idx],
            "severity" : self.sev_classes[sev_idx],
            "cat_conf" : round(cat_probs[cat_idx], 4),
            "sev_conf" : round(sev_probs[sev_idx], 4),
            "all_cat"  : {c: round(p, 4) for c, p in zip(self.cat_classes, cat_probs)},
            "all_sev"  : {s: round(p, 4) for s, p in zip(self.sev_classes, sev_probs)},
        }

    def predict_cumulative(self, messages: list[str]) -> dict:
        """
        Analyse all user messages together (concatenated) for a richer,
        session-level prediction.
        """
        combined = " ".join(m for m in messages if isinstance(m, str) and m.strip())
        # Truncate to avoid memory issues on very long conversations
        combined = combined[:1500]
        return self.predict(combined)

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def warm_up(self):
        """Pre-load the model (call at app startup)."""
        self._load()
        print(f"  ✓ Predictor ready | "
              f"Categories: {self.cat_classes} | "
              f"Severities: {self.sev_classes}")


# ── CLI usage ──────────────────────────────────────────────────────────────

def _print_result(text: str, result: dict):
    print(f"\n  Input   : \"{text[:80]}\"")
    print(f"  Category: {result['category']:<15} ({result['cat_conf']:.0%} confidence)")
    print(f"  Severity: {result['severity']:<10} ({result['sev_conf']:.0%} confidence)")
    print(f"\n  All category scores:")
    for cat, prob in sorted(result["all_cat"].items(), key=lambda x: -x[1]):
        bar = "█" * int(prob * 30)
        print(f"    {cat:<15} {prob:.3f}  {bar}")
    print(f"\n  All severity scores:")
    for sev, prob in sorted(result["all_sev"].items(), key=lambda x: -x[1]):
        bar = "█" * int(prob * 30)
        print(f"    {sev:<10} {prob:.3f}  {bar}")


if __name__ == "__main__":
    test_inputs = sys.argv[1:] if len(sys.argv) > 1 else [
        "I feel so anxious lately, I can't stop worrying",
        "I haven't slept in days, everything feels hopeless",
        "I'm having a great day today!",
        "I've been thinking about hurting myself",
    ]

    print("\n" + "=" * 55)
    print("  MENTAL HEALTH PREDICTOR — TEST")
    print("=" * 55)

    predictor = Predictor()
    predictor.warm_up()

    for text in test_inputs:
        result = predictor.predict(text)
        _print_result(text, result)
        print()

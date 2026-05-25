"""
predict.py
===========
Loads the trained BERT + BiLSTM + Attention model and exposes a
Predictor class for multi-label emotion detection (15 categories).

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

# Defaulting to CPU to avoid CUDA OOM and Windows paging file issues during inference
if os.environ.get("USE_CUDA", "0") == "1" and torch.cuda.is_available():
    os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"
    DEVICE = torch.device("cuda")
else:
    DEVICE = torch.device("cpu")

# Default threshold for multi-label classification
DEFAULT_THRESHOLD = 0.3


# ══════════════════════════════════════════════════════════════════════════════
#  ATTENTION LAYER  (must match train.py exactly)
# ══════════════════════════════════════════════════════════════════════════════

class AttentionLayer(nn.Module):
    """Additive (Bahdanau-style) attention over BiLSTM sequence outputs."""

    def __init__(self, hidden_dim):
        super().__init__()
        self.query = nn.Linear(hidden_dim, hidden_dim)
        self.key   = nn.Linear(hidden_dim, 1, bias=False)
        self.tanh  = nn.Tanh()

    def forward(self, lstm_output, attention_mask=None):
        scores = self.key(self.tanh(self.query(lstm_output)))
        scores = scores.squeeze(-1)
        if attention_mask is not None:
            scores = scores.masked_fill(attention_mask == 0, float("-inf"))
        weights = torch.softmax(scores, dim=-1)
        context = torch.bmm(weights.unsqueeze(1), lstm_output)
        return context.squeeze(1), weights


# ══════════════════════════════════════════════════════════════════════════════
#  MODEL DEFINITION  (must match train.py exactly)
# ══════════════════════════════════════════════════════════════════════════════

class BertLSTMClassifier(nn.Module):
    def __init__(self, bert_name, num_emotions,
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
        self.attention  = AttentionLayer(lstm_out)
        self.dropout    = nn.Dropout(dropout)
        self.layer_norm = nn.LayerNorm(lstm_out)

        self.emotion_head = nn.Sequential(
            nn.Linear(lstm_out, 256),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, num_emotions),
        )

    def forward(self, input_ids, attention_mask):
        bert_out    = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        token_out   = bert_out.last_hidden_state
        lstm_out, _ = self.lstm(token_out)
        attended, _ = self.attention(lstm_out, attention_mask)
        attended    = self.layer_norm(self.dropout(attended))
        return self.emotion_head(attended)


# ══════════════════════════════════════════════════════════════════════════════
#  PREDICTOR CLASS
# ══════════════════════════════════════════════════════════════════════════════

class Predictor:
    """
    Loads and wraps the trained multi-label emotion model.

    Usage:
        predictor = Predictor()
        result    = predictor.predict("I'm scared and sad about losing my job")
        # result = {
        #   "emotions"        : ["Anxiety", "Sadness"],
        #   "primary_emotion" : "Anxiety",
        #   "confidences"     : {"Anxiety": 0.87, "Sadness": 0.72, ...},
        #   "emo_conf"        : 0.87,
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

        checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)

        self.emo_classes = checkpoint.get("emo_classes", checkpoint.get("cat_classes"))
        bert_name        = checkpoint.get("bert_name", "bert-base-uncased")

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
            num_emotions = len(self.emo_classes),
            lstm_hidden  = lstm_hidden,
            lstm_layers  = lstm_layers,
            dropout      = dropout,
        ).to(DEVICE)
        self.model.load_state_dict(checkpoint["model_state"])
        self.model.eval()
        self._loaded = True

    def predict(self, text: str, max_len: int = 160,
                threshold: float = DEFAULT_THRESHOLD) -> dict:
        """
        Predict emotions for a given text (multi-label).
        Returns dict with detected emotions, confidences, and primary emotion.
        """
        self._load()

        if not isinstance(text, str) or not text.strip():
            confidences = {c: 0.0 for c in self.emo_classes}
            confidences["Neutral"] = 1.0
            return {
                "emotions"        : ["Neutral"],
                "primary_emotion" : "Neutral",
                "confidences"     : confidences,
                "emo_conf"        : 1.0,
            }

        # If the input doesn't contain any alphabetic characters (meaning it's only punctuation/dots/numbers/etc.), default to Neutral
        if not any(c.isalpha() for c in text):
            confidences = {c: 0.0 for c in self.emo_classes}
            confidences["Neutral"] = 1.0
            return {
                "emotions"        : ["Neutral"],
                "primary_emotion" : "Neutral",
                "confidences"     : confidences,
                "emo_conf"        : 1.0,
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
            logits = self.model(
                enc["input_ids"].to(DEVICE),
                enc["attention_mask"].to(DEVICE),
            )

        probs = torch.sigmoid(logits)[0].cpu().tolist()

        # Build confidences dict
        confidences = {c: round(p, 4) for c, p in zip(self.emo_classes, probs)}

        # Multi-label: get all emotions above threshold
        detected = [c for c, p in zip(self.emo_classes, probs) if p >= threshold]

        # If nothing passes threshold, pick the highest
        if not detected:
            max_idx = probs.index(max(probs))
            detected = [self.emo_classes[max_idx]]

        # Primary emotion = highest confidence
        primary = max(detected, key=lambda e: confidences[e])

        return {
            "emotions"        : detected,
            "primary_emotion" : primary,
            "confidences"     : confidences,
            "emo_conf"        : confidences[primary],
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
              f"Emotions: {self.emo_classes}")


# ── CLI usage ──────────────────────────────────────────────────────────────

def _print_result(text: str, result: dict):
    print(f"\n  Input    : \"{text[:80]}\"")
    print(f"  Emotions : {', '.join(result['emotions'])}")
    print(f"  Primary  : {result['primary_emotion']} ({result['emo_conf']:.0%})")
    print(f"\n  All emotion scores:")
    for emo, prob in sorted(result["confidences"].items(), key=lambda x: -x[1]):
        bar = "█" * int(prob * 30)
        marker = " ◄" if emo in result["emotions"] else ""
        print(f"    {emo:<16} {prob:.3f}  {bar}{marker}")


if __name__ == "__main__":
    test_inputs = sys.argv[1:] if len(sys.argv) > 1 else [
        "My chest feels tight every time I think about tomorrow.",
        "I feel empty and disconnected from everyone lately.",
        "Nothing feels enjoyable anymore.",
        "I get irritated over the smallest things these days.",
        "I'm tired of people pretending they care.",
        "Things were difficult before but I think I'm finally improving.",
        "I'm really thankful my friends stayed with me during hard times.",
        "I feel stressed about college but also excited for graduation.",
        "I'm angry at myself for failing again and honestly feel hopeless.",
        "I miss my old friends a lot even though I'm trying to move forward.",
        "I was doing okay earlier this month, but recently everything feels overwhelming.",
        "At first I thought it was just stress, but now I feel emotionally exhausted.",
        "I spend most nights staring at the ceiling thinking about everything.",
        "People say I'm fine, but I honestly don't feel okay.",
        "My mind just keeps replaying every mistake I've made.",
        "I can't stop thinking about what could go wrong.",
        "I'm tired emotionally, mentally, and physically.",
        "I wish someone genuinely understood me.",
        "I don't see the point in trying anymore.",
        "I just want all this pain to stop.",
        "I've started taking better care of myself recently and it feels good.",
        "I don't know what I'm feeling anymore.",
        "I'm okay, I guess.",
    ]

    print("\n" + "=" * 55)
    print("  EMOTION PREDICTOR — TEST (Multi-Label)")
    print("=" * 55)

    predictor = Predictor()
    predictor.warm_up()

    for text in test_inputs:
        result = predictor.predict(text)
        _print_result(text, result)
        print()

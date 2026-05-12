"""
train.py
=========
Trains a BERT + Bidirectional LSTM + Attention classifier on the
GoEmotions dataset (mapped to 15 emotion categories, multi-label).

Run:
    python generate_dataset.py   (first time)
    python train.py

Output:
    saved_models/bert_lstm_model.pt
    saved_models/model_config.json
    training_report.png
"""

import os
import json
import pickle
import time
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, f1_score

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import BertTokenizer, BertModel

# ── Config ─────────────────────────────────────────────────────────────────
PROCESSED_PATH = os.path.join("datasets", "processed_dataset.csv")
ENCODERS_PATH  = os.path.join("datasets", "label_encoders.pkl")
MODEL_DIR      = "saved_models"
MODEL_PATH     = os.path.join(MODEL_DIR, "bert_lstm_model.pt")
CONFIG_PATH    = os.path.join(MODEL_DIR, "model_config.json")
REPORT_PATH    = "training_report.png"

BERT_MODEL     = "bert-base-uncased"
MAX_LEN        = 160
BATCH_SIZE     = 16
EPOCHS         = 10
LR             = 2e-5
LSTM_HIDDEN    = 256
LSTM_LAYERS    = 2
DROPOUT        = 0.3
DEVICE         = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ══════════════════════════════════════════════════════════════════════════════
#  DATASET
# ══════════════════════════════════════════════════════════════════════════════

class EmotionDataset(Dataset):
    """Multi-label emotion dataset for GoEmotions (15 mapped classes)."""

    def __init__(self, texts, labels, tokenizer, max_len):
        self.texts     = texts
        self.labels    = labels        # numpy array (N, 15) multi-hot
        self.tokenizer = tokenizer
        self.max_len   = max_len

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        enc = self.tokenizer(
            str(self.texts[idx]),
            add_special_tokens    = True,
            max_length            = self.max_len,
            padding               = "max_length",
            truncation            = True,
            return_attention_mask  = True,
            return_tensors        = "pt",
        )
        return {
            "input_ids"      : enc["input_ids"].squeeze(0),
            "attention_mask" : enc["attention_mask"].squeeze(0),
            "labels"         : torch.tensor(self.labels[idx], dtype=torch.float32),
        }


# ══════════════════════════════════════════════════════════════════════════════
#  ATTENTION LAYER
# ══════════════════════════════════════════════════════════════════════════════

class AttentionLayer(nn.Module):
    """
    Additive (Bahdanau-style) attention over BiLSTM sequence outputs.

    Instead of just using the CLS token position, this layer learns which
    tokens are most relevant for classification and computes a weighted sum.
    """

    def __init__(self, hidden_dim):
        super().__init__()
        self.query = nn.Linear(hidden_dim, hidden_dim)
        self.key   = nn.Linear(hidden_dim, 1, bias=False)
        self.tanh  = nn.Tanh()

    def forward(self, lstm_output, attention_mask=None):
        # lstm_output: (B, seq_len, hidden_dim)
        scores = self.key(self.tanh(self.query(lstm_output)))  # (B, seq, 1)
        scores = scores.squeeze(-1)                             # (B, seq)

        if attention_mask is not None:
            scores = scores.masked_fill(attention_mask == 0, float("-inf"))

        weights = torch.softmax(scores, dim=-1)                 # (B, seq)
        context = torch.bmm(weights.unsqueeze(1), lstm_output)  # (B, 1, hidden)
        return context.squeeze(1), weights                      # (B, hidden)


# ══════════════════════════════════════════════════════════════════════════════
#  MODEL
# ══════════════════════════════════════════════════════════════════════════════

class BertLSTMClassifier(nn.Module):
    """
    Architecture:
        BERT (bert-base-uncased)
          └─ token hidden states (B, seq, 768)
               └─ Bidirectional LSTM (B, seq, 512)
                    └─ Attention Layer (B, 512)
                         └─ Emotion head → num_emotions (multi-label)
    """

    def __init__(self, bert_name, num_emotions,
                 lstm_hidden=LSTM_HIDDEN, lstm_layers=LSTM_LAYERS, dropout=DROPOUT):
        super().__init__()
        self.bert        = BertModel.from_pretrained(bert_name)
        bert_hidden      = self.bert.config.hidden_size          # 768
        lstm_out         = lstm_hidden * 2                       # bidirectional

        self.lstm = nn.LSTM(
            bert_hidden, lstm_hidden, lstm_layers,
            batch_first   = True,
            bidirectional = True,
            dropout       = dropout if lstm_layers > 1 else 0,
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
        bert_out        = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        token_out       = bert_out.last_hidden_state          # (B, seq, 768)
        lstm_out, _     = self.lstm(token_out)                # (B, seq, 512)
        attended, _     = self.attention(lstm_out, attention_mask)  # (B, 512)
        attended        = self.layer_norm(self.dropout(attended))
        return self.emotion_head(attended)                    # (B, num_emotions)


# ══════════════════════════════════════════════════════════════════════════════
#  TRAINING LOOP
# ══════════════════════════════════════════════════════════════════════════════

def train_epoch(model, loader, optimizer, scheduler, criterion):
    model.train()
    total_loss = 0
    all_preds, all_labels = [], []

    for batch in loader:
        ids    = batch["input_ids"].to(DEVICE)
        mask   = batch["attention_mask"].to(DEVICE)
        labels = batch["labels"].to(DEVICE)

        optimizer.zero_grad()
        logits = model(ids, mask)
        loss   = criterion(logits, labels)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()

        total_loss += loss.item()
        preds = (torch.sigmoid(logits) > 0.3).float()
        all_preds.append(preds.cpu().numpy())
        all_labels.append(labels.cpu().numpy())

    all_preds  = np.vstack(all_preds)
    all_labels = np.vstack(all_labels)
    f1_micro   = f1_score(all_labels, all_preds, average="micro", zero_division=0)
    f1_macro   = f1_score(all_labels, all_preds, average="macro", zero_division=0)

    return total_loss / len(loader), f1_micro, f1_macro


def eval_epoch(model, loader, criterion):
    model.eval()
    total_loss = 0
    all_preds, all_labels = [], []

    with torch.no_grad():
        for batch in loader:
            ids    = batch["input_ids"].to(DEVICE)
            mask   = batch["attention_mask"].to(DEVICE)
            labels = batch["labels"].to(DEVICE)

            logits = model(ids, mask)
            loss   = criterion(logits, labels)
            total_loss += loss.item()

            preds = (torch.sigmoid(logits) > 0.3).float()
            all_preds.append(preds.cpu().numpy())
            all_labels.append(labels.cpu().numpy())

    all_preds  = np.vstack(all_preds)
    all_labels = np.vstack(all_labels)
    f1_micro   = f1_score(all_labels, all_preds, average="micro", zero_division=0)
    f1_macro   = f1_score(all_labels, all_preds, average="macro", zero_division=0)

    return total_loss / len(loader), f1_micro, f1_macro, all_labels, all_preds


# ══════════════════════════════════════════════════════════════════════════════
#  TRAINING REPORT CHART
# ══════════════════════════════════════════════════════════════════════════════

def save_training_report(history: dict, emo_classes: list,
                          all_labels: np.ndarray, all_preds: np.ndarray):
    fig = plt.figure(figsize=(18, 10))
    fig.patch.set_facecolor("#1a1a2e")

    colors = {
        "train_loss" : "#e94560",
        "val_loss"   : "#ff6b6b",
        "f1_train"   : "#0f9b8e",
        "f1_val"     : "#4ecdc4",
    }

    epochs = range(1, len(history["train_loss"]) + 1)

    # ── Loss ──────────────────────────────────────────────────────────────
    ax1 = fig.add_subplot(2, 3, 1)
    ax1.plot(epochs, history["train_loss"], color=colors["train_loss"], lw=2, label="Train")
    ax1.plot(epochs, history["val_loss"],   color=colors["val_loss"],   lw=2, label="Val", ls="--")
    ax1.set_title("Loss", color="white", fontsize=12, fontweight="bold")
    ax1.set_xlabel("Epoch", color="#aaa"); ax1.set_ylabel("Loss", color="#aaa")
    ax1.legend(); ax1.set_facecolor("#16213e")
    ax1.tick_params(colors="#aaa"); ax1.spines[:].set_color("#333")

    # ── F1 Micro ──────────────────────────────────────────────────────────
    ax2 = fig.add_subplot(2, 3, 2)
    ax2.plot(epochs, history["f1_micro_train"], color=colors["f1_train"], lw=2, label="Train")
    ax2.plot(epochs, history["f1_micro_val"],   color=colors["f1_val"],   lw=2, label="Val", ls="--")
    ax2.set_title("F1 Score (Micro)", color="white", fontsize=12, fontweight="bold")
    ax2.set_xlabel("Epoch", color="#aaa"); ax2.set_ylabel("F1", color="#aaa")
    ax2.set_ylim(0, 1); ax2.legend(); ax2.set_facecolor("#16213e")
    ax2.tick_params(colors="#aaa"); ax2.spines[:].set_color("#333")

    # ── F1 Macro ──────────────────────────────────────────────────────────
    ax3 = fig.add_subplot(2, 3, 3)
    ax3.plot(epochs, history["f1_macro_train"], color="#f7b731", lw=2, label="Train")
    ax3.plot(epochs, history["f1_macro_val"],   color="#fed330", lw=2, label="Val", ls="--")
    ax3.set_title("F1 Score (Macro)", color="white", fontsize=12, fontweight="bold")
    ax3.set_xlabel("Epoch", color="#aaa"); ax3.set_ylabel("F1", color="#aaa")
    ax3.set_ylim(0, 1); ax3.legend(); ax3.set_facecolor("#16213e")
    ax3.tick_params(colors="#aaa"); ax3.spines[:].set_color("#333")

    # ── Per-class F1 bar chart ────────────────────────────────────────────
    ax4 = fig.add_subplot(2, 3, (4, 5))
    per_class_f1 = []
    for i in range(len(emo_classes)):
        col_labels = all_labels[:, i]
        col_preds  = all_preds[:, i]
        f1 = f1_score(col_labels, col_preds, zero_division=0)
        per_class_f1.append(f1)

    bar_colors = ["#e94560" if f < 0.3 else "#f7b731" if f < 0.6 else "#4ecdc4"
                  for f in per_class_f1]
    bars = ax4.barh(range(len(emo_classes)), per_class_f1, color=bar_colors)
    ax4.set_yticks(range(len(emo_classes)))
    ax4.set_yticklabels(emo_classes, color="#aaa", fontsize=9)
    ax4.set_xlim(0, 1)
    ax4.set_title("Per-Class F1 (Validation)", color="white", fontsize=12, fontweight="bold")
    ax4.set_xlabel("F1 Score", color="#aaa")
    ax4.set_facecolor("#16213e")
    ax4.tick_params(colors="#aaa"); ax4.spines[:].set_color("#333")
    ax4.invert_yaxis()
    for bar, f1 in zip(bars, per_class_f1):
        ax4.text(bar.get_width() + 0.02, bar.get_y() + bar.get_height()/2,
                 f"{f1:.2f}", va="center", color="#aaa", fontsize=8)

    # ── Summary Stats ─────────────────────────────────────────────────────
    ax6 = fig.add_subplot(2, 3, 6)
    ax6.axis("off"); ax6.set_facecolor("#16213e")
    best_micro = max(history["f1_micro_val"])
    best_macro = max(history["f1_macro_val"])
    summary = (
        f"TRAINING SUMMARY\n\n"
        f"Best F1 (micro):    {best_micro:.1%}\n"
        f"Best F1 (macro):    {best_macro:.1%}\n"
        f"Total Epochs:       {len(list(epochs))}\n"
        f"Device:             {str(DEVICE).upper()}\n"
        f"BERT:               {BERT_MODEL}\n"
        f"LSTM Hidden:        {LSTM_HIDDEN} × 2\n"
        f"Attention:          Additive\n"
        f"Batch Size:         {BATCH_SIZE}\n"
        f"Learning Rate:      {LR}\n"
        f"Emotion Classes:    {len(emo_classes)}\n"
    )
    ax6.text(0.1, 0.85, summary, transform=ax6.transAxes,
             color="white", fontsize=10, va="top", fontfamily="monospace",
             bbox=dict(facecolor="#0f3460", edgecolor="#e94560", boxstyle="round,pad=0.5"))

    fig.suptitle("Solace-AI — BERT + BiLSTM + Attention Training Report (Multi-Label)",
                 color="white", fontsize=14, fontweight="bold", y=1.01)
    plt.tight_layout()
    plt.savefig(REPORT_PATH, dpi=130, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close()
    print(f"  ✓ Training report saved → {REPORT_PATH}")


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  BERT + BiLSTM + ATTENTION TRAINING (Multi-Label)")
    print(f"  Device: {DEVICE}")
    print("=" * 60)

    # ── Load data ────────────────────────────────────────────────────────
    if not os.path.exists(PROCESSED_PATH):
        raise FileNotFoundError(
            f"Processed dataset not found at {PROCESSED_PATH}.\n"
            "Run: python generate_dataset.py"
        )

    df = pd.read_csv(PROCESSED_PATH)

    with open(ENCODERS_PATH, "rb") as f:
        encoders = pickle.load(f)
    emo_classes = encoders["emotion_classes"]
    num_emotions = len(emo_classes)

    print(f"\n  Rows: {len(df):,} | Emotion classes: {num_emotions}")
    print(f"  Classes: {emo_classes}")

    texts = df["text"].tolist()
    emo_cols = [f"emo_{c}" for c in emo_classes]
    labels = df[emo_cols].values.astype(np.float32)  # (N, 15)

    # ── Split ────────────────────────────────────────────────────────────
    (tr_t, va_t,
     tr_l, va_l) = train_test_split(
        texts, labels,
        test_size=0.15, random_state=42,
    )
    print(f"  Train: {len(tr_t):,}  |  Val: {len(va_t):,}")

    # ── Tokeniser ────────────────────────────────────────────────────────
    print(f"\n  Loading tokenizer: {BERT_MODEL} ...")
    tokenizer = BertTokenizer.from_pretrained(BERT_MODEL)

    tr_ds = EmotionDataset(tr_t, tr_l, tokenizer, MAX_LEN)
    va_ds = EmotionDataset(va_t, va_l, tokenizer, MAX_LEN)
    tr_ld = DataLoader(tr_ds, batch_size=BATCH_SIZE, shuffle=True,  num_workers=0)
    va_ld = DataLoader(va_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    # ── Model ────────────────────────────────────────────────────────────
    print(f"  Loading BERT model ...")
    model = BertLSTMClassifier(BERT_MODEL, num_emotions).to(DEVICE)

    # ── Weighted Loss for Imbalance ─────────────────────────────────────
    # Calculate positive weights for multi-label imbalance (pos_weight)
    # formula: pos_weight = num_negative_samples / num_positive_samples
    num_positives = labels.sum(axis=0)
    num_negatives = len(labels) - num_positives
    pos_weights   = torch.tensor(num_negatives / (num_positives + 1e-5)).to(DEVICE)
    
    optimizer  = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01)
    criterion  = nn.BCEWithLogitsLoss(pos_weight=pos_weights)
    total_steps = len(tr_ld) * EPOCHS
    scheduler  = torch.optim.lr_scheduler.LinearLR(
        optimizer, start_factor=1.0, end_factor=0.1, total_iters=total_steps)

    # ── Training loop ────────────────────────────────────────────────────
    history = {
        "train_loss": [], "val_loss": [],
        "f1_micro_train": [], "f1_micro_val": [],
        "f1_macro_train": [], "f1_macro_val": [],
    }
    best_f1       = 0.0
    best_epoch    = 0
    best_labels   = None
    best_preds    = None

    print(f"\n  {'Epoch':<6} {'T-Loss':<9} {'V-Loss':<9} "
          f"{'F1mi-Tr':<9} {'F1mi-Va':<9} {'F1ma-Tr':<9} {'F1ma-Va':<9}")
    print("  " + "─" * 60)

    for epoch in range(1, EPOCHS + 1):
        t0 = time.time()
        tr_loss, tr_f1mi, tr_f1ma = train_epoch(model, tr_ld, optimizer, scheduler, criterion)
        va_loss, va_f1mi, va_f1ma, va_labels, va_preds = eval_epoch(model, va_ld, criterion)

        history["train_loss"].append(tr_loss)
        history["val_loss"].append(va_loss)
        history["f1_micro_train"].append(tr_f1mi)
        history["f1_micro_val"].append(va_f1mi)
        history["f1_macro_train"].append(tr_f1ma)
        history["f1_macro_val"].append(va_f1ma)

        marker = " ← best" if va_f1mi > best_f1 else ""
        if va_f1mi > best_f1:
            best_f1    = va_f1mi
            best_epoch = epoch
            best_labels = va_labels
            best_preds  = va_preds
            # Save best checkpoint
            os.makedirs(MODEL_DIR, exist_ok=True)
            torch.save({
                "model_state"  : model.state_dict(),
                "emo_classes"  : emo_classes,
                "bert_name"    : BERT_MODEL,
                "epoch"        : epoch,
                "val_f1_micro" : va_f1mi,
                "val_f1_macro" : va_f1ma,
            }, MODEL_PATH)

        elapsed = time.time() - t0
        print(f"  {epoch:<6} {tr_loss:<9.4f} {va_loss:<9.4f} "
              f"{tr_f1mi:<9.3f} {va_f1mi:<9.3f} {tr_f1ma:<9.3f} {va_f1ma:<9.3f}"
              f"  {elapsed:.0f}s{marker}")

    # ── Final report ─────────────────────────────────────────────────────
    print(f"\n  Best checkpoint: Epoch {best_epoch}, F1-micro {best_f1:.3f}")

    if best_labels is not None:
        print(f"\n  Per-class Classification Report (val set):")
        print(classification_report(
            best_labels, best_preds,
            target_names=emo_classes, zero_division=0
        ))

    # ── Save config ───────────────────────────────────────────────────────
    config = {
        "bert_name"    : BERT_MODEL,
        "max_len"      : MAX_LEN,
        "lstm_hidden"  : LSTM_HIDDEN,
        "lstm_layers"  : LSTM_LAYERS,
        "dropout"      : DROPOUT,
        "num_emotions" : num_emotions,
        "emo_classes"  : emo_classes,
        "best_epoch"   : best_epoch,
        "best_f1_micro": best_f1,
    }
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)
    print(f"\n  ✓ Model saved      → {MODEL_PATH}")
    print(f"  ✓ Config saved     → {CONFIG_PATH}")

    # ── Training report chart ─────────────────────────────────────────────
    if best_labels is not None:
        save_training_report(history, emo_classes, best_labels, best_preds)
    print("\n  Training complete. Run predict.py or app.py next.\n")


if __name__ == "__main__":
    main()

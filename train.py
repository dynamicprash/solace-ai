"""
train.py
=========
Trains a BERT + Bidirectional LSTM classifier on the processed mental health
dataset. Saves the model, tokenizer config, and a training report.

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
import matplotlib.patches as mpatches
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

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
MAX_LEN        = 128
BATCH_SIZE     = 16
EPOCHS         = 6
LR             = 2e-5
LSTM_HIDDEN    = 256
LSTM_LAYERS    = 2
DROPOUT        = 0.3
DEVICE         = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ══════════════════════════════════════════════════════════════════════════════
#  DATASET
# ══════════════════════════════════════════════════════════════════════════════

class MentalHealthDataset(Dataset):
    def __init__(self, texts, cat_labels, sev_labels, tokenizer, max_len):
        self.texts      = texts
        self.cat_labels = cat_labels
        self.sev_labels = sev_labels
        self.tokenizer  = tokenizer
        self.max_len    = max_len

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        enc = self.tokenizer(
            str(self.texts[idx]),
            add_special_tokens   = True,
            max_length           = self.max_len,
            padding              = "max_length",
            truncation           = True,
            return_attention_mask= True,
            return_tensors       = "pt",
        )
        return {
            "input_ids"      : enc["input_ids"].squeeze(0),
            "attention_mask" : enc["attention_mask"].squeeze(0),
            "category_label" : torch.tensor(self.cat_labels[idx], dtype=torch.long),
            "severity_label" : torch.tensor(self.sev_labels[idx], dtype=torch.long),
        }


# ══════════════════════════════════════════════════════════════════════════════
#  MODEL
# ══════════════════════════════════════════════════════════════════════════════

class BertLSTMClassifier(nn.Module):
    """
    Architecture:
        BERT (bert-base-uncased)
          └─ token hidden states (B, seq, 768)
               └─ Bidirectional LSTM (B, seq, 512)
                    └─ CLS token representation (B, 512)
                         ├─ Category head  → num_categories
                         └─ Severity head  → num_severities
    """
    def __init__(self, bert_name, num_categories, num_severities,
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
        self.dropout    = nn.Dropout(dropout)
        self.layer_norm = nn.LayerNorm(lstm_out)

        self.category_head = nn.Sequential(
            nn.Linear(lstm_out, 128), nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, num_categories)
        )
        self.severity_head = nn.Sequential(
            nn.Linear(lstm_out, 128), nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, num_severities)
        )

    def forward(self, input_ids, attention_mask):
        bert_out        = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        token_out       = bert_out.last_hidden_state          # (B, seq, 768)
        lstm_out, _     = self.lstm(token_out)                # (B, seq, 512)
        cls             = lstm_out[:, 0, :]                   # CLS token
        cls             = self.layer_norm(self.dropout(cls))
        return self.category_head(cls), self.severity_head(cls)


# ══════════════════════════════════════════════════════════════════════════════
#  TRAINING LOOP
# ══════════════════════════════════════════════════════════════════════════════

def train_epoch(model, loader, optimizer, scheduler, criterion):
    model.train()
    total_loss = 0
    cat_correct = sev_correct = total = 0

    for batch in loader:
        ids   = batch["input_ids"].to(DEVICE)
        mask  = batch["attention_mask"].to(DEVICE)
        c_lbl = batch["category_label"].to(DEVICE)
        s_lbl = batch["severity_label"].to(DEVICE)

        optimizer.zero_grad()
        c_logits, s_logits = model(ids, mask)
        loss = criterion(c_logits, c_lbl) + criterion(s_logits, s_lbl)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()

        total_loss  += loss.item()
        cat_correct += (c_logits.argmax(1) == c_lbl).sum().item()
        sev_correct += (s_logits.argmax(1) == s_lbl).sum().item()
        total       += len(c_lbl)

    n = len(loader)
    return total_loss / n, cat_correct / total, sev_correct / total


def eval_epoch(model, loader, criterion):
    model.eval()
    total_loss = 0
    cat_correct = sev_correct = total = 0
    all_cat_true, all_cat_pred = [], []
    all_sev_true, all_sev_pred = [], []

    with torch.no_grad():
        for batch in loader:
            ids   = batch["input_ids"].to(DEVICE)
            mask  = batch["attention_mask"].to(DEVICE)
            c_lbl = batch["category_label"].to(DEVICE)
            s_lbl = batch["severity_label"].to(DEVICE)

            c_logits, s_logits = model(ids, mask)
            loss = criterion(c_logits, c_lbl) + criterion(s_logits, s_lbl)
            total_loss  += loss.item()

            c_pred = c_logits.argmax(1)
            s_pred = s_logits.argmax(1)
            cat_correct += (c_pred == c_lbl).sum().item()
            sev_correct += (s_pred == s_lbl).sum().item()
            total       += len(c_lbl)

            all_cat_true.extend(c_lbl.cpu().numpy())
            all_cat_pred.extend(c_pred.cpu().numpy())
            all_sev_true.extend(s_lbl.cpu().numpy())
            all_sev_pred.extend(s_pred.cpu().numpy())

    n = len(loader)
    return (total_loss / n, cat_correct / total, sev_correct / total,
            all_cat_true, all_cat_pred, all_sev_true, all_sev_pred)


# ══════════════════════════════════════════════════════════════════════════════
#  TRAINING REPORT CHART
# ══════════════════════════════════════════════════════════════════════════════

def save_training_report(history: dict, cat_classes, sev_classes,
                          cat_report: str, sev_report: str):
    fig = plt.figure(figsize=(18, 12))
    fig.patch.set_facecolor("#1a1a2e")

    colors = {
        "train_loss" : "#e94560",
        "val_loss"   : "#ff6b6b",
        "cat_train"  : "#0f9b8e",
        "cat_val"    : "#4ecdc4",
        "sev_train"  : "#f7b731",
        "sev_val"    : "#fed330",
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

    # ── Category Accuracy ─────────────────────────────────────────────────
    ax2 = fig.add_subplot(2, 3, 2)
    ax2.plot(epochs, history["cat_train_acc"], color=colors["cat_train"], lw=2, label="Train")
    ax2.plot(epochs, history["cat_val_acc"],   color=colors["cat_val"],   lw=2, label="Val",  ls="--")
    ax2.set_title("Category Accuracy", color="white", fontsize=12, fontweight="bold")
    ax2.set_xlabel("Epoch", color="#aaa"); ax2.set_ylabel("Accuracy", color="#aaa")
    ax2.set_ylim(0, 1); ax2.legend(); ax2.set_facecolor("#16213e")
    ax2.tick_params(colors="#aaa"); ax2.spines[:].set_color("#333")

    # ── Severity Accuracy ─────────────────────────────────────────────────
    ax3 = fig.add_subplot(2, 3, 3)
    ax3.plot(epochs, history["sev_train_acc"], color=colors["sev_train"], lw=2, label="Train")
    ax3.plot(epochs, history["sev_val_acc"],   color=colors["sev_val"],   lw=2, label="Val",  ls="--")
    ax3.set_title("Severity Accuracy", color="white", fontsize=12, fontweight="bold")
    ax3.set_xlabel("Epoch", color="#aaa"); ax3.set_ylabel("Accuracy", color="#aaa")
    ax3.set_ylim(0, 1); ax3.legend(); ax3.set_facecolor("#16213e")
    ax3.tick_params(colors="#aaa"); ax3.spines[:].set_color("#333")

    # ── Category Confusion Matrix ─────────────────────────────────────────
    ax4 = fig.add_subplot(2, 3, 4)
    cm = confusion_matrix(history["cat_true"], history["cat_pred"])
    im = ax4.imshow(cm, cmap="YlOrRd", aspect="auto")
    ax4.set_xticks(range(len(cat_classes))); ax4.set_yticks(range(len(cat_classes)))
    ax4.set_xticklabels(cat_classes, rotation=30, ha="right", color="#aaa", fontsize=8)
    ax4.set_yticklabels(cat_classes, color="#aaa", fontsize=8)
    ax4.set_title("Category Confusion Matrix", color="white", fontsize=11, fontweight="bold")
    ax4.set_facecolor("#16213e")
    for i in range(len(cat_classes)):
        for j in range(len(cat_classes)):
            ax4.text(j, i, str(cm[i, j]), ha="center", va="center",
                     color="white", fontsize=8, fontweight="bold")

    # ── Severity Confusion Matrix ─────────────────────────────────────────
    ax5 = fig.add_subplot(2, 3, 5)
    cm2 = confusion_matrix(history["sev_true"], history["sev_pred"])
    ax5.imshow(cm2, cmap="Blues", aspect="auto")
    ax5.set_xticks(range(len(sev_classes))); ax5.set_yticks(range(len(sev_classes)))
    ax5.set_xticklabels(sev_classes, color="#aaa"); ax5.set_yticklabels(sev_classes, color="#aaa")
    ax5.set_title("Severity Confusion Matrix", color="white", fontsize=11, fontweight="bold")
    ax5.set_facecolor("#16213e")
    for i in range(len(sev_classes)):
        for j in range(len(sev_classes)):
            ax5.text(j, i, str(cm2[i, j]), ha="center", va="center",
                     color="white", fontsize=9, fontweight="bold")

    # ── Summary Stats ─────────────────────────────────────────────────────
    ax6 = fig.add_subplot(2, 3, 6)
    ax6.axis("off"); ax6.set_facecolor("#16213e")
    best_cat = max(history["cat_val_acc"])
    best_sev = max(history["sev_val_acc"])
    summary = (
        f"TRAINING SUMMARY\n\n"
        f"Best Category Acc:  {best_cat:.1%}\n"
        f"Best Severity Acc:  {best_sev:.1%}\n"
        f"Total Epochs:       {len(epochs)}\n"
        f"Device:             {str(DEVICE).upper()}\n"
        f"BERT:               {BERT_MODEL}\n"
        f"LSTM Hidden:        {LSTM_HIDDEN} × 2\n"
        f"Batch Size:         {BATCH_SIZE}\n"
        f"Learning Rate:      {LR}\n"
    )
    ax6.text(0.1, 0.85, summary, transform=ax6.transAxes,
             color="white", fontsize=10, va="top", fontfamily="monospace",
             bbox=dict(facecolor="#0f3460", edgecolor="#e94560", boxstyle="round,pad=0.5"))

    fig.suptitle("Mental Health Chatbot — BERT + LSTM Training Report",
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
    print("\n" + "=" * 55)
    print("  BERT + LSTM TRAINING")
    print(f"  Device: {DEVICE}")
    print("=" * 55)

    # ── Load data ────────────────────────────────────────────────────────
    if not os.path.exists(PROCESSED_PATH):
        raise FileNotFoundError(
            f"Processed dataset not found at {PROCESSED_PATH}.\n"
            "Run: python generate_dataset.py"
        )

    df = pd.read_csv(PROCESSED_PATH)

    with open(ENCODERS_PATH, "rb") as f:
        encoders = pickle.load(f)
    cat_enc = encoders["category"]
    sev_enc = encoders["severity"]
    num_cats = len(cat_enc.classes_)
    num_sevs = len(sev_enc.classes_)

    print(f"\n  Rows: {len(df):,} | Categories: {num_cats} | Severities: {num_sevs}")

    texts     = df["text"].tolist()
    cat_labels = df["category_id"].tolist()
    sev_labels = df["severity_id"].tolist()

    # ── Split ────────────────────────────────────────────────────────────
    (tr_t, va_t,
     tr_c, va_c,
     tr_s, va_s) = train_test_split(
        texts, cat_labels, sev_labels,
        test_size=0.15, random_state=42, stratify=cat_labels
    )
    print(f"  Train: {len(tr_t):,}  |  Val: {len(va_t):,}")

    # ── Tokeniser ────────────────────────────────────────────────────────
    print(f"\n  Loading tokenizer: {BERT_MODEL} ...")
    tokenizer = BertTokenizer.from_pretrained(BERT_MODEL)

    tr_ds = MentalHealthDataset(tr_t, tr_c, tr_s, tokenizer, MAX_LEN)
    va_ds = MentalHealthDataset(va_t, va_c, va_s, tokenizer, MAX_LEN)
    tr_ld = DataLoader(tr_ds, batch_size=BATCH_SIZE, shuffle=True,  num_workers=0)
    va_ld = DataLoader(va_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    # ── Model ────────────────────────────────────────────────────────────
    print(f"  Loading BERT model ...")
    model = BertLSTMClassifier(BERT_MODEL, num_cats, num_sevs).to(DEVICE)

    total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  Trainable parameters: {total_params:,}")

    optimizer  = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01)
    criterion  = nn.CrossEntropyLoss()
    total_steps = len(tr_ld) * EPOCHS
    scheduler  = torch.optim.lr_scheduler.LinearLR(
        optimizer, start_factor=1.0, end_factor=0.1, total_iters=total_steps)

    # ── Training loop ────────────────────────────────────────────────────
    history = {
        "train_loss": [], "val_loss": [],
        "cat_train_acc": [], "cat_val_acc": [],
        "sev_train_acc": [], "sev_val_acc": [],
        "cat_true": [], "cat_pred": [],
        "sev_true": [], "sev_pred": [],
    }
    best_val_acc  = 0.0
    best_epoch    = 0

    print(f"\n  {'Epoch':<6} {'T-Loss':<9} {'V-Loss':<9} "
          f"{'Cat-Tr':<9} {'Cat-Va':<9} {'Sev-Tr':<9} {'Sev-Va':<9}")
    print("  " + "─" * 60)

    for epoch in range(1, EPOCHS + 1):
        t0 = time.time()
        tr_loss, tr_cat, tr_sev = train_epoch(model, tr_ld, optimizer, scheduler, criterion)
        (va_loss, va_cat, va_sev,
         cat_true, cat_pred,
         sev_true, sev_pred) = eval_epoch(model, va_ld, criterion)

        history["train_loss"].append(tr_loss)
        history["val_loss"].append(va_loss)
        history["cat_train_acc"].append(tr_cat)
        history["cat_val_acc"].append(va_cat)
        history["sev_train_acc"].append(tr_sev)
        history["sev_val_acc"].append(va_sev)

        avg_val = (va_cat + va_sev) / 2
        marker  = " ← best" if avg_val > best_val_acc else ""
        if avg_val > best_val_acc:
            best_val_acc = avg_val
            best_epoch   = epoch
            # Save best checkpoint
            os.makedirs(MODEL_DIR, exist_ok=True)
            torch.save({
                "model_state"  : model.state_dict(),
                "cat_classes"  : list(cat_enc.classes_),
                "sev_classes"  : list(sev_enc.classes_),
                "bert_name"    : BERT_MODEL,
                "epoch"        : epoch,
                "val_cat_acc"  : va_cat,
                "val_sev_acc"  : va_sev,
            }, MODEL_PATH)
            history["cat_true"] = cat_true
            history["cat_pred"] = cat_pred
            history["sev_true"] = sev_true
            history["sev_pred"] = sev_pred

        elapsed = time.time() - t0
        print(f"  {epoch:<6} {tr_loss:<9.4f} {va_loss:<9.4f} "
              f"{tr_cat:<9.3f} {va_cat:<9.3f} {tr_sev:<9.3f} {va_sev:<9.3f}"
              f"  {elapsed:.0f}s{marker}")

    # ── Final report ─────────────────────────────────────────────────────
    print(f"\n  Best checkpoint: Epoch {best_epoch}, avg val acc {best_val_acc:.3f}")
    print(f"\n  Category Classification Report (val set):")
    print(classification_report(history["cat_true"], history["cat_pred"],
                                 target_names=cat_enc.classes_))
    print(f"  Severity Classification Report (val set):")
    print(classification_report(history["sev_true"], history["sev_pred"],
                                 target_names=sev_enc.classes_))

    # ── Save config ───────────────────────────────────────────────────────
    config = {
        "bert_name"     : BERT_MODEL,
        "max_len"       : MAX_LEN,
        "lstm_hidden"   : LSTM_HIDDEN,
        "lstm_layers"   : LSTM_LAYERS,
        "dropout"       : DROPOUT,
        "num_categories": num_cats,
        "num_severities": num_sevs,
        "cat_classes"   : list(cat_enc.classes_),
        "sev_classes"   : list(sev_enc.classes_),
        "best_epoch"    : best_epoch,
        "best_val_acc"  : best_val_acc,
    }
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)
    print(f"\n  ✓ Model saved      → {MODEL_PATH}")
    print(f"  ✓ Config saved     → {CONFIG_PATH}")

    # ── Training report chart ─────────────────────────────────────────────
    save_training_report(history, cat_enc.classes_, sev_enc.classes_,
                          "", "")
    print("\n  Training complete. Run predict.py or app.py next.\n")


if __name__ == "__main__":
    main()

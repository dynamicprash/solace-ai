"""
Predictor singleton, session secret, and pure chat helpers (no storage).
PostgreSQL persistence lives in db/.
"""

import hashlib
import os
from collections import Counter
from predict import Predictor

SECRET_KEY = os.environ.get("SECRET_KEY", "mh-chatbot-secret-key-change-in-prod")

predictor = Predictor()


def hash_pw(password: str) -> str:
    return hashlib.sha256((password + SECRET_KEY).encode()).hexdigest()


CRISIS_EMOTIONS = {"Sadness", "Anxiety", "Guilt", "Anger"}

def calculate_severity(confidences: dict) -> str:
    """
    Calculate severity based on max confidence among crisis-related emotions.
    Returns "high", "medium", or "low".
    """
    max_crisis_conf = 0.0
    for emo, conf in confidences.items():
        if emo in CRISIS_EMOTIONS and conf > max_crisis_conf:
            max_crisis_conf = conf

    if max_crisis_conf > 0.7:
        return "high"
    if max_crisis_conf > 0.4:
        return "medium"
    return "low"

def dominant_prediction(predictions: list) -> tuple:
    """
    Aggregate multi-label emotion predictions across a session.
    Returns (list_of_dominant_emotions, primary_emotion).
    """
    if not predictions:
        return ["Neutral"], "Neutral"

    # Count how often each emotion appears across predictions
    emotion_counts: Counter = Counter()
    for p in predictions:
        emotions = p.get("emotions", [])
        for e in emotions:
            emotion_counts[e] += 1

    if not emotion_counts:
        return ["Neutral"], "Neutral"

    # Get the top emotions (those appearing in >= 30% of predictions)
    total = len(predictions)
    dominant = [e for e, c in emotion_counts.most_common() if c / total >= 0.3]

    # Always have at least one
    if not dominant:
        dominant = [emotion_counts.most_common(1)[0][0]]

    primary = dominant[0]  # most frequent
    return dominant, primary


def gpt_history(chat_session: dict) -> list:
    return [{"role": m["role"], "content": m["content"]} for m in chat_session["history"]]


def add_user_msg(chat_session: dict, text: str):
    """Mutate in-memory dict only (used together with DB writes in routes)."""
    from datetime import datetime

    chat_session["history"].append(
        {
            "role": "user",
            "content": text,
            "ts": datetime.utcnow().isoformat(),
        }
    )
    if len([m for m in chat_session["history"] if m["role"] == "user"]) == 1:
        chat_session["title"] = text[:45] + ("..." if len(text) > 45 else "")
    chat_session["updated_at"] = datetime.utcnow().isoformat()


def add_bot_msg(chat_session: dict, text: str):
    from datetime import datetime

    chat_session["history"].append(
        {
            "role": "assistant",
            "content": text,
            "ts": datetime.utcnow().isoformat(),
        }
    )
    chat_session["question_count"] += 1
    chat_session["updated_at"] = datetime.utcnow().isoformat()


import re

HARM_PATTERNS = [
    # Suicide & Self-Harm
    r"\b(kill\s+myself|suicide|end\s+my\s+life|want\s+to\s+die|hang\s+myself|cut\s+myself|harm\s+myself|hurt\s+myself|overdose)\b",
    r"\b(going\s+to|planning\s+to|want\s+to|will)\s+(kill\s+myself|suicide|end\s+my\s+life|cut\s+myself|harm\s+myself|overdose)\b",
    
    # Homicide & Violence to Others
    r"\b(kill\s+someone|murder\s+someone|kill\s+you|murder\s+you|stab\s+someone|shoot\s+someone|hurt\s+someone|harm\s+someone)\b",
    r"\b(going\s+to|planning\s+to|want\s+to|will)\s+(kill|murder|stab|shoot|harm)\s+(someone|you|people|them|her|him)\b",
    
    # Past violent crime confessions
    r"\b(killed\s+someone|murdered\s+someone|stabbed\s+someone|shot\s+someone)\b",
]

def check_safety_violation(text: str) -> tuple[bool, str | None]:
    """
    Check if the user input contains expressions of intent/actions of self-harm or violence.
    Returns (is_violated, violation_type).
    """
    text_clean = text.lower().strip()
    for pattern in HARM_PATTERNS:
        if re.search(pattern, text_clean):
            return True, "harm"
    return False, None

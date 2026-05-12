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

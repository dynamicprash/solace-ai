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
    if not predictions:
        return "neutral", "low"
    cats = Counter(p["category"] for p in predictions)
    dom = cats.most_common(1)[0][0]
    order = {"low": 0, "medium": 1, "high": 2}
    worst = max(predictions, key=lambda p: order.get(p["severity"], 0))
    return dom, worst["severity"]


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

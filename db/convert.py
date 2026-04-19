"""Map ORM rows to the dict shape used by the chat / ML pipeline."""

from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Any

from db.models import ChatSession, User


def default_facts() -> dict[str, Any]:
    return {
        "emotions": [],
        "triggers": [],
        "duration": None,
        "impacts": [],
        "support_system": None,
    }


def user_to_template_dict(user: User) -> dict[str, Any]:
    return {
        "user_id": str(user.id),
        "username": user.username,
        "name": user.display_name,
    }


def chat_session_to_app_dict(sess: ChatSession) -> dict[str, Any]:
    msgs = sorted(sess.messages, key=lambda m: m.id)
    facts = copy.deepcopy(sess.facts) if sess.facts else default_facts()
    preds = list(sess.predictions) if sess.predictions is not None else []
    return {
        "session_id": str(sess.id),
        "user_id": str(sess.user_id),
        "title": sess.title,
        "created_at": sess.created_at.isoformat() if sess.created_at else "",
        "updated_at": sess.updated_at.isoformat() if sess.updated_at else "",
        "history": [
            {
                "role": m.role,
                "content": m.content,
                "ts": m.ts.isoformat() if m.ts else "",
            }
            for m in msgs
        ],
        "question_count": sess.question_count,
        "concluded": sess.concluded,
        "predictions": preds,
        "facts": facts,
        "final_category": sess.final_category,
        "final_severity": sess.final_severity,
    }


def message_ts_now() -> datetime:
    return datetime.now(timezone.utc)

"""Synchronous CRUD for Flask (same schema as crud_async)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from db.convert import chat_session_to_app_dict, default_facts, user_to_template_dict
from db.models import ChatMessage, ChatSession, User


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.execute(select(User).where(User.username == username)).scalar_one_or_none()


def get_user_by_id(db: Session, user_id: str) -> User | None:
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return None
    return db.get(User, uid)


def create_user(
    db: Session, *, username: str, display_name: str, password_hash: str
) -> User:
    u = User(
        username=username,
        display_name=display_name,
        password_hash=password_hash,
    )
    db.add(u)
    db.flush()
    return u


def list_session_summaries(db: Session, user_id: str) -> list[dict[str, Any]]:
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return []
    rows = db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == uid)
        .order_by(ChatSession.updated_at.desc())
    ).scalars().all()
    return [
        {
            "session_id": str(s.id),
            "title": s.title,
            "created_at": s.created_at.isoformat() if s.created_at else "",
            "updated_at": s.updated_at.isoformat() if s.updated_at else "",
            "question_count": s.question_count,
            "concluded": s.concluded,
            "final_category": s.final_category,
            "final_severity": s.final_severity,
        }
        for s in rows
    ]


def fetch_owned_session(
    db: Session, session_id: str, user_id: str
) -> ChatSession | None:
    try:
        sid = uuid.UUID(session_id)
        uid = uuid.UUID(user_id)
    except ValueError:
        return None
    return db.execute(
        select(ChatSession)
        .where(ChatSession.id == sid, ChatSession.user_id == uid)
        .options(selectinload(ChatSession.messages))
    ).scalar_one_or_none()


def count_user_messages(db: Session, session_uuid: uuid.UUID) -> int:
    return int(
        db.execute(
            select(func.count())
            .select_from(ChatMessage)
            .where(
                ChatMessage.session_id == session_uuid,
                ChatMessage.role == "user",
            )
        ).scalar()
        or 0
    )


def add_user_message(db: Session, sess: ChatSession, text: str) -> None:
    now = datetime.now(timezone.utc)
    prior = count_user_messages(db, sess.id)
    db.add(ChatMessage(session_id=sess.id, role="user", content=text, ts=now))
    sess.updated_at = now
    if prior == 0:
        sess.title = text[:45] + ("..." if len(text) > 45 else "")
    db.flush()
    db.refresh(sess, attribute_names=["messages"])


def add_bot_message(db: Session, sess: ChatSession, text: str) -> None:
    now = datetime.now(timezone.utc)
    db.add(
        ChatMessage(session_id=sess.id, role="assistant", content=text, ts=now)
    )
    sess.question_count += 1
    sess.updated_at = now
    db.flush()
    db.refresh(sess, attribute_names=["messages"])


def create_chat_session(db: Session, user_id: str) -> ChatSession:
    uid = uuid.UUID(user_id)
    now = datetime.now(timezone.utc)
    cs = ChatSession(
        user_id=uid,
        title="New Conversation",
        created_at=now,
        updated_at=now,
        question_count=0,
        concluded=False,
        facts=default_facts(),
        predictions=[],
    )
    db.add(cs)
    db.flush()
    return cs


def delete_owned_session(db: Session, session_id: str, user_id: str) -> bool:
    sess = fetch_owned_session(db, session_id, user_id)
    if not sess:
        return False
    db.delete(sess)
    return True


def template_user_from_model(user: User | None) -> dict[str, Any] | None:
    if user is None:
        return None
    return user_to_template_dict(user)

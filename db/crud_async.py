"""Async CRUD for FastAPI."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.convert import default_facts, message_ts_now, user_to_template_dict
from db.models import ChatMessage, ChatSession, User, Journal


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    r = await db.execute(select(User).where(User.username == username))
    return r.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return None
    return await db.get(User, uid)


async def create_user(
    db: AsyncSession, *, username: str, display_name: str, password_hash: str
) -> User:
    u = User(
        username=username,
        display_name=display_name,
        password_hash=password_hash,
    )
    db.add(u)
    await db.flush()
    return u


async def list_session_summaries(db: AsyncSession, user_id: str) -> list[dict[str, Any]]:
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return []
    r = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == uid)
        .order_by(ChatSession.updated_at.desc())
    )
    rows = r.scalars().all()
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


async def fetch_owned_session(
    db: AsyncSession, session_id: str, user_id: str
) -> ChatSession | None:
    try:
        sid = uuid.UUID(session_id)
        uid = uuid.UUID(user_id)
    except ValueError:
        return None
    r = await db.execute(
        select(ChatSession)
        .where(ChatSession.id == sid, ChatSession.user_id == uid)
        .options(selectinload(ChatSession.messages))
    )
    return r.scalar_one_or_none()


async def count_user_messages(db: AsyncSession, session_uuid: uuid.UUID) -> int:
    r = await db.execute(
        select(func.count())
        .select_from(ChatMessage)
        .where(
            ChatMessage.session_id == session_uuid,
            ChatMessage.role == "user",
        )
    )
    return int(r.scalar() or 0)


async def add_user_message(
    db: AsyncSession, sess: ChatSession, text: str
) -> None:
    now = message_ts_now()
    prior = await count_user_messages(db, sess.id)
    db.add(
        ChatMessage(session_id=sess.id, role="user", content=text, ts=now)
    )
    sess.updated_at = now
    if prior == 0:
        sess.title = text[:45] + ("..." if len(text) > 45 else "")
    await db.flush()
    await db.refresh(sess, attribute_names=["messages"])


async def add_bot_message(
    db: AsyncSession, sess: ChatSession, text: str
) -> None:
    now = message_ts_now()
    db.add(
        ChatMessage(
            session_id=sess.id, role="assistant", content=text, ts=now
        )
    )
    sess.question_count += 1
    sess.updated_at = now
    await db.flush()
    await db.refresh(sess, attribute_names=["messages"])


async def create_chat_session(db: AsyncSession, user_id: str) -> ChatSession:
    uid = uuid.UUID(user_id)
    now = message_ts_now()
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
    await db.flush()
    return cs


async def delete_owned_session(
    db: AsyncSession, session_id: str, user_id: str
) -> bool:
    sess = await fetch_owned_session(db, session_id, user_id)
    if not sess:
        return False
    db.delete(sess)
    return True


def template_user_from_model(user: User | None) -> dict[str, Any] | None:
    if user is None:
        return None
    return user_to_template_dict(user)


async def create_journal(
    db: AsyncSession, *, user_id: str, content: str, title: str | None = None, is_anonymous: bool = False
) -> Journal:
    uid = uuid.UUID(user_id)
    j = Journal(
        user_id=uid,
        title=title,
        content=content,
        is_public=True,
        is_anonymous=is_anonymous,
    )
    db.add(j)
    await db.flush()
    return j


async def get_public_journals(db: AsyncSession, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    r = await db.execute(
        select(Journal, User)
        .join(User, Journal.user_id == User.id)
        .where(Journal.is_public == True)
        .order_by(Journal.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = r.all()
    journals = []
    for j, u in rows:
        author_name = "Anonymous" if j.is_anonymous else u.display_name
        journals.append({
            "id": str(j.id),
            "title": j.title,
            "content": j.content,
            "created_at": j.created_at.isoformat() if j.created_at else "",
            "author_name": author_name,
            "is_anonymous": j.is_anonymous,
        })
    return journals

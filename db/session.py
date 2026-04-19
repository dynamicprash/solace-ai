"""Engine and session factories (async for FastAPI, sync for Flask / Alembic)."""

from collections.abc import AsyncGenerator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import Session, sessionmaker

from db.config import require_database_url, to_async_url, to_sync_url

_async_engine: AsyncEngine | None = None
_async_session_factory: async_sessionmaker[AsyncSession] | None = None
_sync_engine = None
_sync_session_factory: sessionmaker[Session] | None = None


def init_engines() -> None:
    global _async_engine, _async_session_factory, _sync_engine, _sync_session_factory
    if _async_engine is not None:
        return
    raw = require_database_url()
    _async_engine = create_async_engine(
        to_async_url(raw),
        pool_pre_ping=True,
    )
    _async_session_factory = async_sessionmaker(
        _async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    _sync_engine = create_engine(to_sync_url(raw), pool_pre_ping=True)
    _sync_session_factory = sessionmaker(
        bind=_sync_engine,
        expire_on_commit=False,
        autoflush=False,
    )


def get_async_engine() -> AsyncEngine:
    init_engines()
    assert _async_engine is not None
    return _async_engine


def get_async_session_factory() -> async_sessionmaker[AsyncSession]:
    init_engines()
    assert _async_session_factory is not None
    return _async_session_factory


async def dispose_async_engine() -> None:
    global _async_engine, _async_session_factory
    if _async_engine is not None:
        await _async_engine.dispose()
        _async_engine = None
        _async_session_factory = None


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    init_engines()
    assert _async_session_factory is not None
    async with _async_session_factory() as session:
        yield session


@contextmanager
def sync_session_scope():
    init_engines()
    assert _sync_session_factory is not None
    with _sync_session_factory() as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise

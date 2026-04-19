"""DATABASE_URL parsing for async (asyncpg) and sync (psycopg3) engines."""

import os


def require_database_url() -> str:
    url = (os.environ.get("DATABASE_URL") or "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Example:\n"
            "  export DATABASE_URL=postgresql://user:password@localhost:5432/mental_health_chatbot"
        )
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    return url


def to_async_url(url: str) -> str:
    if "+asyncpg" in url:
        return url
    return url.replace("postgresql://", "postgresql+asyncpg://", 1)


def to_sync_url(url: str) -> str:
    u = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if u.startswith("postgresql://") and "+psycopg" not in u:
        u = u.replace("postgresql://", "postgresql+psycopg://", 1)
    return u

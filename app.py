"""
Default application entry: FastAPI ASGI app (re-exported for `uvicorn app:app`).

Flask backend preserved in app_flask.py:
  python app_flask.py
  gunicorn app_flask:app

Run FastAPI:
  python app.py
  uvicorn app:app --host 0.0.0.0 --port 8000 --reload

Docs: http://localhost:8000/docs
"""

import os

from fastapi_app import app

if __name__ == "__main__":
    import uvicorn

    print("\n  🌿 Mental Health Chatbot (FastAPI)")
    print("  ──────────────────────────────────────────")
    print("  (Model warm-up runs once on server startup.)")

    groq_key = os.environ.get("GROQ_API_KEY", "your-groq-api-key-here")
    print(
        f"  Groq   : {'✓ configured' if groq_key != 'your-groq-api-key-here' else '✗ API key not set'}"
    )
    print(f"  Templates: {os.path.exists('templates')}")
    db_ok = bool(os.environ.get("DATABASE_URL", "").strip())
    print(f"  DATABASE_URL: {'set' if db_ok else 'MISSING (required)'}")
    print("\n  http://localhost:8000  (API docs: /docs)\n")

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

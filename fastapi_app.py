"""
FastAPI application (default server for this project).

Requires DATABASE_URL (postgresql://...).

Run:
  export DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
  alembic upgrade head
  uvicorn app:app --host 0.0.0.0 --port 8000 --reload

Flask legacy: app_flask.py
"""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from functools import partial

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.sessions import SessionMiddleware

import chat_state as cs
import db.crud_async as crud
from db.convert import chat_session_to_app_dict
from db.session import dispose_async_engine, get_async_session_factory, init_engines
from suggestions import (
    MAX_QUESTIONS,
    _client,
    extract_facts,
    update_facts,
    stream_question,
)

templates = Jinja2Templates(directory="templates")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_engines()
    try:
        cs.predictor.warm_up()
    except FileNotFoundError:
        pass
    yield
    await dispose_async_engine()


app = FastAPI(title="Mental Health Chatbot", lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=cs.SECRET_KEY)


async def get_db():
    factory = get_async_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def _current_user(request: Request, db: AsyncSession) -> dict | None:
    uid = request.session.get("user_id")
    if not uid:
        return None
    u = await crud.get_user_by_id(db, uid)
    return crud.template_user_from_model(u)


# ── Pages ────────────────────────────────────────────────────────────────────


@app.get("/")
async def index(request: Request):
    if request.session.get("user_id"):
        return RedirectResponse("/chat", status_code=302)
    return RedirectResponse("/login", status_code=302)


@app.get("/login")
async def login_get(request: Request):
    if request.session.get("user_id"):
        return RedirectResponse("/chat", status_code=302)
    return templates.TemplateResponse(
        request,
        "auth.html",
        {"mode": "login", "error": None},
    )


@app.post("/login")
async def login_post(request: Request, db: AsyncSession = Depends(get_db)):
    if request.session.get("user_id"):
        return RedirectResponse("/chat", status_code=302)

    if "application/json" in request.headers.get("content-type", ""):
        data = await request.json()
        want_json = True
    else:
        data = dict(await request.form())
        want_json = False

    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))

    user = await crud.get_user_by_username(db, username)
    if not user or user.password_hash != cs.hash_pw(password):
        if want_json:
            return JSONResponse({"error": "Invalid username or password"}, status_code=401)
        return templates.TemplateResponse(
            request,
            "auth.html",
            {"mode": "login", "error": "Invalid username or password"},
            status_code=401,
        )

    request.session["user_id"] = str(user.id)
    request.session["user_name"] = user.display_name
    if want_json:
        return JSONResponse(
            {
                "ok": True,
                "redirect": "/chat",
                "user": {
                    "id": request.session["user_id"],
                    "name": request.session["user_name"],
                },
            }
        )
    return RedirectResponse("/chat", status_code=302)


@app.post("/api/login")
async def api_login(request: Request, db: AsyncSession = Depends(get_db)):
    return await login_post(request, db)


@app.get("/register")
async def register_get(request: Request):
    if request.session.get("user_id"):
        return RedirectResponse("/chat", status_code=302)
    return templates.TemplateResponse(
        request,
        "auth.html",
        {"mode": "register", "error": None},
    )


@app.post("/register")
async def register_post(request: Request, db: AsyncSession = Depends(get_db)):
    if request.session.get("user_id"):
        return RedirectResponse("/chat", status_code=302)

    if "application/json" in request.headers.get("content-type", ""):
        data = await request.json()
        want_json = True
    else:
        data = dict(await request.form())
        want_json = False

    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))
    name = str(data.get("name", username)).strip()

    if not username or not password:
        err = "Username and password are required"
        if want_json:
            return JSONResponse({"error": err}, status_code=400)
        return templates.TemplateResponse(
            request,
            "auth.html",
            {"mode": "register", "error": err},
            status_code=400,
        )
    if len(password) < 6:
        err = "Password must be at least 6 characters"
        if want_json:
            return JSONResponse({"error": err}, status_code=400)
        return templates.TemplateResponse(
            request,
            "auth.html",
            {"mode": "register", "error": err},
            status_code=400,
        )
    if await crud.get_user_by_username(db, username):
        err = "Username already taken"
        if want_json:
            return JSONResponse({"error": err}, status_code=409)
        return templates.TemplateResponse(
            request,
            "auth.html",
            {"mode": "register", "error": err},
            status_code=409,
        )

    await crud.create_user(
        db,
        username=username,
        display_name=name,
        password_hash=cs.hash_pw(password),
    )

    user = await crud.get_user_by_username(db, username)
    if user is None:
        return JSONResponse({"error": "Registration failed"}, status_code=500)
    request.session["user_id"] = str(user.id)
    request.session["user_name"] = user.display_name

    if want_json:
        return JSONResponse(
            {
                "ok": True,
                "redirect": "/chat",
                "user": {
                    "id": request.session["user_id"],
                    "name": request.session["user_name"],
                },
            },
            status_code=201,
        )
    return RedirectResponse("/chat", status_code=302)


@app.post("/api/register")
async def api_register(request: Request, db: AsyncSession = Depends(get_db)):
    return await register_post(request, db)


@app.api_route("/logout", methods=["GET", "POST"])
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/login", status_code=302)


@app.api_route("/api/logout", methods=["GET", "POST"])
async def api_logout(request: Request):
    return await logout(request)


@app.get("/chat")
async def chat_page(request: Request, db: AsyncSession = Depends(get_db)):
    if not request.session.get("user_id"):
        return RedirectResponse("/login", status_code=302)
    user = await _current_user(request, db)
    past = await crud.list_session_summaries(db, request.session["user_id"])
    return templates.TemplateResponse(
        request,
        "chat.html",
        {"user": user, "past_sessions": past},
    )


# ── API ──────────────────────────────────────────────────────────────────────


@app.post("/api/start")
async def api_start(request: Request, db: AsyncSession = Depends(get_db)):
    if not request.session.get("user_id"):
        return RedirectResponse("/login", status_code=302)
    user_id = request.session["user_id"]
    sess = await crud.create_chat_session(db, user_id)
    await db.flush()

    opening = (
        f"Hello {request.session.get('user_name', '')}! I'm here to listen and support you. 💙\n\n"
        "This is a safe, non-judgmental space. How are you feeling today?"
    )
    await crud.add_bot_message(db, sess, opening)

    return JSONResponse(
        {
            "session_id": str(sess.id),
            "message": opening,
            "question_count": 0,
            "max_questions": MAX_QUESTIONS,
            "concluded": False,
        }
    )


@app.get("/api/user")
async def api_user(request: Request):
    if not request.session.get("user_id"):
        return JSONResponse({"ok": False}, status_code=401)

    return JSONResponse(
        {
            "ok": True,
            "user": {
                "id": request.session.get("user_id"),
                "name": request.session.get("user_name", ""),
            },
        }
    )


@app.post("/api/message")
async def api_message(request: Request):
    if not request.session.get("user_id"):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    data = await request.json()
    user_input = (data.get("message") or "").strip()
    session_id = data.get("session_id") or ""
    user_id = request.session["user_id"]

    factory = get_async_session_factory()
    _STOP = object()

    async def event_gen():
        nonlocal user_input, session_id, user_id
        dom_cat = "neutral"
        dom_sev = "low"

        try:
            async with factory() as db:
                sess = await crud.fetch_owned_session(db, session_id, user_id)
                if not sess:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
                    return
                if sess.concluded:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'This session has already concluded'})}\n\n"
                    return
                if not user_input:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Message is required'})}\n\n"
                    return

                await crud.add_user_message(db, sess, user_input)
                await db.commit()

            analysis_line = None
            stop_stream = False
            async with factory() as db:
                sess = await crud.fetch_owned_session(db, session_id, user_id)
                if not sess:
                    analysis_line = f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
                    stop_stream = True
                else:
                    chat = chat_session_to_app_dict(sess)
                    try:
                        pred = await asyncio.to_thread(
                            cs.predictor.predict_cumulative,
                            [
                                m["content"]
                                for m in chat["history"]
                                if m["role"] == "user"
                            ],
                        )
                    except Exception:
                        pred = {
                            "category": "neutral",
                            "severity": "low",
                            "cat_conf": 0.5,
                            "sev_conf": 0.5,
                        }

                    preds = list(sess.predictions or [])
                    preds.append(
                        {
                            "category": pred["category"],
                            "severity": pred["severity"],
                            "cat_conf": pred["cat_conf"],
                            "sev_conf": pred["sev_conf"],
                        }
                    )
                    sess.predictions = preds
                    dom_cat, dom_sev = cs.dominant_prediction(preds)
                    sess.final_category = dom_cat
                    sess.final_severity = dom_sev

                    analysis_event = {
                        "type": "analysis",
                        "category": dom_cat,
                        "severity": dom_sev,
                        "cat_conf": pred["cat_conf"],
                        "sev_conf": pred["sev_conf"],
                        "question_count": sess.question_count,
                        "max_questions": MAX_QUESTIONS,
                    }
                    await db.commit()
                    analysis_line = f"data: {json.dumps(analysis_event)}\n\n"

            if analysis_line:
                yield analysis_line
            if stop_stream:
                return

            gpt_client = _client()
            facts_merged = dict(chat.get("facts") or {})
            if gpt_client:
                new_facts = await asyncio.to_thread(
                    extract_facts, user_input, gpt_client
                )
                facts_merged = update_facts(facts_merged, new_facts)

            concluding_line = None
            async with factory() as db:
                sess = await crud.fetch_owned_session(db, session_id, user_id)
                if not sess:
                    return
                sess.facts = facts_merged
                is_conclusion = sess.question_count >= MAX_QUESTIONS
                if is_conclusion:
                    sess.concluded = True
                await db.commit()
                if is_conclusion:
                    concluding_line = f"data: {json.dumps({'type': 'concluding'})}\n\n"

            if concluding_line:
                yield concluding_line

            async with factory() as db:
                sess = await crud.fetch_owned_session(db, session_id, user_id)
                if not sess:
                    return
                chat = chat_session_to_app_dict(sess)

            stream_it = stream_question(
                cs.gpt_history(chat),
                dom_cat,
                dom_sev,
                chat["facts"],
                chat["question_count"] + 1,
                client=gpt_client,
            )
            full_response = ""
            while True:
                chunk = await asyncio.to_thread(partial(next, stream_it, _STOP))
                if chunk is _STOP:
                    break
                full_response += chunk
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

            done_line = None
            async with factory() as db:
                sess = await crud.fetch_owned_session(db, session_id, user_id)
                if not sess:
                    return
                await crud.add_bot_message(db, sess, full_response.strip())
                await db.commit()
                done_event = {
                    "type": "done",
                    "question_count": sess.question_count,
                    "max_questions": MAX_QUESTIONS,
                    "concluded": sess.concluded,
                    "category": dom_cat,
                    "severity": dom_sev,
                }
                done_line = f"data: {json.dumps(done_event)}\n\n"

            if done_line:
                yield done_line

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/history")
async def api_history(request: Request, db: AsyncSession = Depends(get_db)):
    if not request.session.get("user_id"):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    rows = await crud.list_session_summaries(db, request.session["user_id"])
    return JSONResponse({"sessions": rows})


@app.get("/api/dashboard/weekly")
async def api_dashboard_weekly(request: Request, db: AsyncSession = Depends(get_db)):
    if not request.session.get("user_id"):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    rows = await crud.list_session_summaries(db, request.session["user_id"])
    now = datetime.now(timezone.utc)
    week_days = [
        (now - timedelta(days=i)).date() for i in range(6, -1, -1)
    ]

    weekly = []
    for day in week_days:
        count = 0
        for session in rows:
            if not session.get("created_at"):
                continue
            try:
                created_date = datetime.fromisoformat(session["created_at"]).date()
            except ValueError:
                continue
            if created_date == day:
                count += 1
        weekly.append({"day": day.isoformat(), "count": count})

    severity_counts = {"high": 0, "medium": 0, "low": 0, "unknown": 0}
    concluded = 0
    total_sessions = len(rows)

    for session in rows:
        if session.get("concluded"):
            concluded += 1
        severity = (session.get("final_severity") or "unknown").lower()
        if severity not in severity_counts:
            severity = "unknown"
        severity_counts[severity] += 1

    return JSONResponse(
        {
            "sessions": rows,
            "summary": {
                "total_sessions": total_sessions,
                "concluded_sessions": concluded,
                "active_sessions": total_sessions - concluded,
                "severity_counts": severity_counts,
            },
            "weekly": weekly,
        }
    )


@app.get("/api/session/{session_id}")
async def api_get_session(
    request: Request, session_id: str, db: AsyncSession = Depends(get_db)
):
    if not request.session.get("user_id"):
        return RedirectResponse("/login", status_code=302)
    sess = await crud.fetch_owned_session(db, session_id, request.session["user_id"])
    if not sess:
        return JSONResponse({"error": "Not found"}, status_code=404)
    row = chat_session_to_app_dict(sess)
    return JSONResponse(
        {
            "session_id": row["session_id"],
            "title": row["title"],
            "history": row["history"],
            "question_count": row["question_count"],
            "max_questions": MAX_QUESTIONS,
            "concluded": row["concluded"],
            "final_category": row["final_category"],
            "final_severity": row["final_severity"],
            "facts": row["facts"],
        }
    )


@app.delete("/api/session/{session_id}")
async def api_delete_session(
    request: Request, session_id: str, db: AsyncSession = Depends(get_db)
):
    if not request.session.get("user_id"):
        return RedirectResponse("/login", status_code=302)
    ok = await crud.delete_owned_session(db, session_id, request.session["user_id"])
    if not ok:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return JSONResponse({"ok": True})


@app.get("/api/journals")
async def api_get_journals(request: Request, db: AsyncSession = Depends(get_db)):
    if not request.session.get("user_id"):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    limit = int(request.query_params.get("limit", 50))
    offset = int(request.query_params.get("offset", 0))
    journals = await crud.get_public_journals(db, limit=limit, offset=offset)
    return JSONResponse({"journals": journals})


@app.post("/api/journals")
async def api_create_journal(request: Request, db: AsyncSession = Depends(get_db)):
    if not request.session.get("user_id"):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    data = await request.json()
    content = (data.get("content") or "").strip()
    title = (data.get("title") or "").strip()
    is_anonymous = bool(data.get("is_anonymous"))
    
    if not content:
        return JSONResponse({"error": "Content is required"}, status_code=400)
    
    user_id = request.session["user_id"]
    try:
        j = await crud.create_journal(
            db, 
            user_id=user_id, 
            title=title if title else None, 
            content=content, 
            is_anonymous=is_anonymous
        )
        return JSONResponse({"ok": True, "journal_id": str(j.id)})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

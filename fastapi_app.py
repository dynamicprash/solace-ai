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


@app.get("/api/dashboard/analytics")
async def api_dashboard_analytics(request: Request, db: AsyncSession = Depends(get_db)):
    if not request.session.get("user_id"):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    user_id = request.session["user_id"]
    sessions = await crud.get_all_sessions_with_details(db, user_id)
    msg_timestamps = await crud.get_message_timestamps(db, user_id)

    # ── 1. Emotion Timeline ─────────────────────────────────────────────
    emotion_timeline = []
    date_emotions: dict[str, dict[str, int]] = {}
    for sess in sessions:
        date_key = sess.created_at.strftime("%Y-%m-%d") if sess.created_at else None
        if not date_key:
            continue
        facts = sess.facts or {}
        emotions = facts.get("emotions", [])
        if date_key not in date_emotions:
            date_emotions[date_key] = {}
        for emo in emotions:
            e = emo.lower().strip()
            date_emotions[date_key][e] = date_emotions[date_key].get(e, 0) + 1

    for date_key in sorted(date_emotions.keys()):
        emotion_timeline.append({"date": date_key, "emotions": date_emotions[date_key]})

    # ── 2. Trigger Frequency ─────────────────────────────────────────────
    trigger_counts: dict[str, int] = {}
    for sess in sessions:
        facts = sess.facts or {}
        for t in facts.get("triggers", []):
            tl = t.lower().strip()
            trigger_counts[tl] = trigger_counts.get(tl, 0) + 1
    trigger_frequency = sorted(
        [{"trigger": k, "count": v} for k, v in trigger_counts.items()],
        key=lambda x: -x["count"],
    )

    # ── 3. Severity Journey ──────────────────────────────────────────────
    severity_journey = []
    sev_order = {"low": 1, "medium": 2, "high": 3}
    for sess in sessions:
        if sess.final_severity:
            date_key = sess.created_at.strftime("%Y-%m-%d") if sess.created_at else ""
            preds = sess.predictions or []
            avg_conf = 0.0
            if preds:
                avg_conf = sum(p.get("sev_conf", 0) for p in preds) / len(preds)
            severity_journey.append({
                "date": date_key,
                "severity": sess.final_severity,
                "severity_num": sev_order.get(sess.final_severity, 0),
                "confidence": round(avg_conf, 3),
                "title": sess.title or "Untitled",
            })

    # ── 4. Category Profile ──────────────────────────────────────────────
    cat_accum: dict[str, list[float]] = {}
    for sess in sessions:
        preds = sess.predictions or []
        for p in preds:
            cat = p.get("category", "neutral")
            conf = p.get("cat_conf", 0.5)
            if cat not in cat_accum:
                cat_accum[cat] = []
            cat_accum[cat].append(conf)
    category_profile = {}
    for cat, confs in cat_accum.items():
        category_profile[cat] = round(sum(confs) / len(confs), 3) if confs else 0

    # ── 5. Engagement Heatmap ────────────────────────────────────────────
    heatmap_data: dict[str, int] = {}
    for mt in msg_timestamps:
        ts_str = mt.get("ts", "")
        if not ts_str:
            continue
        try:
            ts = datetime.fromisoformat(ts_str)
            key = f"{ts.weekday()}_{ts.hour}"
            heatmap_data[key] = heatmap_data.get(key, 0) + 1
        except (ValueError, TypeError):
            continue
    engagement_heatmap = [
        {"day_of_week": int(k.split("_")[0]), "hour": int(k.split("_")[1]), "count": v}
        for k, v in heatmap_data.items()
    ]

    # ── 6. Session Depth Scores ──────────────────────────────────────────
    session_depth_scores = []
    for sess in sessions:
        msgs = sorted(sess.messages, key=lambda m: m.id)
        user_msgs = [m for m in msgs if m.role == "user"]
        if not user_msgs:
            continue
        avg_len = sum(len(m.content) for m in user_msgs) / len(user_msgs)
        unique_words = set()
        for m in user_msgs:
            unique_words.update(m.content.lower().split())
        vocab_richness = min(len(unique_words) / 50, 1.0)
        completion_bonus = 1.0 if sess.concluded else 0.6
        depth = min(int(
            (min(avg_len / 200, 1.0) * 40) +
            (vocab_richness * 35) +
            (completion_bonus * 25)
        ), 100)
        date_key = sess.created_at.strftime("%Y-%m-%d") if sess.created_at else ""
        session_depth_scores.append({
            "session_id": str(sess.id),
            "title": sess.title or "Untitled",
            "score": depth,
            "date": date_key,
            "message_count": len(user_msgs),
        })

    # ── 7. Coping Strategies ─────────────────────────────────────────────
    coping_keywords = {
        "Breathing": ["breathing", "breath", "inhale", "exhale", "deep breaths"],
        "Exercise": ["exercise", "walk", "walking", "physical activity", "yoga", "stretch"],
        "Social": ["talk to someone", "reach out", "friend", "family", "support system", "loved one"],
        "Professional": ["therapist", "counselor", "professional help", "mental health professional", "psychiatrist"],
        "Mindfulness": ["meditation", "mindful", "present moment", "grounding", "awareness"],
        "Journaling": ["journal", "write", "writing", "express", "thoughts down"],
        "Sleep": ["sleep", "rest", "bedtime", "sleep hygiene", "routine"],
        "Self-care": ["self-care", "hobby", "enjoyable", "relaxation", "treat yourself"],
    }
    coping_counts: dict[str, int] = {}
    for sess in sessions:
        if not sess.concluded:
            continue
        msgs = sorted(sess.messages, key=lambda m: m.id)
        bot_msgs = [m for m in msgs if m.role == "assistant"]
        if not bot_msgs:
            continue
        last_bot = bot_msgs[-1].content.lower()
        for category, keywords in coping_keywords.items():
            for kw in keywords:
                if kw in last_bot:
                    coping_counts[category] = coping_counts.get(category, 0) + 1
                    break

    coping_strategies = [
        {"category": k, "count": v}
        for k, v in sorted(coping_counts.items(), key=lambda x: -x[1])
    ]

    # ── 8. Wellbeing Pulse ───────────────────────────────────────────────
    # Severity trend (lower is better → higher score)
    sev_scores_list = [sev_order.get(s.final_severity, 1) for s in sessions if s.final_severity]
    if len(sev_scores_list) >= 2:
        recent = sev_scores_list[-min(3, len(sev_scores_list)):]
        older = sev_scores_list[:max(1, len(sev_scores_list) - 3)]
        recent_avg = sum(recent) / len(recent)
        older_avg = sum(older) / len(older)
        severity_trend_score = max(0, min(100, int(100 - (recent_avg / 3) * 100 + 33)))
        trend = "improving" if recent_avg < older_avg else ("stable" if recent_avg == older_avg else "declining")
    elif sev_scores_list:
        severity_trend_score = max(0, min(100, int(100 - (sev_scores_list[0] / 3) * 100 + 33)))
        trend = "stable"
    else:
        severity_trend_score = 50
        trend = "neutral"

    # Engagement consistency
    total_sessions_count = len(sessions)
    engagement_score = min(100, total_sessions_count * 15)

    # Completion rate
    concluded_count = sum(1 for s in sessions if s.concluded)
    completion_rate = int((concluded_count / total_sessions_count) * 100) if total_sessions_count else 0

    # Emotional diversity
    all_emotions = set()
    for sess in sessions:
        facts = sess.facts or {}
        for e in facts.get("emotions", []):
            all_emotions.add(e.lower().strip())
    emotion_diversity = min(100, len(all_emotions) * 20)

    pulse_score = int(
        severity_trend_score * 0.35 +
        engagement_score * 0.20 +
        completion_rate * 0.25 +
        emotion_diversity * 0.20
    )

    wellbeing_pulse = {
        "score": min(100, max(0, pulse_score)),
        "trend": trend,
        "breakdown": {
            "severity_trend": severity_trend_score,
            "engagement": engagement_score,
            "completion_rate": completion_rate,
            "emotional_diversity": emotion_diversity,
        },
    }

    return JSONResponse({
        "emotion_timeline": emotion_timeline,
        "trigger_frequency": trigger_frequency,
        "severity_journey": severity_journey,
        "category_profile": category_profile,
        "engagement_heatmap": engagement_heatmap,
        "session_depth_scores": session_depth_scores,
        "coping_strategies": coping_strategies,
        "wellbeing_pulse": wellbeing_pulse,
    })


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

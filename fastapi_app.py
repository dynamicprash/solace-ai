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

import logging
from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.sessions import SessionMiddleware

logger = logging.getLogger("solace_fastapi")

import chat_state as cs
import db.crud_async as crud
from db.convert import chat_session_to_app_dict
from db.session import dispose_async_engine, get_async_session_factory, init_engines
from suggestions import (
    _client,
    extract_facts,
    update_facts,
    stream_response,
)

templates = Jinja2Templates(directory="templates")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_engines()
    try:
        cs.predictor.warm_up()
    except FileNotFoundError:
        pass
    
    try:
        from scheduler import start_scheduler, shutdown_scheduler
        start_scheduler()
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")

    yield

    try:
        from scheduler import shutdown_scheduler
        shutdown_scheduler()
    except Exception as e:
        logger.error(f"Failed to shutdown scheduler: {e}")

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


def is_strong_password(password: str) -> tuple[bool, str | None]:
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter."
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter."
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number."
    if not any(not c.isalnum() for c in password):
        return False, "Password must contain at least one special character."
    return True, None


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
    if not user and "@" in username:
        user = await crud.get_user_by_email(db, username)

    if not user or user.password_hash != cs.hash_pw(password):
        if want_json:
            return JSONResponse({"error": "Invalid username or password"}, status_code=401)
        return templates.TemplateResponse(
            request,
            "auth.html",
            {"mode": "login", "error": "Invalid username or password"},
            status_code=401,
        )

    # Check email verification status
    if user.email and not user.email_verified:
        if want_json:
            return JSONResponse(
                {
                    "error": "Email verification required",
                    "verification_required": True,
                    "username": user.username,
                    "email": user.email
                },
                status_code=403
            )
        return templates.TemplateResponse(
            request,
            "auth.html",
            {"mode": "login", "error": "Email verification required. Please verify your email first."},
            status_code=403
        )

    await crud.update_last_login(db, user)
    await db.commit()

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


@app.get("/api/test-notifications")
async def test_notifications():
    from scheduler import inactivity_checker_job, weekly_reflection_job
    
    # Run the jobs concurrently in the background
    asyncio.create_task(inactivity_checker_job())
    asyncio.create_task(weekly_reflection_job())
    
    return {"status": "Jobs triggered! Check terminal and Resend dashboard."}


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
    email = data.get("email")
    if email:
        email = str(email).strip().lower()

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

    # Strong password validation
    is_strong, pass_err = is_strong_password(password)
    if not is_strong:
        if want_json:
            return JSONResponse({"error": pass_err}, status_code=400)
        return templates.TemplateResponse(
            request,
            "auth.html",
            {"mode": "register", "error": pass_err},
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

    if email:
        if "@" not in email or "." not in email:
            err = "Invalid email format"
            if want_json:
                return JSONResponse({"error": err}, status_code=400)
            return templates.TemplateResponse(
                request,
                "auth.html",
                {"mode": "register", "error": err},
                status_code=400,
            )
        if await crud.get_user_by_email(db, email):
            err = "Email address already registered"
            if want_json:
                return JSONResponse({"error": err}, status_code=409)
            return templates.TemplateResponse(
                request,
                "auth.html",
                {"mode": "register", "error": err},
                status_code=409,
            )

    user = await crud.create_user(
        db,
        username=username,
        display_name=name,
        password_hash=cs.hash_pw(password),
        email=email if email else None
    )
    await db.commit()

    if email:
        import random
        code = f"{random.randint(100000, 999999)}"
        await crud.set_verification_code(db, user, code)
        await db.commit()

        try:
            from email_service import send_verification_email
            send_verification_email(email, code)
        except Exception as e:
            logger.error(f"Failed to send verification email during registration: {e}")

        if want_json:
            return JSONResponse(
                {
                    "ok": True,
                    "verification_required": True,
                    "username": username,
                    "email": email,
                    "message": "Verification code sent to your email."
                },
                status_code=201
            )
        return RedirectResponse(f"/verify-email?username={username}", status_code=302)

    # If no email provided, log in directly
    await crud.update_last_login(db, user)
    await db.commit()

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


@app.post("/api/verify-email")
async def api_verify_email(request: Request, db: AsyncSession = Depends(get_db)):
    data = await request.json()
    username_or_email = str(data.get("username", "")).strip().lower()
    code = str(data.get("code", "")).strip()

    if not username_or_email or not code:
        return JSONResponse({"error": "Username/email and verification code are required"}, status_code=400)

    user = await crud.get_user_by_username(db, username_or_email)
    if not user and "@" in username_or_email:
        user = await crud.get_user_by_email(db, username_or_email)

    if not user:
        return JSONResponse({"error": "User not found"}, status_code=404)

    success = await crud.verify_email_code(db, user, code)
    if not success:
        return JSONResponse({"error": "Invalid or expired verification code"}, status_code=400)

    await crud.update_last_login(db, user)
    await db.commit()

    request.session["user_id"] = str(user.id)
    request.session["user_name"] = user.display_name

    return JSONResponse(
        {
            "ok": True,
            "redirect": "/chat",
            "user": {
                "id": str(user.id),
                "name": user.display_name,
            }
        }
    )


@app.post("/api/resend-verification")
async def api_resend_verification(request: Request, db: AsyncSession = Depends(get_db)):
    data = await request.json()
    username_or_email = str(data.get("username", "")).strip().lower()

    if not username_or_email:
        return JSONResponse({"error": "Username or email is required"}, status_code=400)

    user = await crud.get_user_by_username(db, username_or_email)
    if not user and "@" in username_or_email:
        user = await crud.get_user_by_email(db, username_or_email)

    if not user:
        return JSONResponse({"error": "User not found"}, status_code=404)

    if not user.email:
        return JSONResponse({"error": "This user does not have an email address configured"}, status_code=400)

    # Cooldown check: 60-second limit based on verification_expires_at (10-minute expiry)
    expires = user.verification_expires_at
    if expires:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        time_left = expires - datetime.now(timezone.utc)
        # 10 minutes total duration. If > 9 minutes left, then less than 60s has passed.
        if time_left > timedelta(minutes=9):
            seconds_to_wait = int((time_left - timedelta(minutes=9)).total_seconds())
            if seconds_to_wait > 0:
                return JSONResponse(
                    {"error": f"Please wait {seconds_to_wait} seconds before requesting a new code."},
                    status_code=429
                )

    import random
    code = f"{random.randint(100000, 999999)}"
    await crud.set_verification_code(db, user, code)
    
    try:
        from email_service import send_verification_email
        send_verification_email(user.email, code)
    except Exception as e:
        logger.error(f"Failed to send verification email during resend: {e}")
        
    await db.commit()
    return JSONResponse({"ok": True, "message": "Verification code resent."})


@app.get("/api/check-username")
async def api_check_username(username: str, db: AsyncSession = Depends(get_db)):
    username = username.strip().lower()
    if not username:
        return JSONResponse({"error": "Username is required"}, status_code=400)
    user = await crud.get_user_by_username(db, username)
    return JSONResponse({"available": user is None})


@app.get("/api/unsubscribe")
async def api_unsubscribe(email: str, token: str, db: AsyncSession = Depends(get_db)):
    import hmac
    import hashlib
    from email_service import SECRET_KEY
    
    expected_token = hmac.new(SECRET_KEY.encode(), email.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_token, token):
        return HTMLResponse(
            """
            <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px;">
                <h1 style="color: #d9534f;">Invalid Link</h1>
                <p>The unsubscribe link is invalid or has expired.</p>
            </div>
            """,
            status_code=400
        )
        
    user = await crud.get_user_by_email(db, email)
    if user:
        user.wants_email_notifications = False
        await db.commit()
        
    return HTMLResponse(
        """
        <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; padding: 40px; background-color: #fdfcf9; border: 1px solid #e4e0d8; border-radius: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <span style="font-size: 48px;">🌿</span>
                <h1 style="color: #2e5133; margin-top: 20px;">Successfully Unsubscribed</h1>
                <p style="color: #4a4238; line-height: 1.6; margin-top: 15px;">You have been unsubscribed from all Solace email notifications.</p>
                <p style="color: #786e5c; font-size: 14px; margin-top: 25px;">You can close this window or return to the application.</p>
            </div>
        </div>
        """
    )


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
        dom_emotions = ["Neutral"]
        primary_emotion = "Neutral"

        try:
            async with factory() as db:
                sess = await crud.fetch_owned_session(db, session_id, user_id)
                if not sess:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
                    return
                if not user_input:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Message is required'})}\n\n"
                    return

                await crud.add_user_message(db, sess, user_input)
                await db.commit()

            # Translate user message in the background for safety and local prediction
            from suggestions import translate_to_english
            user_input_en = await asyncio.to_thread(translate_to_english, user_input)
            print(f"DEBUG: user_input='{user_input}' -> user_input_en='{user_input_en}'")

            analysis_line = None
            stop_stream = False
            is_violated, violation_type = cs.check_safety_violation(user_input_en)

            async with factory() as db:
                sess = await crud.fetch_owned_session(db, session_id, user_id)
                if not sess:
                    analysis_line = f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
                    stop_stream = True
                else:
                    if is_violated:
                        pred = {
                            "emotions": ["Anger" if "kill" in user_input_en.lower() else "Sadness"],
                            "primary_emotion": "Anger" if "kill" in user_input_en.lower() else "Sadness",
                            "emo_conf": 1.0,
                            "confidences": {"Anger": 1.0, "Sadness": 1.0, "Anxiety": 1.0, "Guilt": 1.0},
                        }
                        sess.concluded = True
                        sess.final_severity = "high"
                    else:
                        # Load/Append English translation of user messages
                        translated_list = list(sess.facts.get("translated_user_messages", []))
                        translated_list.append(user_input_en)
                        # Force SQLAlchemy update detection
                        sess.facts = {**sess.facts, "translated_user_messages": translated_list}

                        chat = chat_session_to_app_dict(sess)

                        try:
                            pred = await asyncio.to_thread(
                                cs.predictor.predict_cumulative,
                                translated_list
                            )
                        except Exception:
                            pred = {
                                "emotions": ["Neutral"],
                                "primary_emotion": "Neutral",
                                "confidences": {"Neutral": 0.5},
                                "emo_conf": 0.5,
                            }

                    preds = list(sess.predictions or [])
                    preds.append(
                        {
                            "emotions": pred["emotions"],
                            "primary_emotion": pred["primary_emotion"],
                            "emo_conf": pred["emo_conf"],
                            "confidences": pred.get("confidences", {}),
                        }
                    )
                    sess.predictions = preds
                    dom_emotions, primary_emotion = cs.dominant_prediction(preds)
                    sess.final_category = primary_emotion  # reuse column for primary emotion
                    if is_violated:
                        sess.final_severity = "high"
                    else:
                        current_severity = cs.calculate_severity(pred.get("confidences", {}))
                        sess.final_severity = current_severity

                    analysis_event = {
                        "type": "analysis",
                        "emotions": dom_emotions,
                        "primary_emotion": primary_emotion,
                        "confidences": pred.get("confidences", {}),
                        "emo_conf": pred["emo_conf"],
                        "question_count": sess.question_count,
                    }
                    await db.commit()
                    analysis_line = f"data: {json.dumps(analysis_event)}\n\n"

            if analysis_line:
                yield analysis_line
            if stop_stream:
                return

            if is_violated:
                refusal_content = (
                    "I cannot continue this conversation. If you are experiencing thoughts of harming "
                    "yourself or others, please reach out to a trusted adult, mental health professional, "
                    "or crisis hotline for support. There are many resources available to help you, including:\n\n"
                    "🆘 **Crisis Resources (Nepal)**\n"
                    "- National Suicide Prevention Helpline — Call 1166 (24/7)\n"
                    "- Patan Hospital Helpline — Call 9840021212\n"
                    "- TPO Nepal Toll Free — 1660-01-02005\n\n"
                    "Please reach out to a professional who can help. You are not alone. 💙"
                )
                words = refusal_content.split(" ")
                full_response = ""
                for i, w in enumerate(words):
                    chunk = w + " "
                    full_response += chunk
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
                    await asyncio.sleep(0.01)

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
                        "emotions": dom_emotions,
                        "primary_emotion": primary_emotion,
                    }
                    done_line = f"data: {json.dumps(done_event)}\n\n"
                
                if done_line:
                    yield done_line
                return

            gpt_client = _client()
            facts_merged = dict(chat.get("facts") or {})
            if gpt_client:
                new_facts = await asyncio.to_thread(
                    extract_facts, user_input, gpt_client
                )
                facts_merged = update_facts(facts_merged, new_facts)

            async with factory() as db:
                sess = await crud.fetch_owned_session(db, session_id, user_id)
                if not sess:
                    return
                sess.facts = facts_merged
                await db.commit()

            async with factory() as db:
                sess = await crud.fetch_owned_session(db, session_id, user_id)
                if not sess:
                    return
                chat = chat_session_to_app_dict(sess)

            stream_it = stream_response(
                cs.gpt_history(chat),
                dom_emotions,
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
                    "emotions": dom_emotions,
                    "primary_emotion": primary_emotion,
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


@app.post("/api/end")
async def api_end_session(request: Request, db: AsyncSession = Depends(get_db)):
    if not request.session.get("user_id"):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    data = await request.json()
    session_id = data.get("session_id")
    user_id = request.session["user_id"]
    
    sess = await crud.fetch_owned_session(db, session_id, user_id)
    if not sess:
        return JSONResponse({"error": "Session not found"}, status_code=404)
        
    sess.concluded = True
    await db.commit()
    
    chat = chat_session_to_app_dict(sess)
    severity = sess.final_severity or "low"
    
    # Generate a final summary from Groq
    gpt_client = _client()
    if not gpt_client:
        final_message = "Session concluded. Thank you for sharing."
    else:
        system_content = (
            "You are Solace. The user has chosen to end the session. "
            "Provide a compassionate, validating closing summary of what was discussed. "
            "Keep it under 4 sentences. Do NOT ask any follow-up questions."
        )
        if severity == "high":
            system_content += (
                "\n\nIMPORTANT: The user has expressed high severity crisis emotions. "
                "You MUST include the following crisis management steps and Nepal helpline numbers at the end of your response:\n"
                "- National Suicide Prevention Helpline — Call 1166 (24/7)\n"
                "- Patan Hospital Helpline — Call 9840021212\n"
                "- TPO Nepal Toll Free — 1660-01-02005\n"
                "Please urge them gently to reach out for professional support."
            )
            
        messages = [{"role": "system", "content": system_content}] + cs.gpt_history(chat)
        try:
            resp = await asyncio.to_thread(
                gpt_client.chat.completions.create,
                model="llama-3.3-70b-versatile",
                messages=messages,
                max_tokens=250,
                temperature=0.7,
            )
            final_message = (resp.choices[0].message.content or "").strip()
        except Exception:
            final_message = ""

    # Fallback if Groq returned nothing or client was unavailable
    if not final_message:
        if severity == "high":
            final_message = (
                "Thank you for sharing with me today. What you're feeling is valid, "
                "and I want you to know that support is available.\n\n"
                "🆘 **Crisis Resources (Nepal)**\n"
                "- National Suicide Prevention Helpline — Call 1166 (24/7)\n"
                "- Patan Hospital Helpline — Call 9840021212\n"
                "- TPO Nepal Toll Free — 1660-01-02005\n\n"
                "Please reach out to a professional who can help. You are not alone. 💙"
            )
        else:
            final_message = "Session concluded. Thank you for sharing today — please take care of yourself. 💙"
            
    await crud.add_bot_message(db, sess, final_message)
    await db.commit()
    
    return JSONResponse({"ok": True, "message": final_message})

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

    emotion_counts: dict[str, int] = {}
    total_sessions = len(rows)

    for session in rows:
        emotion = session.get("final_category") or "Neutral"
        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1

    concluded_count = sum(1 for s in rows if s.get("concluded"))
    severity_counts = {"high": 0, "medium": 0, "low": 0, "unknown": 0}
    for s in rows:
        sev = s.get("final_severity")
        if sev in severity_counts:
            severity_counts[sev] += 1
        else:
            severity_counts["unknown"] += 1

    return JSONResponse(
        {
            "sessions": rows,
            "summary": {
                "total_sessions": total_sessions,
                "emotion_counts": emotion_counts,
                "concluded_sessions": concluded_count,
                "active_sessions": total_sessions - concluded_count,
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
        if date_key not in date_emotions:
            date_emotions[date_key] = {}
        preds = sess.predictions or []
        for p in preds:
            for emo in p.get("emotions", []):
                e = emo.strip()
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
            cat = p.get("primary_emotion", "Neutral")
            conf = p.get("emo_conf", 0.5)
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
        severity_trend_score = 0
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
        preds = sess.predictions or []
        for p in preds:
            all_emotions.add(p.get("primary_emotion", "Neutral"))
    emotion_diversity = min(100, len(all_emotions) * 20)

    if concluded_count == 0:
        pulse_score = 0
    else:
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

    # ── 9. Dominant Emotion Distribution ─────────────────────────────────
    dominant_distribution: dict[str, int] = {}
    for sess in sessions:
        emo = sess.final_category or "Neutral"
        dominant_distribution[emo] = dominant_distribution.get(emo, 0) + 1

    # ── 10. Stress Curve Over Time ───────────────────────────────────────
    stress_curve = []
    for sess in sessions:
        preds = sess.predictions or []
        if not preds:
            continue
        # Average confidence across all prediction turns for crisis emotions
        crisis_scores = {"Anxiety": [], "Sadness": [], "Anger": [], "Guilt": []}
        for p in preds:
            confs = p.get("confidences", {})
            for crisis_emo in crisis_scores:
                if crisis_emo in confs:
                    crisis_scores[crisis_emo].append(confs[crisis_emo])
        
        date_key = sess.created_at.strftime("%Y-%m-%d") if sess.created_at else ""
        point = {"date": date_key, "session_title": sess.title or "Untitled"}
        has_data = False
        for emo, scores in crisis_scores.items():
            avg = round(sum(scores) / len(scores), 3) if scores else 0
            point[emo.lower()] = avg
            if avg > 0:
                has_data = True
        point["avg_stress"] = round(
            sum(point.get(e.lower(), 0) for e in crisis_scores) / 4, 3
        )
        if has_data:
            stress_curve.append(point)

    # ── 11. Weekly Emotion Trends ────────────────────────────────────────
    from collections import defaultdict
    week_emotions: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for sess in sessions:
        if not sess.created_at:
            continue
        week_key = sess.created_at.strftime("%Y-W%W")
        preds = sess.predictions or []
        for p in preds:
            for emo in p.get("emotions", []):
                week_emotions[week_key][emo] += 1

    weekly_emotion_trends = [
        {"week": wk, "emotions": dict(emos)}
        for wk, emos in sorted(week_emotions.items())
    ]

    # ── 12. Emotional Intensity Heatmap ──────────────────────────────────
    intensity_data: dict[str, list[int]] = {}
    sev_map = {"low": 1, "medium": 2, "high": 3}
    for sess in sessions:
        if not sess.final_severity or not sess.messages:
            continue
        for msg in sess.messages:
            if msg.role != "user":
                continue
            if not msg.ts:
                continue
            key = f"{msg.ts.weekday()}_{msg.ts.hour}"
            if key not in intensity_data:
                intensity_data[key] = []
            intensity_data[key].append(sev_map.get(sess.final_severity, 1))

    emotion_intensity_heatmap = [
        {
            "day_of_week": int(k.split("_")[0]),
            "hour": int(k.split("_")[1]),
            "avg_intensity": round(sum(v) / len(v), 2),
            "count": len(v),
        }
        for k, v in intensity_data.items()
    ]

    return JSONResponse({
        "emotion_timeline": emotion_timeline,
        "trigger_frequency": trigger_frequency,
        "severity_journey": severity_journey,
        "category_profile": category_profile,
        "engagement_heatmap": engagement_heatmap,
        "session_depth_scores": session_depth_scores,
        "coping_strategies": coping_strategies,
        "wellbeing_pulse": wellbeing_pulse,
        "dominant_distribution": dominant_distribution,
        "stress_curve": stress_curve,
        "weekly_emotion_trends": weekly_emotion_trends,
        "emotion_intensity_heatmap": emotion_intensity_heatmap,
    })


@app.get("/api/dashboard/export")
async def api_dashboard_export(request: Request, db: AsyncSession = Depends(get_db)):
    if not request.session.get("user_id"):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    user_id = request.session["user_id"]
    sessions = await crud.get_all_sessions_with_details(db, user_id)
    
    import csv
    import io
    from fastapi.responses import StreamingResponse
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date",
        "Session Title",
        "Primary Emotion",
        "Severity",
        "Emotions Detected",
        "Triggers",
        "Depth Score",
        "Status"
    ])
    
    for sess in sessions:
        date_key = sess.created_at.strftime("%Y-%m-%d %H:%M:%S") if sess.created_at else ""
        title = sess.title or "Untitled"
        primary_emotion = sess.final_category or "Neutral"
        severity = sess.final_severity or "Low"
        
        # Emotions detected
        emotions_set = set()
        preds = sess.predictions or []
        for p in preds:
            for emo in p.get("emotions", []):
                emotions_set.add(emo.strip())
        emotions_detected = ", ".join(sorted(emotions_set))
        
        # Triggers
        facts = sess.facts or {}
        triggers = ", ".join(facts.get("triggers", []))
        
        # Depth Score calculation
        msgs = sorted(sess.messages, key=lambda m: m.id)
        user_msgs = [m for m in msgs if m.role == "user"]
        if user_msgs:
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
        else:
            depth = 0
            
        status = "Completed" if sess.concluded else "Active"
        
        writer.writerow([
            date_key,
            title,
            primary_emotion,
            severity,
            emotions_detected,
            triggers,
            depth,
            status
        ])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=solace_ai_wellness_report.csv"}
    )


@app.post("/api/dashboard/email-report")
async def api_email_report(request: Request, db: AsyncSession = Depends(get_db)):
    if not request.session.get("user_id"):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    user_id = request.session["user_id"]
    user = await crud.get_user_by_id(db, user_id)
    if not user:
        return JSONResponse({"error": "User not found"}, status_code=404)
        
    if not user.email:
        return JSONResponse({"error": "No email address configured. Please set an email in your account settings."}, status_code=400)
        
    if not user.email_verified:
        return JSONResponse({"error": "Your email address is not verified. Please verify your email to receive reports."}, status_code=400)

    # Fetch all data for calculations
    sessions = await crud.get_all_sessions_with_details(db, user_id)
    if not sessions:
        return JSONResponse({"error": "You don't have any chat sessions yet. Create a session to generate a report."}, status_code=400)
    
    # ── Calculate Wellbeing Pulse Score & Trend ──────────────────────────────
    # Severity trend
    sev_order = {"low": 1, "medium": 2, "high": 3}
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
        severity_trend_score = 0
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
        preds = sess.predictions or []
        for p in preds:
            all_emotions.add(p.get("primary_emotion", "Neutral"))
    emotion_diversity = min(100, len(all_emotions) * 20)

    if concluded_count == 0:
        pulse_score = 0
    else:
        pulse_score = int(
            severity_trend_score * 0.35 +
            engagement_score * 0.20 +
            completion_rate * 0.25 +
            emotion_diversity * 0.20
        )
    pulse_score = min(100, max(0, pulse_score))

    # ── Severity breakdown ──────────────────────────────────────────────────
    severity_counts = {"high": 0, "medium": 0, "low": 0}
    for s in sessions:
        sev = s.final_severity or "low"
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    # ── Dominant Emotions (Top 4) ───────────────────────────────────────────
    dominant_distribution: dict[str, int] = {}
    for sess in sessions:
        emo = sess.final_category or "Neutral"
        dominant_distribution[emo] = dominant_distribution.get(emo, 0) + 1
    top_emotions = sorted(dominant_distribution.items(), key=lambda x: -x[1])

    # ── Groq Insight ────────────────────────────────────────────────────────
    gpt_client = _client()
    insights = ""
    if gpt_client:
        try:
            prompt = (
                f"Analyze these wellness statistics for a user named {user.display_name}:\n"
                f"- Wellbeing Pulse Score: {pulse_score} (Trend: {trend})\n"
                f"- Dominant emotions logged: {', '.join(f'{k} ({v} sessions)' for k, v in top_emotions[:3])}\n"
                f"- Severity counts: {severity_counts}\n\n"
                f"Write a warm, compassionate, and brief 2-3 sentence reflection offering gentle encouragement and a simple suggestion. Address the user directly. Keep it supportive and constructive."
            )
            resp = await asyncio.to_thread(
                gpt_client.chat.completions.create,
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.7,
            )
            insights = (resp.choices[0].message.content or "").strip()
        except Exception as e:
            logger.error(f"Failed to generate AI insights for email: {e}")
            
    if not insights:
        insights = (
            "Reflecting on your sessions, we notice your commitment to check in on your emotional state. "
            "Remember that every check-in is an act of self-care. Take things one step at a time, and be kind to yourself."
        )

    # ── Send Email ──────────────────────────────────────────────────────────
    import email_service
    try:
        await asyncio.to_thread(
            email_service.send_analytics_report,
            to_email=user.email,
            display_name=user.display_name,
            pulse_score=pulse_score,
            pulse_trend=trend,
            session_count=total_sessions_count,
            concluded_count=concluded_count,
            severity_counts=severity_counts,
            top_emotions=top_emotions,
            insights=insights,
            sessions=sessions
        )
    except Exception as e:
        logger.error(f"Failed to send email report: {e}")
        return JSONResponse({"error": "Failed to send email. Please check your email configuration or try again later."}, status_code=500)

    return JSONResponse({"ok": True, "message": f"Wellness analytics report has been sent to {user.email}."})


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
            "final_emotion": row["final_category"],
            "predictions": row["predictions"],
            "facts": row["facts"],
            "concluded": row["concluded"],
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
    await db.commit()
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

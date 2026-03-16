"""
app.py
=======
Flask web application for the Mental Health Chatbot.

Routes:
  GET  /              → Landing page / login check
  GET  /login         → Login page
  POST /login         → Authenticate user
  GET  /register      → Register page
  POST /register      → Create account
  POST /logout        → Logout
  GET  /chat          → Main chat interface
  POST /api/start     → Start new session (JSON)
  POST /api/message   → Send message → SSE stream
  GET  /api/history   → List past sessions (JSON)
  GET  /api/session/<id> → Load a session (JSON)
  DELETE /api/session/<id> → Delete session (JSON)

Run:
    python app.py
    # → http://localhost:5000
"""

import os
import json
import uuid
import hashlib
import re
import time
from datetime import datetime
from functools import wraps
from flask import (Flask, render_template, request, session,
                   redirect, url_for, jsonify, Response, stream_with_context)


from predict     import Predictor
from suggestions import (extract_facts, update_facts, facts_to_string,
                          stream_question, generate_conclusion, _client,
                          MAX_QUESTIONS)

# ── App config ─────────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "mh-chatbot-secret-key-change-in-prod")


# ── In-memory stores (replace with SQLite/Postgres for production) ─────────
users_db          = {}   # username → {password_hash, user_id, name}
chat_sessions_db  = {}   # session_id → ChatSession dict
user_session_idx  = {}   # user_id → [session_id, ...]

# ── Predictor singleton ────────────────────────────────────────────────────
predictor = Predictor()


# ══════════════════════════════════════════════════════════════════════════════
#  AUTH HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def hash_pw(password: str) -> str:
    return hashlib.sha256((password + app.secret_key).encode()).hexdigest()

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return decorated

def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    return next((u for u in users_db.values() if u["user_id"] == uid), None)


# ══════════════════════════════════════════════════════════════════════════════
#  CHAT SESSION HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def new_chat_session(user_id: str) -> dict:
    return {
        "session_id"    : str(uuid.uuid4()),
        "user_id"       : user_id,
        "title"         : "New Conversation",
        "created_at"    : datetime.utcnow().isoformat(),
        "updated_at"    : datetime.utcnow().isoformat(),
        "history"       : [],       # [{role, content, ts}, ...]
        "question_count": 0,
        "concluded"     : False,
        "predictions"   : [],       # [{category, severity, cat_conf, sev_conf}, ...]
        "facts"         : {
            "emotions": [], "triggers": [],
            "duration": None, "impacts": [],
            "support_system": None,
        },
        "final_category": None,
        "final_severity": None,
    }

def dominant_prediction(predictions: list) -> tuple:
    if not predictions:
        return "neutral", "low"
    from collections import Counter
    cats  = Counter(p["category"] for p in predictions)
    dom   = cats.most_common(1)[0][0]
    order = {"low": 0, "medium": 1, "high": 2}
    worst = max(predictions, key=lambda p: order.get(p["severity"], 0))
    return dom, worst["severity"]

def gpt_history(chat_session: dict) -> list:
    return [{"role": m["role"], "content": m["content"]}
            for m in chat_session["history"]]

def add_user_msg(chat_session: dict, text: str):
    chat_session["history"].append({
        "role": "user", "content": text,
        "ts": datetime.utcnow().isoformat()
    })
    # Update title from first user message
    if len([m for m in chat_session["history"] if m["role"] == "user"]) == 1:
        chat_session["title"] = text[:45] + ("..." if len(text) > 45 else "")
    chat_session["updated_at"] = datetime.utcnow().isoformat()

def add_bot_msg(chat_session: dict, text: str):
    chat_session["history"].append({
        "role": "assistant", "content": text,
        "ts": datetime.utcnow().isoformat()
    })
    chat_session["question_count"] += 1
    chat_session["updated_at"] = datetime.utcnow().isoformat()

def all_user_text(chat_session: dict) -> str:
    msgs = [m["content"] for m in chat_session["history"] if m["role"] == "user"]
    return " ".join(msgs)[:1500]


# ══════════════════════════════════════════════════════════════════════════════
#  PAGE ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/")
def index():
    if "user_id" in session:
        return redirect(url_for("chat_page"))
    return redirect(url_for("login_page"))

@app.route("/login", methods=["GET"])
def login_page():
    if "user_id" in session:
        return redirect(url_for("chat_page"))
    return render_template("auth.html", mode="login")

@app.route("/login", methods=["POST"])
def login_post():
    data     = request.get_json(silent=True) or request.form
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))

    user = users_db.get(username)
    if not user or user["password_hash"] != hash_pw(password):
        if request.is_json:
            return jsonify({"error": "Invalid username or password"}), 401
        return render_template("auth.html", mode="login",
                               error="Invalid username or password")

    session["user_id"]   = user["user_id"]
    session["user_name"] = user["name"]
    if request.is_json:
        return jsonify({"ok": True, "redirect": url_for("chat_page")})
    return redirect(url_for("chat_page"))

@app.route("/register", methods=["GET"])
def register_page():
    if "user_id" in session:
        return redirect(url_for("chat_page"))
    return render_template("auth.html", mode="register")

@app.route("/register", methods=["POST"])
def register_post():
    data     = request.get_json(silent=True) or request.form
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))
    name     = str(data.get("name", username)).strip()

    if not username or not password:
        err = "Username and password are required"
        if request.is_json: return jsonify({"error": err}), 400
        return render_template("auth.html", mode="register", error=err)
    if len(password) < 6:
        err = "Password must be at least 6 characters"
        if request.is_json: return jsonify({"error": err}), 400
        return render_template("auth.html", mode="register", error=err)
    if username in users_db:
        err = "Username already taken"
        if request.is_json: return jsonify({"error": err}), 409
        return render_template("auth.html", mode="register", error=err)

    user_id = str(uuid.uuid4())
    users_db[username] = {
        "user_id"      : user_id,
        "username"     : username,
        "name"         : name,
        "password_hash": hash_pw(password),
        "created_at"   : datetime.utcnow().isoformat(),
    }
    user_session_idx[user_id] = []
    session["user_id"]   = user_id
    session["user_name"] = name

    if request.is_json:
        return jsonify({"ok": True, "redirect": url_for("chat_page")}), 201
    return redirect(url_for("chat_page"))

@app.route("/logout", methods=["POST", "GET"])
def logout():
    session.clear()
    return redirect(url_for("login_page"))

@app.route("/chat")
@login_required
def chat_page():
    user = current_user()
    past = [
        {
            "session_id"    : chat_sessions_db[sid]["session_id"],
            "title"         : chat_sessions_db[sid]["title"],
            "updated_at"    : chat_sessions_db[sid]["updated_at"],
            "concluded"     : chat_sessions_db[sid]["concluded"],
            "final_category": chat_sessions_db[sid]["final_category"],
            "final_severity": chat_sessions_db[sid]["final_severity"],
        }
        for sid in reversed(user_session_idx.get(session["user_id"], []))
        if sid in chat_sessions_db
    ]
    return render_template("chat.html", user=user, past_sessions=past)


# ══════════════════════════════════════════════════════════════════════════════
#  API ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/start", methods=["POST"])
@login_required
def api_start():
    """Start a new chat session. Returns session_id + opening message."""
    user_id  = session["user_id"]
    cs       = new_chat_session(user_id)
    chat_sessions_db[cs["session_id"]] = cs
    user_session_idx.setdefault(user_id, []).append(cs["session_id"])

    opening  = (
        f"Hello {session.get('user_name', '')}! I'm here to listen and support you. 💙\n\n"
        "This is a safe, non-judgmental space. How are you feeling today?"
    )
    add_bot_msg(cs, opening)

    return jsonify({
        "session_id"    : cs["session_id"],
        "message"       : opening,
        "question_count": 0,
        "max_questions" : MAX_QUESTIONS,
        "concluded"     : False,
    })


@app.route("/api/message", methods=["POST"])
@login_required
def api_message():
    """
    Receive a user message. Returns a Server-Sent Events stream with events:
      analysis  — BERT+LSTM prediction
      token     — GPT word chunk (streaming)
      concluding — signals final assessment starting
      done      — stream complete, carries session state
      error     — something went wrong
    """
    data       = request.get_json() or {}
    user_input = data.get("message", "").strip()
    session_id = data.get("session_id", "")

    cs = chat_sessions_db.get(session_id)
    if not cs or cs["user_id"] != session["user_id"]:
        return jsonify({"error": "Session not found"}), 404
    if not user_input:
        return jsonify({"error": "Message is required"}), 400
    if cs["concluded"]:
        return jsonify({"error": "This session has already concluded"}), 400

    def generate():
        # 1 ── Store user message
        add_user_msg(cs, user_input)

        # 2 ── BERT+LSTM cumulative prediction
        try:
            pred = predictor.predict_cumulative(
                [m["content"] for m in cs["history"] if m["role"] == "user"]
            )
        except Exception as e:
            pred = {"category": "neutral", "severity": "low",
                    "cat_conf": 0.5, "sev_conf": 0.5}

        cs["predictions"].append({
            "category": pred["category"], "severity": pred["severity"],
            "cat_conf": pred["cat_conf"], "sev_conf": pred["sev_conf"],
        })

        dom_cat, dom_sev = dominant_prediction(cs["predictions"])
        cs["final_category"] = dom_cat
        cs["final_severity"]  = dom_sev

        analysis_event = {
            "type"          : "analysis",
            "category"      : dom_cat,
            "severity"      : dom_sev,
            "cat_conf"      : pred["cat_conf"],
            "sev_conf"      : pred["sev_conf"],
            "question_count": cs["question_count"],
            "max_questions" : MAX_QUESTIONS,
        }
        yield f"data: {json.dumps(analysis_event)}\n\n"

        # 3 ── Extract facts (non-blocking)
        gpt_client = _client()
        if gpt_client:
            new_facts = extract_facts(user_input, gpt_client)
            cs["facts"] = update_facts(cs["facts"], new_facts)

        # 4 ── Determine response type
        is_conclusion = cs["question_count"] >= MAX_QUESTIONS

        if is_conclusion:
            cs["concluded"] = True
            yield f"data: {json.dumps({'type': 'concluding'})}\n\n"

        # 5 ── Stream Groq response (always uses Groq — key error shown in chat)
        full_response = ""
        history_for_gpt = gpt_history(cs)
        for chunk in stream_question(
            history_for_gpt,
            dom_cat, dom_sev,
            cs["facts"],
            cs["question_count"] + 1,
            client=gpt_client,
        ):
            full_response += chunk
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"


        # 6 ── Store bot response
        add_bot_msg(cs, full_response.strip())

        # 7 ── Done event
        done_event = {
            "type"          : "done",
            "question_count": cs["question_count"],
            "max_questions" : MAX_QUESTIONS,
            "concluded"     : cs["concluded"],
            "category"      : dom_cat,
            "severity"      : dom_sev,
        }
        yield f"data: {json.dumps(done_event)}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/api/history", methods=["GET"])
@login_required
def api_history():
    user_id = session["user_id"]
    ids = user_session_idx.get(user_id, [])
    result = []
    for sid in reversed(ids):
        cs = chat_sessions_db.get(sid)
        if cs:
            result.append({
                "session_id"    : cs["session_id"],
                "title"         : cs["title"],
                "created_at"    : cs["created_at"],
                "updated_at"    : cs["updated_at"],
                "question_count": cs["question_count"],
                "concluded"     : cs["concluded"],
                "final_category": cs["final_category"],
                "final_severity": cs["final_severity"],
            })
    return jsonify({"sessions": result})


@app.route("/api/session/<session_id>", methods=["GET"])
@login_required
def api_get_session(session_id):
    cs = chat_sessions_db.get(session_id)
    if not cs or cs["user_id"] != session["user_id"]:
        return jsonify({"error": "Not found"}), 404
    return jsonify({
        "session_id"    : cs["session_id"],
        "title"         : cs["title"],
        "history"       : cs["history"],
        "question_count": cs["question_count"],
        "max_questions" : MAX_QUESTIONS,
        "concluded"     : cs["concluded"],
        "final_category": cs["final_category"],
        "final_severity": cs["final_severity"],
        "facts"         : cs["facts"],
    })


@app.route("/api/session/<session_id>", methods=["DELETE"])
@login_required
def api_delete_session(session_id):
    cs = chat_sessions_db.get(session_id)
    if not cs or cs["user_id"] != session["user_id"]:
        return jsonify({"error": "Not found"}), 404
    del chat_sessions_db[session_id]
    idx = user_session_idx.get(session["user_id"], [])
    if session_id in idx:
        idx.remove(session_id)
    return jsonify({"ok": True})


def _get_fallback(q_num: int, is_conclusion: bool) -> str:
    if is_conclusion:
        return (
            "Thank you so much for sharing everything with me.\n\n"
            "Based on our conversation, you've been going through a genuinely "
            "difficult time. Your feelings are completely valid.\n\n"
            "**Coping Strategies:**\n"
            "1. Practice slow, deep breathing (4-7-8 technique)\n"
            "2. Keep a brief daily journal\n"
            "3. Maintain a regular sleep schedule\n"
            "4. Reach out to one trusted person this week\n\n"
            "**Next Steps:** Consider speaking with a mental health professional "
            "for personalised support. You deserve proper care and you don't "
            "have to face this alone."
        )
    fallbacks = {
        1: "What do you think has been causing you to feel this way?",
        2: "How long have you been feeling like this?",
        3: "How has this been affecting your daily life?",
        4: "Do you have anyone around you that you can talk to?",
        5: "Is there anything else that's been weighing on your mind?",
    }
    return fallbacks.get(q_num, "Can you tell me a bit more about how you're feeling?")


# ══════════════════════════════════════════════════════════════════════════════
#  STARTUP
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n  🌿 Mental Health Chatbot")
    print("  ──────────────────────────────────────────")

    # Try to warm up predictor (non-fatal if model not yet trained)
    try:
        predictor.warm_up()
    except FileNotFoundError as e:
        print(f"  ⚠  Predictor not loaded: {e}")
        print("     Run generate_dataset.py → train.py first")

    groq_key = os.environ.get("GROQ_API_KEY", "your-groq-api-key-here")
    print(f"  Groq   : {'✓ configured' if groq_key != 'your-groq-api-key-here' else '✗ API key not set'}")
    print(f"  Templates: {os.path.exists('templates')}")
    print("\n  Running on http://localhost:5000\n")

    app.run(debug=True, port=5000, threaded=True)
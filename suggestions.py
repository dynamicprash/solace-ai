"""
suggestions.py
===============
All LLM interactions — now powered by Groq (FREE, fast inference).

Model used: llama-3.1-70b-versatile
  - Free tier: 14,400 requests/day, 500,000 tokens/minute
  - No credit card required

Get your free Groq API key:
  1. Go to https://console.groq.com
  2. Sign up (free, no credit card)
  3. API Keys → Create API Key  (starts with gsk_...)
  4. Set env variable:  GROQ_API_KEY=gsk_...
"""

import os
import re
import json
from groq import Groq

# ── Config ──────────────────────────────────────────────────────────────────
GROQ_API_KEY  = os.environ.get("GROQ_API_KEY", "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")
GROQ_MODEL    = "llama-3.3-70b-versatile"
MAX_QUESTIONS = 5

CATEGORY_DISPLAY = {
    "anxiety"    : "Anxiety",
    "depression" : "Depression",
    "self_harm"  : "Self-harm / Suicidal ideation",
    "neutral"    : "General distress",
}

SEVERITY_GUIDANCE = {
    "low"   : "mild — respond warmly but lightly",
    "medium": "moderate — show genuine concern, ask clarifying questions",
    "high"  : "severe — respond with urgency, empathy, always mention professional help",
}


def _client():
    key = os.environ.get("GROQ_API_KEY", GROQ_API_KEY)
    if not key or key == "your-groq-api-key-here":
        return None
    return Groq(api_key=key)


# ── Fact extraction ──────────────────────────────────────────────────────────

def extract_facts(user_message, client=None):
    if client is None:
        client = _client()
    if client is None:
        return {}
    prompt = [
        {
            "role": "system",
            "content": (
                "Extract mental health information from the user message. "
                "Return ONLY valid JSON with these exact keys (null if not mentioned):\n"
                '{"emotion": null, "trigger": null, "duration": null, '
                '"daily_impact": null, "support_system": null}\n'
                "No explanation. No markdown. Just the JSON object."
            ),
        },
        {"role": "user", "content": user_message[:500]},
    ]
    try:
        resp  = client.chat.completions.create(model=GROQ_MODEL, messages=prompt, max_tokens=150, temperature=0)
        raw   = resp.choices[0].message.content.strip()
        clean = re.sub(r"```(?:json)?|```", "", raw).strip()
        return json.loads(clean)
    except Exception:
        return {}


def update_facts(session_facts, new_facts):
    f = session_facts
    if new_facts.get("emotion"):
        emotions = f.get("emotions", [])
        if new_facts["emotion"] not in emotions:
            emotions.append(new_facts["emotion"])
        f["emotions"] = emotions
    if new_facts.get("trigger"):
        triggers = f.get("triggers", [])
        if new_facts["trigger"] not in triggers:
            triggers.append(new_facts["trigger"])
        f["triggers"] = triggers
    if new_facts.get("duration"):
        f["duration"] = new_facts["duration"]
    if new_facts.get("daily_impact"):
        impacts = f.get("impacts", [])
        if new_facts["daily_impact"] not in impacts:
            impacts.append(new_facts["daily_impact"])
        f["impacts"] = impacts
    if new_facts.get("support_system"):
        f["support_system"] = new_facts["support_system"]
    return f


def facts_to_string(facts):
    parts = []
    if facts.get("emotions"):   parts.append(f"Emotions: {', '.join(facts['emotions'])}")
    if facts.get("triggers"):   parts.append(f"Causes: {', '.join(facts['triggers'])}")
    if facts.get("duration"):   parts.append(f"Duration: {facts['duration']}")
    if facts.get("impacts"):    parts.append(f"Daily impact: {', '.join(facts['impacts'])}")
    if facts.get("support_system"): parts.append(f"Support system: {facts['support_system']}")
    return " | ".join(parts) if parts else "Still gathering information."


# ── Prompt builders ──────────────────────────────────────────────────────────

def _question_system_prompt(cat_label, sev_label, facts_str, q_num):
    remaining = MAX_QUESTIONS - q_num + 1
    return f"""You are a compassionate, professional mental health support assistant conducting a gentle assessment.

CURRENT AI ANALYSIS:
- Detected condition: {cat_label}
- Severity: {sev_label}
- Facts so far: {facts_str}
- Question {q_num} of {MAX_QUESTIONS} ({remaining} remaining)

Ask exactly ONE short, warm, natural follow-up question.
Follow this progression if not yet covered:
  Q1-2: What is causing these feelings? (triggers)
  Q3:   How long has this been going on? (duration)
  Q4:   How is it affecting daily life? (impact)
  Q5:   Do they have support around them?
  If severity HIGH: gently ask about self-harm thoughts (if not yet asked)

Rules: one question only, short, conversational, never repeat, no advice yet, no mention of AI.
Respond with only the question itself."""


def _conclusion_system_prompt(category, severity, facts_str):
    cat_label = CATEGORY_DISPLAY.get(category, category)
    crisis = ""
    if severity == "high" or category == "self_harm":
        crisis = """
## Crisis Resources
If you are in immediate danger, please reach out:
- **988 Suicide & Crisis Lifeline** — Call or text **988** (US, 24/7)
- **Crisis Text Line** — Text **HOME** to **741741**
- **International** — https://www.iasp.info/resources/Crisis_Centres/"""

    return f"""You are a compassionate mental health support assistant completing a 5-question assessment.

AI ANALYSIS: {cat_label} | Severity: {severity}
Facts gathered: {facts_str}

Write a warm conclusion using EXACTLY these markdown section headers:

## I Hear You
## What I'm Observing
## Why You Might Be Feeling This Way
## Coping Strategies
## Recommended Next Steps
{crisis}

Tone: warm, empowering, hopeful. ~380 words. Plain language."""


# ── Non-streaming ────────────────────────────────────────────────────────────

def generate_question(conversation_history, category, severity, facts, question_number, client=None):
    if client is None:
        client = _client()
    cat_label = CATEGORY_DISPLAY.get(category, category)
    sev_label = SEVERITY_GUIDANCE.get(severity, severity)
    facts_str = facts_to_string(facts)
    system_prompt = _question_system_prompt(cat_label, sev_label, facts_str, question_number)
    messages = [{"role": "system", "content": system_prompt}] + conversation_history
    fallbacks = {
        1: "What do you think has been causing you to feel this way?",
        2: "How long have you been feeling like this?",
        3: "How has this been affecting your daily life?",
        4: "Do you have anyone around you that you can talk to?",
        5: "Is there anything else that has been weighing on your mind?",
    }
    if client is None:
        return fallbacks.get(question_number, "Can you tell me more about how you're feeling?")
    try:
        resp = client.chat.completions.create(model=GROQ_MODEL, messages=messages, max_tokens=120, temperature=0.7)
        return resp.choices[0].message.content.strip()
    except Exception:
        return fallbacks.get(question_number, "Can you tell me a bit more about that?")


def generate_conclusion(conversation_history, category, severity, facts, client=None):
    if client is None:
        client = _client()
    facts_str = facts_to_string(facts)
    system_prompt = _conclusion_system_prompt(category, severity, facts_str)
    messages = [{"role": "system", "content": system_prompt}] + conversation_history
    if client is None:
        return "## I Hear You\nThank you for sharing.\n\n## Recommended Next Steps\nPlease consider speaking with a mental health professional."
    try:
        resp = client.chat.completions.create(model=GROQ_MODEL, messages=messages, max_tokens=700, temperature=0.7)
        return resp.choices[0].message.content.strip()
    except Exception as e:
        return f"Error generating assessment: {e}"


# ── Streaming (used by app.py) ───────────────────────────────────────────────

def stream_question(conversation_history, category, severity, facts, question_number, client=None):
    """Generator yielding token chunks from Groq for real-time streaming."""
    if client is None:
        client = _client()

    cat_label = CATEGORY_DISPLAY.get(category, category)
    sev_label = SEVERITY_GUIDANCE.get(severity, severity)
    facts_str = facts_to_string(facts)

    is_conclusion = question_number > MAX_QUESTIONS

    if is_conclusion:
        system_content = _conclusion_system_prompt(category, severity, facts_str)
        max_tokens     = 700
    else:
        system_content = _question_system_prompt(cat_label, sev_label, facts_str, question_number)
        max_tokens     = 120

    messages = [{"role": "system", "content": system_content}] + conversation_history

    if client is None:
        yield (
            "⚠️ **Groq API key not set.**\n\n"
            "To fix this:\n"
            "1. Get a free key at https://console.groq.com\n"
            "2. Open `suggestions.py` and set your key on line 17:\n"
            "   `GROQ_API_KEY = \"gsk_your_actual_key_here\"`\n"
            "3. Restart `python app.py`"
        )
        return

    try:
        stream = client.chat.completions.create(
            model=GROQ_MODEL, messages=messages,
            max_tokens=max_tokens, temperature=0.7, stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content
    except Exception as e:
        yield f"\n\n⚠️ Groq error: {e}\n\nPlease check your GROQ_API_KEY in suggestions.py"
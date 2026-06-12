import os
import re
import json
from groq import Groq

# ── Config ──────────────────────────────────────────────────────────────────
GROQ_API_KEY  = os.environ.get("GROQ_API_KEY", "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")
GROQ_MODEL    = "llama-3.3-70b-versatile"

# ── Emotion display names ───────────────────────────────────────────────────
EMOTION_DISPLAY = {
    "Anxiety"        : "Anxiety / Nervousness",
    "Sadness"        : "Sadness / Grief",
    "Anger"          : "Anger / Frustration",
    "Guilt"          : "Guilt / Remorse",
    "Disappointment" : "Disappointment",
    "Confusion"      : "Confusion / Overwhelm",
    "Hopefulness"    : "Hopefulness / Optimism",
    "Joy"            : "Joy / Excitement",
    "Love"           : "Love / Admiration",
    "Gratitude"      : "Gratitude / Caring",
    "Curiosity"      : "Curiosity / Interest",
    "Surprise"       : "Surprise / Realization",
    "Neutral"        : "Neutral / Balanced",
}

# Emotions that indicate potential risk — trigger crisis awareness
HIGH_RISK_EMOTIONS = {"Anxiety", "Sadness", "Guilt", "Anger"}

# Positive emotions — encourage and reflect
POSITIVE_EMOTIONS = {"Hopefulness", "Joy", "Love", "Gratitude", "Curiosity"}


def _client():
    key = os.environ.get("GROQ_API_KEY", GROQ_API_KEY)
    if not key or key == "your-groq-api-key-here":
        return None
    return Groq(api_key=key)


def translate_to_english(text: str) -> str:
    """
    Translates user text (e.g. Devanagari or Romanized Nepali) to English in the background
    for safety checks and local emotion model prediction.
    If it is already in English, returns it mostly unchanged.
    """
    client = _client()
    if not client:
        return text

    prompt = (
        "You are an expert translator specializing in translating Devanagari Nepali and Romanized Nepali "
        "(Nepali written in Latin characters) to English.\n"
        "Translate the input text to English. If it is already in English, return it exactly as is.\n\n"
        "Here are some examples of Romanized Nepali translations for context:\n"
        "- 'tapailai kasto cha' -> 'How are you?'\n"
        "- 'malai afu lai hani purauna man cha' -> 'I want to harm myself.'\n"
        "- 'malai marna man cha' -> 'I want to die.'\n"
        "- 'yo sansar chorna man cha' -> 'I want to leave this world.'\n"
        "- 'ma sahana sakdina' -> 'I cannot bear this.'\n"
        "- 'malai garho vako cha' -> 'I am having a hard time.'\n\n"
        "Output ONLY the English translation, without any explanations, conversational filler, introductory text, or quotation marks.\n\n"
        f"Input: {text}\n"
        "Translation:"
    )

    try:
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=250,
            temperature=0.0,
        )
        translated = resp.choices[0].message.content.strip().strip('"').strip("'").strip()
        return translated if translated else text
    except Exception:
        return text



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


# ── Adaptive prompt builder ─────────────────────────────────────────────────

def _adaptive_system_prompt(emotions, facts_str, turn_count):
    """Build a dynamic system prompt based on detected emotions and conversation context."""

    # Format emotion labels for display
    emotion_labels = [EMOTION_DISPLAY.get(e, e) for e in emotions]
    emotion_str = ", ".join(emotion_labels) if emotion_labels else "Not yet determined"

    # Determine emotional tone category
    has_negative = any(e in HIGH_RISK_EMOTIONS for e in emotions)
    has_positive = any(e in POSITIVE_EMOTIONS for e in emotions)
    is_mixed     = has_negative and has_positive

    # Adaptive tone guidance
    if is_mixed:
        tone_guide = (
            "The user is experiencing mixed emotions. Acknowledge the complexity — "
            "validate the difficult feelings while gently reinforcing the positive ones. "
            "Ask what feels strongest right now."
        )
    elif has_negative:
        negative_emos = [e for e in emotions if e in HIGH_RISK_EMOTIONS]
        tone_guide = (
            f"The user is experiencing {', '.join(negative_emos).lower()}. "
            "Respond with deep empathy and warmth. Ask thoughtful questions to understand "
            "the root cause. Never dismiss or minimize their feelings."
        )
        # Escalate for persistent negative emotions
        if turn_count >= 3:
            tone_guide += (
                " Since this emotional state has persisted across the conversation, "
                "gently explore if they've considered talking to a trusted friend, "
                "family member, or mental health professional."
            )
    elif has_positive:
        tone_guide = (
            "The user is in a positive emotional state. Reflect their positivity, "
            "celebrate with them, and explore what's contributing to this feeling. "
            "Help them identify ways to sustain this wellbeing."
        )
    else:
        tone_guide = (
            "The user's emotional state is neutral or unclear. Use gentle, open-ended "
            "questions to understand how they're really feeling beneath the surface."
        )

    # Adaptive questioning based on turn count
    if turn_count <= 1:
        stage_guide = "This is early in the conversation. Focus on building rapport and understanding their current state."
    elif turn_count <= 3:
        stage_guide = "You're getting to know them. Explore triggers, context, and what's been on their mind."
    elif turn_count <= 6:
        stage_guide = "You have good context now. Go deeper — ask about patterns, coping, and what support they have."
    else:
        stage_guide = "This is a longer conversation. Provide gentle insights, suggest coping strategies, or offer a compassionate reflection of what you've learned."

    # Crisis awareness
    crisis_note = ""
    if "Anxiety" in emotions and "Sadness" in emotions:
        crisis_note = (
            "\n\nIMPORTANT: If the user expresses thoughts of self-harm or suicide, "
            "always provide crisis resources:\n"
            "- National Suicide Prevention Helpline — Call 1166 (Nepal, 24/7)\n"
            "- Patan Hospital Helpline — Call 9840021212\n"
            "- TPO Nepal Toll Free — 1660-01-02005\n"
            "- International — https://www.iasp.info/resources/Crisis_Centres/"
        )

    return f"""You are Solace, a compassionate and emotionally intelligent mental health companion.

DETECTED EMOTIONS: {emotion_str}
GATHERED CONTEXT: {facts_str}
CONVERSATION TURN: {turn_count}

{tone_guide}

{stage_guide}
{crisis_note}

RULES:
- Respond naturally and conversationally — you are a supportive companion, not a clinical tool
- Match the user's language and script style. If the user writes in Devanagari script, reply in Devanagari Nepali. If the user writes in Romanized Nepali (Nepali written in Latin script like 'ali thik chaina'), reply in Romanized Nepali. If the user writes in English, reply in English.
- Ask ONE thoughtful follow-up question at the end of your response
- Keep responses concise (2-4 sentences + question)
- Never diagnose or prescribe — you are not a doctor
- Never mention "AI analysis", "detected emotions", or technical details
- Use the person's own words and experiences to show you're listening
- If they share something positive, celebrate it genuinely
- OFF-TOPIC REFUSAL: You are ONLY a mental health and emotional support companion. If the user asks factual, general knowledge, trivia, academic, or unrelated questions (e.g. "what is the capital of Nepal", "solve this math problem", "who is the president of X"), do NOT answer them. Instead, gently and warmly redirect: acknowledge that you're not the right tool for that, then ask how they are feeling today.
- CRITICAL SAFETY: If the user expresses any intent, thoughts, or actions of self-harm, suicide, or violence against others, you MUST refuse to continue the conversation. Politely and directly direct them to contact a crisis hotline (Nepal Call 1166) or professional help, and ask if there's anything else you can help with. Do not explore or validate violent thoughts."""


# ── Streaming (used by fastapi_app.py) ───────────────────────────────────────

def stream_response(conversation_history, emotions, facts, turn_count, client=None):
    """Generator yielding token chunks from Groq for real-time streaming."""
    if client is None:
        client = _client()

    facts_str = facts_to_string(facts)
    system_content = _adaptive_system_prompt(emotions, facts_str, turn_count)
    max_tokens = 250

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
# 🌿 Solace-AI — AI-Powered Emotion Analytics & Mental Wellness Companion

> *Your safe space to be heard, understood, and supported.*

Solace-AI is an advanced, privacy-first mental health companion web application. It combines a custom-trained deep learning classifier (BERT + BiLSTM + Attention) for real-time multi-label emotion detection with large language models (LLMs) to deliver empathetic, context-aware, streaming conversational support.

---

## 📂 Project Structure

```
solace-ai/
├── app.py                    # Uvicorn entry point (serves FastAPI on port 8000)
├── fastapi_app.py            # All FastAPI routes: SSE stream, session management, dashboard, auth, export
├── chat_state.py             # Predictor singleton, severity calculation, safety guardrail regex patterns
├── suggestions.py            # Groq Llama 3.3 integration: adaptive prompts, fact extraction, Nepali translation
├── email_service.py          # Resend email templates (OTP, inactivity nudge, weekly reports, analytics)
├── scheduler.py              # APScheduler background jobs (hourly inactivity checker, Sunday weekly report)
├── predict.py                # BERT+BiLSTM+Attention model definition, Predictor class, cumulative prediction
├── train.py                  # Model training script (BERT+BiLSTM, 10 epochs, GoEmotions dataset)
├── generate_dataset.py       # GoEmotions (27-class) → 13-class label mapping and multi-hot data pipeline
├── requirements.txt          # Python dependencies
├── alembic/                  # Database schema migrations
├── saved_models/
│   ├── bert_lstm_model.pt    # Trained model weights (~454 MB)
│   └── model_config.json     # Model hyperparameters and 13 emotion class list
├── datasets/                 # Downloaded GoEmotions data (git-ignored)
└── frontend/                 # React (Vite) + TailwindCSS v4 frontend
    ├── package.json
    └── src/
        ├── App.jsx                   # Client-side router (React Router v7) & auth guard
        ├── main.jsx                  # React entry point
        ├── index.css                 # Global styles
        ├── store/
        │   ├── authStore.js          # Zustand auth store (login, register, logout, verify email)
        │   └── chatStore.js          # Zustand chat store (messages, streaming, session state)
        ├── services/
        │   ├── api.js                # Axios instance with base URL
        │   ├── auth.js               # Auth API calls (login, register, verify, resend, me, logout)
        │   ├── chat.js               # Chat API calls + SSE EventSource stream parser
        │   └── journal.js            # Journal API calls (list, create)
        ├── pages/
        │   └── LandingPage.jsx       # Marketing landing page
        └── components/
            ├── auth/
            │   ├── LoginPage.jsx         # Login/Register page wrapper
            │   ├── LoginForm.jsx         # Email+password login form
            │   ├── RegisterForm.jsx      # Registration form with password-strength indicator
            │   └── VerifyEmailPage.jsx   # 6-digit OTP verification page
            ├── chat/
            │   ├── ChatPage.jsx          # Main chat layout, session blocker, exit-confirm modal
            │   ├── Sidebar.jsx           # Session list, New Chat button, navigation links
            │   ├── Topbar.jsx            # Session status bar with emotion badges & End Session button
            │   ├── MessageList.jsx       # Scrollable message history with prediction badges
            │   ├── MessageBubble.jsx     # User/bot message bubble component
            │   ├── EmotionBadge.jsx      # Per-message AI NLP emotion badge with color coding
            │   ├── SeverityBadge.jsx     # Low / Medium / High severity badge
            │   ├── InputArea.jsx         # Message textarea + send button
            │   ├── WelcomeScreen.jsx     # Splash screen shown before any session starts
            │   └── TypingIndicator.jsx   # Animated dots during streaming
            ├── dashboard/
            │   ├── DashboardPage.jsx     # Full analytics dashboard with 14 chart components
            │   └── charts/
            │       ├── WellbeingPulse.jsx          # Composite score gauge (0–100)
            │       ├── WellbeingPulseHistory.jsx   # Longitudinal pulse trend sparkline
            │       ├── DominantEmotionChart.jsx    # Primary emotion donut distribution
            │       ├── WeeklyEmotionTrends.jsx     # 13-emotion week-over-week line chart
            │       ├── StressCurveChart.jsx        # Crisis emotion (Anxiety/Sadness/Anger/Guilt) curves
            │       ├── EmotionIntensityHeatmap.jsx # Severity by hour × day-of-week heatmap
            │       ├── CategoryRadarChart.jsx      # Radar of average confidence per emotion class
            │       ├── EmotionTideChart.jsx        # Stacked emotion timeline per session date
            │       ├── SeverityJourneyChart.jsx    # Session severity trend over time
            │       ├── TriggerBubbleChart.jsx      # Bubble chart of most frequent stress triggers
            │       ├── EngagementHeatmap.jsx       # Message frequency by day × hour heatmap
            │       ├── SessionDepthChart.jsx       # Session engagement depth scores
            │       ├── EmotionComparisonCard.jsx   # Week-over-week emotion delta cards
            │       └── CopingToolkit.jsx           # Recommended coping strategy frequency bars
            ├── journal/
            │   └── JournalPage.jsx       # Public journal feed with compose modal
            └── common/
                ├── Button.jsx            # Reusable button component
                ├── Card.jsx              # Reusable card wrapper
                └── Input.jsx             # Reusable input component
```

---

## 🌟 Key Features

### 🧠 Hybrid Emotion-Aware Conversational AI
- **Custom Multi-Label Emotion Detection**: A locally-trained BERT+BiLSTM+Attention model classifies user messages across **13 distinct emotional categories** with cumulative prediction across the session.
- **Real-Time SSE Streaming**: Server-Sent Events stream the LLM response word-by-word with concurrent emotion analysis updates.
- **Adaptive LLM Prompting**: Groq API (Llama 3.3 70B) adjusts dialogue tone based on detected emotions, accumulated contextual facts, and conversation stage.
- **Multilingual Support**: Automatically detects and translates Devanagari Nepali and Romanized Nepali to English for safety checks and emotion prediction, then responds in the user's script.
- **Fact Extraction**: Groq LLM extracts structured facts from each message (emotion, trigger, duration, daily impact, support system) and accumulates them across the session.

### 🛡️ Programmatic Safety Guardrails
- **Deterministic Regex Interceptor**: Real-time pattern matching for self-harm, suicidal intent, homicidal ideation, and past violent crime confessions.
- **Crisis Trigger Fallback**: Bypasses LLM generation, sets severity to **high**, concludes the session, and surfaces Nepal crisis helplines.
- **Crisis Helplines**: Nepal's National Suicide Prevention line (**1166**), Patan Hospital helpline (**9840021212**), TPO Nepal (**1660-01-02005**).

### 📊 Advanced Mental Wellness Dashboard (14 Charts)
- **Wellbeing Pulse**: Composite score (0–100) calculated from severity trend, session engagement, completion rate, and emotional diversity.
- **Dominant Emotion Distribution** — Donut chart of primary emotion counts across all sessions.
- **Weekly Emotion Trends** — 13-emotion line chart showing week-over-week changes.
- **Stress Curve** — Anxiety, Sadness, Anger, Guilt confidence levels over sessions.
- **Emotional Intensity Heatmap** — Average severity by hour and day-of-week grid.
- **Category Radar** — Radar of average emotion confidence per BERT class.
- **Emotion Tide Chart** — Stacked emotion volume timeline by session date.
- **Severity Journey** — Session-by-session severity trend line.
- **Trigger Bubble Chart** — Most frequent stress triggers ranked by frequency.
- **Engagement Heatmap** — Message count by day × hour.
- **Session Depth** — Engagement depth score per session (avg. message length × vocabulary × completion).
- **Emotion Comparison Cards** — Week-over-week emotion delta comparison.
- **Coping Toolkit** — Frequency of coping strategies recommended across sessions.
- **Wellbeing Pulse History** — Longitudinal sparkline showing pulse score trend.

### 📧 Email Reports & Smart Notifications
- **Rich HTML Analytics Email**: On-demand email report with Wellbeing Pulse, session breakdown, top emotions, severity counts, SVG-based charts, and AI-generated insights — with a direct link to the Dashboard.
- **Weekly Emotional Summary**: Automated Sunday 9 AM report with similar data and a compassionate AI-generated reflection.
- **Inactivity Reminders**: Hourly check identifies users inactive for 24+ hours and sends caring nudge emails.
- **HMAC-Signed Unsubscribe**: Stateless one-click unsubscribe links in all marketing emails.

### 🔐 Secure Authentication
- **Email OTP Verification**: 6-digit code with 10-minute expiry sent via Resend on registration.
- **Password Strength Enforcement**: Min 8 chars, uppercase + lowercase + digit + special character.
- **Session Cookies**: Starlette `SessionMiddleware` with HTTP-only signed cookies.
- **Rate Limiting**: 60-second OTP resend cooldown.
- **Username Availability**: Real-time `/api/check-username` endpoint.

### 📓 Public Community Journal
- Write journal entries with optional anonymization.
- Read and draw strength from the public community feed.

### 📤 Data Export
- **CSV Export**: Download all session data (date, title, emotions, triggers, severity, depth score, status) as a CSV file.

---

## 🚦 How It Works

```
User enters message
      ↓
FastAPI backend intercepts input
      ↓
[Nepali Translation] → Translated to English via Groq (if not English)
      ↓
[Safety Check]: Does message contain crisis keywords?
      ├── YES ──► Set severity = "high" ──► Conclude Session ──► Stream Nepal Helplines & exit
      └── NO
            ↓
predict.py → BERT + BiLSTM + Attention calculates cumulative emotion confidence scores
            ↓
SSE event: "analysis" ──► Frontend renders emotion badges under message bubble
            ↓
suggestions.py → Groq extracts structured facts from user message
            ↓
suggestions.py → Groq generates adaptive empathetic response
            ↓
SSE event: "token" ──► Streaming text appears word-by-word
            ↓
SSE event: "done" ──► Final state committed to DB
```

---

## 🛠️ Setup & Execution

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL 14+

### 1. Backend Setup
1. Install Python packages:
   ```bash
   pip install -r requirements.txt
   ```
2. Configure `.env` (copy `.env.example` to `.env`):
   ```ini
   DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/solace_db
   SECRET_KEY=your-secure-session-signing-secret
   GROQ_API_KEY=gsk_your_groq_api_key_here
   RESEND_API_KEY=re_your_resend_api_key_here
   ```
3. Run Alembic migrations:
   ```bash
   alembic upgrade head
   ```
4. Start the backend:
   ```bash
   python app.py
   ```
   *(Runs at `http://localhost:8000`. Swagger docs at `/docs`)*

### 2. Frontend Setup
1. Move to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run dev
   ```
   *(Runs at `http://localhost:5173`. Proxies `/api/*` calls to backend on `:8000`)*

### 3. Manual Notification Testing
The background scheduler runs on production intervals (hourly inactivity check, weekly on Sunday). To trigger test emails manually in development:
```bash
# In the frontend directory
npm run trigger-notifications
```

---

## 🔒 Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ Yes | PostgreSQL async connection string (`postgresql+asyncpg://...`) |
| `GROQ_API_KEY` | ✅ Yes | Groq API key for Llama 3.3 70B inference and Nepali translation |
| `RESEND_API_KEY` | ✅ Yes | Resend transactional email API key (OTP, weekly reports, nudges) |
| `SECRET_KEY` | ✅ Yes | Secret key for signing cookies and generating HMAC unsubscribe tokens |

---

## 🆘 Critical Support Hotlines

If you or someone you know is in distress, please contact professional support:

- 🇳🇵 **National Suicide Prevention Helpline (Nepal)**: Call **1166** (Available 24/7)
- 🇳🇵 **Patan Hospital Mental Health Helpline**: Call **9840021212**
- 🇳🇵 **TPO Nepal Toll-Free line**: Call **1660-01-02005**
- 🌐 **International Resources**: Find local hotlines at [IASP Crisis Centres](https://www.iasp.info/resources/Crisis_Centres/)

> ⚠️ **Disclaimer**: Solace-AI is a mental wellness monitoring and support tool designed to encourage reflection. It is **not** a clinical tool or a replacement for professional therapy, counseling, or psychiatric services.

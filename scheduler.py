import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func, or_, and_
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from db.session import get_async_session_factory
from db.models import User, ChatSession
from email_service import send_inactivity_reminder, send_weekly_report
from suggestions import _client, GROQ_MODEL

logger = logging.getLogger("solace_scheduler")
logging.basicConfig(level=logging.INFO)

scheduler = AsyncIOScheduler()

async def generate_weekly_insights(display_name: str, session_count: int, emotion_counts: dict) -> str:
    """Use Groq to generate a compassionate summary/reflection for the weekly report."""
    client = _client()
    if not client:
        return "I hope you are taking care of yourself. Remember to check in whenever you need support."

    if session_count == 0:
        prompt = (
            f"You are Solace-AI, a compassionate mental health companion. "
            f"Write a gentle, warm, and supportive note to {display_name} who hasn't logged any chat sessions "
            f"on Solace-AI this week. Encourage them gently to check in on their feelings when they are ready. "
            f"Keep it under 3-4 sentences. Do not mention technical details. Use a warm, caring tone."
        )
    else:
        emotions_list = [f"{emotion} ({count} time{'s' if count > 1 else ''})" for emotion, count in emotion_counts.items()]
        emotions_str = ", ".join(emotions_list)
        prompt = (
            f"You are Solace-AI, a compassionate mental health companion. "
            f"Write a personalized, gentle weekly reflection for {display_name}. "
            f"This week, they completed {session_count} check-in sessions. "
            f"The emotions detected were: {emotions_str}. "
            f"Provide a brief, validating, and empathetic summary of their emotional week, highlighting patterns or offering "
            f"support. Keep it under 3-4 sentences. Do not mention technical details. Use a warm, caring tone."
        )

    try:
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=250,
            temperature=0.7,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Error generating weekly insights from Groq: {e}")
        return "I hope you are taking care of yourself. Remember to check in whenever you need support."


async def inactivity_checker_job():
    """Job A: Check for inactive users and send inactivity reminder emails."""
    logger.info("Starting inactivity checker job...")
    factory = get_async_session_factory()
    now = datetime.now(timezone.utc)
    
    # Inactivity threshold (24 hours)
    threshold = now - timedelta(hours=24)

    # Subquery for maximum updated_at per user
    stmt_latest_session = (
        select(ChatSession.user_id, func.max(ChatSession.updated_at).label("max_updated"))
        .group_by(ChatSession.user_id)
        .subquery()
    )

    async with factory() as db:
        # Query users who are verified, want notifications, have not received inactivity email in 24h,
        # and whose last session update is > 24h ago (or created > 24h ago with 0 sessions).
        query = (
            select(User)
            .outerjoin(stmt_latest_session, User.id == stmt_latest_session.c.user_id)
            .where(
                User.email.isnot(None),
                User.email_verified == True,
                User.wants_email_notifications == True,
                or_(
                    User.last_inactivity_email_at.is_(None),
                    User.last_inactivity_email_at < threshold
                ),
                or_(
                    stmt_latest_session.c.max_updated < threshold,
                    and_(
                        stmt_latest_session.c.max_updated.is_(None),
                        User.created_at < threshold
                    )
                )
            )
        )

        result = await db.execute(query)
        inactive_users = result.scalars().all()

        logger.info(f"Found {len(inactive_users)} inactive users to nudge.")

        for user in inactive_users:
            try:
                logger.info(f"Sending inactivity email to {user.email}...")
                send_inactivity_reminder(user.email, user.display_name)
                user.last_inactivity_email_at = now
                await db.commit()
            except Exception as e:
                logger.error(f"Failed to send inactivity email to {user.email}: {e}")
                await db.rollback()


async def weekly_reflection_job():
    """Job B: Sunday 9:00 AM weekly emotional report email."""
    logger.info("Starting weekly reflection report job...")
    factory = get_async_session_factory()
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    async with factory() as db:
        # Get all opted-in verified users
        query = (
            select(User)
            .where(
                User.email.isnot(None),
                User.email_verified == True,
                User.wants_email_notifications == True
            )
        )
        result = await db.execute(query)
        users = result.scalars().all()

        logger.info(f"Generating weekly reports for {len(users)} users.")

        for user in users:
            try:
                # Fetch all user's sessions (ordered by created_at asc)
                sessions_query = (
                    select(ChatSession)
                    .where(ChatSession.user_id == user.id)
                    .order_by(ChatSession.created_at.asc())
                )
                sessions_result = await db.execute(sessions_query)
                sessions = list(sessions_result.scalars().all())

                if not sessions:
                    logger.info(f"User {user.email} has no sessions. Skipping weekly report.")
                    continue

                # Filter weekly sessions for weekly insights and counts
                weekly_sessions = [
                    s for s in sessions 
                    if s.created_at and s.created_at >= seven_days_ago
                ]
                weekly_session_count = len(weekly_sessions)

                # Calculate weekly emotion counts
                weekly_emotion_counts = {}
                for s in weekly_sessions:
                    emo = s.final_category or "Neutral"
                    weekly_emotion_counts[emo] = weekly_emotion_counts.get(emo, 0) + 1

                # Calculate overall pulse score and trend (just like in api_email_report)
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

                total_sessions_count = len(sessions)
                engagement_score = min(100, total_sessions_count * 15)

                concluded_count = sum(1 for s in sessions if s.concluded)
                completion_rate = int((concluded_count / total_sessions_count) * 100) if total_sessions_count else 0

                all_emotions = set()
                for s in sessions:
                    if s.final_category:
                        all_emotions.add(s.final_category)
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

                # Severity counts
                severity_counts = {"high": 0, "medium": 0, "low": 0}
                for s in sessions:
                    sev = s.final_severity or "low"
                    sev_lower = sev.lower()
                    if sev_lower in severity_counts:
                        severity_counts[sev_lower] += 1

                # Emotion counts (overall or top emotions for the summary card)
                overall_emotion_counts = {}
                for s in sessions:
                    emo = s.final_category or "Neutral"
                    overall_emotion_counts[emo] = overall_emotion_counts.get(emo, 0) + 1

                # Generate weekly AI insights (using weekly sessions/emotions for relevance to the week)
                logger.info(f"Generating weekly insights for {user.email} with {weekly_session_count} weekly sessions...")
                insights = await generate_weekly_insights(user.display_name, weekly_session_count, weekly_emotion_counts)

                logger.info(f"Sending weekly report email to {user.email}...")
                send_weekly_report(
                    to_email=user.email,
                    display_name=user.display_name,
                    session_count=total_sessions_count,
                    concluded_count=concluded_count,
                    pulse_score=pulse_score,
                    pulse_trend=trend,
                    severity_counts=severity_counts,
                    emotion_counts=overall_emotion_counts,
                    insights=insights,
                    sessions=sessions
                )
            except Exception as e:
                logger.error(f"Failed to generate/send weekly report for {user.email}: {e}")


def start_scheduler():
    """Start the background scheduler."""
    if not scheduler.running:
        # Job A: Inactivity Checker (hourly)
        scheduler.add_job(
            inactivity_checker_job,
            trigger=IntervalTrigger(hours=1),
            id="inactivity_checker",
            replace_existing=True
        )
        # Job B: Weekly emotional report (Sunday at 9:00 AM)
        scheduler.add_job(
            weekly_reflection_job,
            trigger=CronTrigger(day_of_week="sun", hour=9, minute=0),
            id="weekly_reflection",
            replace_existing=True
        )
        scheduler.start()
        logger.info("APScheduler started successfully (Production Mode).")


def shutdown_scheduler():
    """Shutdown the background scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler shut down successfully.")

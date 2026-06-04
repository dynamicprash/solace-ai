import os
import hmac
import hashlib
import resend

# Initialize Resend
resend.api_key = os.environ.get("RESEND_API_KEY")
SECRET_KEY = os.environ.get("SECRET_KEY", "change-this-to-a-long-random-string")
BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")
SENDER = "Solace-AI <onboarding@resend.dev>"

def get_unsubscribe_link(email: str) -> str:
    """Generate a secure, stateless unsubscribe link using HMAC."""
    token = hmac.new(SECRET_KEY.encode(), email.encode(), hashlib.sha256).hexdigest()
    return f"{BASE_URL}/api/unsubscribe?email={email}&token={token}"

def send_verification_email(to_email: str, code: str) -> None:
    """Send a 6-digit OTP verification code during registration."""
    html_content = f"""
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #fdfcf9; border: 1px solid #e4e0d8; border-radius: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 48px;">🌿</span>
            <h1 style="color: #2e5133; margin: 10px 0 0 0; font-size: 28px;">Solace-AI</h1>
            <p style="color: #786e5c; font-style: italic; margin: 4px 0 0 0; font-size: 14px;">Your safe space to be heard</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #e4e0d8; margin: 24px 0;" />
        <div style="color: #4a4238; font-size: 16px; line-height: 1.6;">
            <p>Hello,</p>
            <p>Thank you for creating an account with Solace-AI. To complete your registration, please verify your email address using the 6-digit verification code below:</p>
            <div style="text-align: center; margin: 30px 0;">
                <span style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #2e5133; padding: 10px 20px; background-color: #f2f0ec; border-radius: 12px; border: 1px solid #cdc8bc;">{code}</span>
            </div>
            <p style="font-size: 14px; color: #786e5c;">This code will expire in 10 minutes. If you did not request this code, you can safely ignore this email.</p>
        </div>
    </div>
    """
    resend.Emails.send({
        "from": SENDER,
        "to": to_email,
        "subject": "Verify your email - Solace-AI",
        "html": html_content
    })

def send_inactivity_reminder(to_email: str, display_name: str) -> None:
    """Send a warm, caring inactivity nudge email."""
    unsub_link = get_unsubscribe_link(to_email)
    html_content = f"""
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #fdfcf9; border: 1px solid #e4e0d8; border-radius: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 48px;">🌿</span>
            <h1 style="color: #2e5133; margin: 10px 0 0 0; font-size: 28px;">Solace-AI</h1>
            <p style="color: #786e5c; font-style: italic; margin: 4px 0 0 0; font-size: 14px;">Your safe space to be heard</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #e4e0d8; margin: 24px 0;" />
        <div style="color: #4a4238; font-size: 16px; line-height: 1.6;">
            <p>Hi {display_name},</p>
            <p>We've been thinking of you. 💙</p>
            <p>We noticed you haven't checked in with Solace-AI in the past day. Remember, taking a few minutes to check in on how you're feeling can make a big difference.</p>
            <p>Whenever you're ready, we're here to listen and support you.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{BASE_URL}/chat" style="display: inline-block; padding: 12px 30px; background-color: #2e5133; color: white; text-decoration: none; font-weight: 500; border-radius: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Check in now</a>
            </div>
            <p style="font-size: 14px; color: #786e5c;">Take care,<br />The Solace-AI Team</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #e4e0d8; margin: 24px 0;" />
        <div style="text-align: center; font-size: 12px; color: #958c7a;">
            <p>You received this because you opted into Solace-AI check-ins.</p>
            <p><a href="{unsub_link}" style="color: #6a9e69; text-decoration: underline;">Unsubscribe from email notifications</a></p>
        </div>
    </div>
    """
    resend.Emails.send({
        "from": SENDER,
        "to": to_email,
        "subject": "Thinking of you - Solace-AI check-in",
        "html": html_content
    })

def get_val(s, key):
    if hasattr(s, key):
        return getattr(s, key)
    if isinstance(s, dict):
        return s.get(key)
    return None

def calculate_pulse_history(sessions: list) -> list[dict]:
    if not sessions:
        return []

    # Filter out sessions without created_at
    valid_sessions = []
    for s in sessions:
        created_at = get_val(s, "created_at")
        if created_at:
            valid_sessions.append(s)

    # Sort ascending by date
    def get_created_date(s):
        dt = get_val(s, "created_at")
        if isinstance(dt, str):
            try:
                from datetime import datetime
                return datetime.fromisoformat(dt)
            except Exception:
                return datetime.min
        return dt if dt else datetime.min

    from datetime import datetime
    valid_sessions.sort(key=get_created_date)

    # Group by ISO week
    sessions_by_week = {}
    for s in valid_sessions:
        dt = get_created_date(s)
        if not dt or dt == datetime.min:
            continue
        # Get ISO calendar year and week
        iso_year, iso_week, _ = dt.isocalendar()
        week_key = f"{iso_year}-W{iso_week:02d}"
        if week_key not in sessions_by_week:
            sessions_by_week[week_key] = []
        sessions_by_week[week_key].append(s)

    sorted_weeks = sorted(sessions_by_week.keys())
    history = []
    cumulative_sessions = []

    for week_key in sorted_weeks:
        cumulative_sessions.extend(sessions_by_week[week_key])

        # Compute pulse score
        SEV_MAP = { "low": 1, "medium": 2, "high": 3 }
        sev_scores = []
        for cs in cumulative_sessions:
            sev = get_val(cs, "final_severity")
            if sev and sev.lower() in SEV_MAP:
                sev_scores.append(SEV_MAP[sev.lower()])

        severity_trend_score = 0
        if len(sev_scores) >= 2:
            recent = sev_scores[-min(3, len(sev_scores)):]
            older = sev_scores[:max(1, len(sev_scores) - 3)]
            recent_avg = sum(recent) / len(recent)
            older_avg = sum(older) / len(older)
            severity_trend_score = max(0, min(100, int(100 - (recent_avg / 3) * 100 + 33)))
        elif len(sev_scores) == 1:
            severity_trend_score = max(0, min(100, int(100 - (sev_scores[0] / 3) * 100 + 33)))

        engagement_score = min(100, len(cumulative_sessions) * 15)

        concluded_count = sum(1 for cs in cumulative_sessions if get_val(cs, "concluded"))
        completion_rate = int((concluded_count / len(cumulative_sessions)) * 100) if cumulative_sessions else 0

        unique_emotions = set()
        for cs in cumulative_sessions:
            cat = get_val(cs, "final_category")
            if cat:
                unique_emotions.add(cat)
        emotion_diversity = min(100, len(unique_emotions) * 20)

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

        history.append({
            "week": week_key.split("-")[-1], # e.g. "W20"
            "score": pulse_score
        })

    return history

def generate_pulse_trend_svg(pulse_history: list[dict]) -> str:
    if not pulse_history or len(pulse_history) < 2:
        return ""
    
    width = 250
    height = 120
    padding_x = 25
    padding_y = 20
    chart_w = width - padding_x * 2
    chart_h = height - padding_y * 2
    
    n = len(pulse_history)
    points = []
    for i, item in enumerate(pulse_history):
        score = item["score"]
        x = padding_x + (i / (n - 1) * chart_w) if n > 1 else padding_x + chart_w / 2
        y = height - padding_y - (score / 100.0) * chart_h
        points.append((x, y, item["week"], score))
        
    path_str = f"M {points[0][0]:.1f} {points[0][1]:.1f}"
    for x, y, _, _ in points[1:]:
        path_str += f" L {x:.1f} {y:.1f}"
        
    area_path = path_str + f" L {points[-1][0]:.1f} {height - padding_y:.1f} L {points[0][0]:.1f} {height - padding_y:.1f} Z"
    
    markers = ""
    labels = ""
    for i, (x, y, week, score) in enumerate(points):
        show_label = (n <= 5) or (i % 2 == 0) or (i == n - 1)
        markers += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3" fill="#4D8050" stroke="#FFFFFF" stroke-width="1.5" />'
        if show_label:
            markers += f'<text x="{x:.1f}" y="{y - 6:.1f}" font-family="sans-serif" font-size="8" font-weight="bold" fill="#2E5133" text-anchor="middle">{score}</text>'
            labels += f'<text x="{x:.1f}" y="{height - 5:.1f}" font-family="sans-serif" font-size="8" font-weight="600" fill="#8F897E" text-anchor="middle">{week}</text>'
            
    svg = f"""
    <svg width="100%" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="pulse-area-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#4D8050" stop-opacity="0.2"/>
                <stop offset="100%" stop-color="#4D8050" stop-opacity="0.0"/>
            </linearGradient>
        </defs>
        <line x1="{padding_x}" y1="{padding_y:.1f}" x2="{width - padding_x}" y2="{padding_y:.1f}" stroke="#E6E3DD" stroke-dasharray="2,2" />
        <line x1="{padding_x}" y1="{(padding_y + chart_h * 0.5):.1f}" x2="{width - padding_x}" y2="{(padding_y + chart_h * 0.5):.1f}" stroke="#E6E3DD" stroke-dasharray="2,2" />
        <line x1="{padding_x}" y1="{height - padding_y:.1f}" x2="{width - padding_x}" y2="{height - padding_y:.1f}" stroke="#CDC8BC" stroke-width="1" />
        
        <path d="{area_path}" fill="url(#pulse-area-grad)" />
        <path d="{path_str}" fill="none" stroke="#4D8050" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        {markers}
        {labels}
    </svg>
    """
    return svg

def generate_weekly_activity_svg(weekly_counts: list[dict]) -> str:
    if not weekly_counts:
        return ""
        
    width = 250
    height = 120
    padding_x = 25
    padding_y = 20
    chart_w = width - padding_x * 2
    chart_h = height - padding_y * 2
    
    n = len(weekly_counts)
    bar_width = 16
    gap = (chart_w - (bar_width * n)) / (n - 1) if n > 1 else 0
    
    max_count = max(w["count"] for w in weekly_counts) if weekly_counts else 0
    scale_max = max(3, max_count)
        
    bars_html = ""
    labels_html = ""
    for i, item in enumerate(weekly_counts):
        count = item["count"]
        try:
            from datetime import date
            day_dt = date.fromisoformat(item["day"])
            day_name = day_dt.strftime("%a")
        except Exception:
            day_name = item["day"]
            if len(day_name) > 3:
                day_name = day_name[:3]
            
        x = padding_x + i * (bar_width + gap)
        bar_h = (count / scale_max) * chart_h
        y = height - padding_y - bar_h
        
        if count > 0:
            bars_html += f"""
            <rect x="{x:.1f}" y="{y:.1f}" width="{bar_width}" height="{bar_h:.1f}" rx="3" fill="#4D8050" />
            <text x="{x + bar_width/2:.1f}" y="{y - 4:.1f}" font-family="sans-serif" font-size="8" font-weight="bold" fill="#2E5133" text-anchor="middle">{count}</text>
            """
        else:
            bars_html += f"""
            <rect x="{x:.1f}" y="{height - padding_y - 2:.1f}" width="{bar_width}" height="2" rx="1" fill="#E6E3DD" />
            """
            
        labels_html += f"""
        <text x="{x + bar_width/2:.1f}" y="{height - 5:.1f}" font-family="sans-serif" font-size="8" font-weight="600" fill="#8F897E" text-anchor="middle">{day_name}</text>
        """
        
    svg = f"""
    <svg width="100%" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
        <line x1="{padding_x}" y1="{height - padding_y:.1f}" x2="{width - padding_x}" y2="{height - padding_y:.1f}" stroke="#CDC8BC" stroke-width="1" />
        {bars_html}
        {labels_html}
    </svg>
    """
    return svg

def _render_wellness_report_html(
    display_name: str,
    title: str,
    subtitle: str,
    pulse_score: int,
    pulse_trend: str,
    session_count: int,
    concluded_count: int,
    severity_counts: dict,
    emotion_counts: list | dict,
    insights: str,
    unsub_link: str,
    sessions: list = None
) -> str:
    """Generate a highly polished responsive HTML email template for wellness reports."""
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    
    # Trend colors and styling
    trend_clean = pulse_trend.lower().strip()
    if trend_clean == "improving":
        trend_bg = "#ECFDF5"
        trend_color = "#059669"
        trend_icon = "▲"
    elif trend_clean == "stable":
        trend_bg = "#FEF9C3"
        trend_color = "#CA8A04"
        trend_icon = "●"
    elif trend_clean == "declining":
        trend_bg = "#FEF2F2"
        trend_color = "#DC2626"
        trend_icon = "▼"
    else:
        trend_bg = "#F3F4F6"
        trend_color = "#4B5563"
        trend_icon = "●"

    # Completion rate
    completion_rate = int((concluded_count / session_count) * 100) if session_count else 0

    # Severity counts
    high_count = severity_counts.get("high", 0)
    medium_count = severity_counts.get("medium", 0)
    low_count = severity_counts.get("low", 0)

    # Convert list of tuples to dict if needed
    if isinstance(emotion_counts, list):
        emotion_counts = {k: v for k, v in emotion_counts}

    # Render emotion horizontal bars (compliant HTML/CSS table layout)
    emotions_bars_html = ""
    if emotion_counts:
        sorted_emotions = sorted(emotion_counts.items(), key=lambda x: -x[1])
        
        emotion_colors = {
            "joy": "#10B981",      # emerald
            "sadness": "#3B82F6",  # blue
            "anger": "#EF4444",    # red
            "fear": "#8B5CF6",     # purple
            "surprise": "#F59E0B", # amber
            "disgust": "#84CC16",  # lime
            "neutral": "#94A3B8"   # slate grey
        }

        max_count = max(emotion_counts.values()) if emotion_counts.values() else 1

        for emo, count in sorted_emotions[:5]:  # Top 5 emotions
            percentage = int((count / max_count) * 100) if max_count else 0
            color = emotion_colors.get(emo.lower().strip(), "#8F897E")
            
            emotions_bars_html += f"""
            <table style="width: 100%; margin-bottom: 12px;" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="width: 100px; font-size: 14px; font-weight: 600; color: #4A453E; text-transform: capitalize; font-family: sans-serif;">{emo}</td>
                    <td style="padding: 0 10px;">
                        <table style="width: 100%; background-color: #EAE8E2; border-radius: 6px; overflow: hidden; height: 10px;" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="width: {percentage}%; background-color: {color}; border-radius: 6px; height: 10px;"></td>
                                <td style="width: {100 - percentage}%; height: 10px;"></td>
                            </tr>
                        </table>
                    </td>
                    <td style="width: 80px; font-size: 13px; text-align: right; color: #8F897E; font-weight: 600; padding-left: 10px; font-family: sans-serif;">{count} check-in{"s" if count > 1 else ""}</td>
                </tr>
            </table>
            """
    else:
        emotions_bars_html = "<div style='color: #7A746B; font-style: italic; font-size: 14px; text-align: center; padding: 10px 0; font-family: sans-serif;'>No emotions logged this week.</div>"

    # SVG Charts Generation
    pulse_trend_svg = ""
    weekly_activity_svg = ""
    timeline_html = ""
    
    if sessions:
        pulse_history = calculate_pulse_history(sessions)
        pulse_trend_svg = generate_pulse_trend_svg(pulse_history)
        
        # Weekly check-ins per day
        from datetime import datetime, timedelta, timezone
        now = datetime.now(timezone.utc)
        weekly_counts = []
        for i in range(6, -1, -1):
            day_date = (now - timedelta(days=i)).date()
            count = 0
            for s in sessions:
                created_at = get_val(s, "created_at")
                if created_at:
                    if isinstance(created_at, str):
                        try:
                            created_date = datetime.fromisoformat(created_at).date()
                        except Exception:
                            continue
                    else:
                        created_date = created_at.date()
                    if created_date == day_date:
                        count += 1
            weekly_counts.append({"day": day_date.isoformat(), "count": count})
        
        weekly_activity_svg = generate_weekly_activity_svg(weekly_counts)
        
        # Recent reflections timeline
        valid_sessions = []
        for s in sessions:
            created_at = get_val(s, "created_at")
            if created_at:
                valid_sessions.append(s)
        
        def get_created_date(s):
            dt = get_val(s, "created_at")
            if isinstance(dt, str):
                try:
                    return datetime.fromisoformat(dt)
                except Exception:
                    return datetime.min
            return dt if dt else datetime.min
            
        valid_sessions.sort(key=get_created_date, reverse=True)
        recent_sessions = valid_sessions[:5]
        
        if recent_sessions:
            timeline_html += '<div style="margin-top: 30px; border-top: 1px solid #E6E3DD; padding-top: 24px;">'
            timeline_html += '  <h3 style="color: #2E5133; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 0; margin-bottom: 16px; font-family: sans-serif;">Recent Reflections</h3>'
            timeline_html += '  <div style="position: relative;">'
            
            for idx, s in enumerate(recent_sessions):
                title_text = get_val(s, "title") or "Check-in Session"
                created_at_val = get_created_date(s)
                date_str = created_at_val.strftime("%b %d, %Y • %I:%M %p") if created_at_val != datetime.min else "Recent"
                severity = get_val(s, "final_severity") or "low"
                category = get_val(s, "final_category") or "Neutral"
                
                # Style badge for severity
                sev_color_bg = "#ECFDF5"
                sev_color_text = "#059669"
                if severity.lower() == "high":
                     sev_color_bg = "#FEF2F2"
                     sev_color_text = "#DC2626"
                elif severity.lower() == "medium":
                     sev_color_bg = "#FEF9C3"
                     sev_color_text = "#CA8A04"
                     
                emotion_colors = {
                     "joy": {"bg": "#ECFDF5", "text": "#10B981"},
                     "sadness": {"bg": "#EFF6FF", "text": "#3B82F6"},
                     "anger": {"bg": "#FEF2F2", "text": "#EF4444"},
                     "fear": {"bg": "#F5F3FF", "text": "#8B5CF6"},
                     "surprise": {"bg": "#FFFBEB", "text": "#F59E0B"},
                     "disgust": {"bg": "#F7FEE7", "text": "#84CC16"},
                     "neutral": {"bg": "#F8FAFC", "text": "#64748B"}
                }
                cat_style = emotion_colors.get(category.lower().strip(), {"bg": "#F2F0EC", "text": "#786E5C"})
                
                timeline_html += f"""
                <table style="width: 100%; margin-bottom: 16px;" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="width: 16px; vertical-align: top; text-align: center;">
                            <div style="width: 10px; height: 10px; border-radius: 5px; background-color: #4D8050; border: 2px solid #FFFFFF; margin-top: 14px;"></div>
                        </td>
                        <td style="padding-left: 12px;">
                            <div style="background-color: #FAF9F6; border: 1px solid #E6E3DD; border-radius: 12px; padding: 14px 16px;">
                                <table style="width: 100%;" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td>
                                            <h4 style="margin: 0; font-size: 14.5px; font-weight: 700; color: #2E5133; font-family: sans-serif;">{title_text}</h4>
                                            <span style="font-size: 11px; color: #8F897E; font-weight: 500; display: block; margin-top: 4px; font-family: sans-serif;">{date_str}</span>
                                        </td>
                                        <td style="text-align: right; vertical-align: top; white-space: nowrap;">
                                            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 12px; background-color: {sev_color_bg}; color: {sev_color_text}; border: 1px solid {sev_color_text}22; font-family: sans-serif; margin-right: 4px;">
                                                {severity}
                                            </span>
                                            <span style="font-size: 10px; font-weight: 700; text-transform: capitalize; padding: 3px 8px; border-radius: 12px; background-color: {cat_style['bg']}; color: {cat_style['text']}; border: 1px solid {cat_style['text']}22; font-family: sans-serif;">
                                                {category}
                                            </span>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                        </td>
                    </tr>
                </table>
                """
            timeline_html += '  </div>'
            timeline_html += '</div>'

    charts_section = ""
    if pulse_trend_svg or weekly_activity_svg:
        charts_section += f"""
        <div style="margin: 28px 0;">
            <table style="width: 100%; border-collapse: collapse;" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="width: 48%; vertical-align: top; background-color: #FAF9F6; border: 1px solid #E6E3DD; border-radius: 20px; padding: 18px; text-align: center;">
                        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #8F897E; display: block; margin-bottom: 12px; letter-spacing: 0.5px; font-family: sans-serif;">Pulse History (By Week)</span>
                        {pulse_trend_svg if pulse_trend_svg else '<div style="color:#8F897E; font-size:12px; padding:40px 0; font-family:sans-serif;">Add more weekly logs to view trend</div>'}
                    </td>
                    <td style="width: 4%;"></td>
                    <td style="width: 48%; vertical-align: top; background-color: #FAF9F6; border: 1px solid #E6E3DD; border-radius: 20px; padding: 18px; text-align: center;">
                        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #8F897E; display: block; margin-bottom: 12px; letter-spacing: 0.5px; font-family: sans-serif;">Check-ins (Last 7 Days)</span>
                        {weekly_activity_svg}
                    </td>
                </tr>
            </table>
        </div>
        """

    return f"""
    <div style="background-color: #FAF8F5; padding: 40px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-top: 6px solid #4D8050; border-radius: 24px; padding: 40px 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.03); border-left: 1px solid #E6E3DD; border-right: 1px solid #E6E3DD; border-bottom: 1px solid #E6E3DD;">
            <!-- Header Logo -->
            <div style="text-align: center; margin-bottom: 30px;">
                <span style="font-size: 40px; display: block; margin-bottom: 6px;">🌿</span>
                <h1 style="color: #2E5133; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; font-family: sans-serif;">Solace AI</h1>
                <p style="color: #8F897E; margin: 4px 0 0 0; font-size: 13px; font-style: italic; font-family: sans-serif;">Your safe space to be heard</p>
            </div>
            
            <div style="text-align: center; margin-bottom: 32px;">
                <h2 style="color: #2E5133; font-size: 26px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.5px; font-family: sans-serif;">{title}</h2>
                <p style="color: #7A746B; margin: 0; font-size: 14px; font-weight: 500; font-family: sans-serif;">{subtitle}</p>
            </div>

            <div style="color: #4A453E; font-size: 15px; line-height: 1.6; font-family: sans-serif;">
                <p style="margin-top: 0; margin-bottom: 20px;">Hi <strong>{display_name}</strong>,</p>
                <p style="margin-bottom: 24px;">Here is your Solace-AI wellness recap, detailing your emotional check-ins, analytics, and personalized guidance.</p>
                
                <!-- Pulse Hero Card -->
                <div style="background-color: #F6F5F2; border: 1px solid #E6E3DD; border-radius: 20px; padding: 24px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #7A746B; display: block; margin-bottom: 6px;">Your Weekly Wellbeing Pulse</span>
                    <div style="font-size: 56px; font-weight: 800; color: #2E5133; margin: 0; line-height: 1;">
                        {pulse_score} <span style="font-size: 20px; color: #9A958C; font-weight: 500;">/ 100</span>
                    </div>
                    <div style="margin-top: 14px;">
                        <span style="display: inline-block; padding: 6px 14px; border-radius: 30px; background-color: {trend_bg}; color: {trend_color}; font-size: 13px; font-weight: 700; text-transform: capitalize;">
                            {trend_icon} {pulse_trend} trend
                        </span>
                    </div>
                </div>

                <!-- Stats Tables -->
                <table style="width: 100%; border-collapse: collapse; margin: 24px 0;" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="width: 48%; background-color: #FAF9F6; border: 1px solid #E6E3DD; border-radius: 16px; padding: 18px; text-align: left; vertical-align: top;">
                            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #8F897E; display: block; margin-bottom: 6px; letter-spacing: 0.5px;">Check-ins Done</span>
                            <span style="font-size: 24px; font-weight: 800; color: #2E5133; display: block;">{session_count} <span style="font-size: 14px; font-weight: 500; color: #8F897E;">sessions</span></span>
                            <span style="font-size: 12px; color: #7A746B; display: block; margin-top: 4px;">{concluded_count} completed ({completion_rate}%)</span>
                        </td>
                        <td style="width: 4%;"></td>
                        <td style="width: 48%; background-color: #FAF9F6; border: 1px solid #E6E3DD; border-radius: 16px; padding: 18px; text-align: left; vertical-align: top;">
                            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #8F897E; display: block; margin-bottom: 6px; letter-spacing: 0.5px;">Severity Levels</span>
                            <span style="font-size: 13px; color: #4A453E; display: block; margin: 2px 0;"><span style="color: #EF4444; font-weight: bold; margin-right: 4px;">●</span> High: <strong>{high_count}</strong></span>
                            <span style="font-size: 13px; color: #4A453E; display: block; margin: 2px 0;"><span style="color: #F59E0B; font-weight: bold; margin-right: 4px;">●</span> Medium: <strong>{medium_count}</strong></span>
                            <span style="font-size: 13px; color: #4A453E; display: block; margin: 2px 0;"><span style="color: #10B981; font-weight: bold; margin-right: 4px;">●</span> Low: <strong>{low_count}</strong></span>
                        </td>
                    </tr>
                </table>

                <!-- SVG Charts Section -->
                {charts_section}

                <!-- Emotion Distribution Card -->
                <div style="background-color: #FAF9F6; border: 1px solid #E6E3DD; border-radius: 16px; padding: 20px; margin: 24px 0;">
                    <h4 style="color: #2E5133; margin-top: 0; margin-bottom: 16px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Logged Emotion Frequencies</h4>
                    {emotions_bars_html}
                </div>

                <!-- Guidance Box -->
                <div style="background-color: #EAF0EC; border-left: 4px solid #4D8050; border-radius: 12px; padding: 22px; margin: 24px 0;">
                    <h3 style="color: #2E5133; margin-top: 0; margin-bottom: 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">🌿 Empathetic Guidance</h3>
                    <p style="margin: 0; font-style: italic; color: #2E5133; font-size: 14.5px; line-height: 1.7; font-family: Georgia, serif;">
                        "{insights}"
                    </p>
                </div>

                <!-- Recent Reflections Timeline -->
                {timeline_html}

                <!-- CTA Button -->
                <div style="text-align: center; margin: 36px 0 20px 0;">
                    <a href="{frontend_url}/dashboard" target="_blank" style="display: inline-block; padding: 14px 30px; background-color: #2E5133; color: #FFFFFF; text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 30px; box-shadow: 0 4px 12px rgba(46,81,51,0.15); font-family: sans-serif;">
                        Explore Interactive Dashboard →
                    </a>
                </div>
                
                <p style="margin-top: 24px; margin-bottom: 0; font-size: 14px;">We are glad you are taking these active steps to monitor your emotional wellness. Remember to take things one breath at a time.</p>
            </div>
            
            <!-- Footer Signature -->
            <div style="margin-top: 36px; padding-top: 24px; border-top: 1px solid #E6E3DD; color: #7A746B; font-size: 14px; font-family: sans-serif;">
                Warmly,<br />
                <strong>The Solace-AI Team</strong>
            </div>
        </div>

        <!-- Unsubscribe Footer -->
        <div style="text-align: center; margin-top: 30px; font-size: 11px; color: #8F897E; line-height: 1.5; max-width: 600px; margin-left: auto; margin-right: auto; padding: 0 10px; font-family: sans-serif;">
            <p>You received this because you opted into Solace-AI weekly reports.</p>
            <p><a href="{unsub_link}" target="_blank" style="color: #4D8050; text-decoration: underline; font-weight: 600;">Unsubscribe from email notifications</a></p>
        </div>
    </div>
    """


def send_weekly_report(
    to_email: str,
    display_name: str,
    session_count: int,
    concluded_count: int,
    pulse_score: int,
    pulse_trend: str,
    severity_counts: dict,
    emotion_counts: dict,
    insights: str,
    sessions: list = None
) -> None:
    """Send a structured weekly emotional summary report with rich visual elements."""
    unsub_link = get_unsubscribe_link(to_email)
    html_content = _render_wellness_report_html(
        display_name=display_name,
        title="Weekly Reflection",
        subtitle="Your Solace-AI emotional recap",
        pulse_score=pulse_score,
        pulse_trend=pulse_trend,
        session_count=session_count,
        concluded_count=concluded_count,
        severity_counts=severity_counts,
        emotion_counts=emotion_counts,
        insights=insights,
        unsub_link=unsub_link,
        sessions=sessions
    )
    resend.Emails.send({
        "from": SENDER,
        "to": to_email,
        "subject": "Your Solace-AI Weekly Reflection",
        "html": html_content
    })


def send_analytics_report(
    to_email: str,
    display_name: str,
    pulse_score: int,
    pulse_trend: str,
    session_count: int,
    concluded_count: int,
    severity_counts: dict,
    top_emotions: list | dict,
    insights: str,
    sessions: list = None
) -> None:
    """Send a beautifully styled dashboard analytics report with detailed metrics."""
    unsub_link = get_unsubscribe_link(to_email)
    html_content = _render_wellness_report_html(
        display_name=display_name,
        title="Wellness Analytics Report",
        subtitle="Your mental health journey details",
        pulse_score=pulse_score,
        pulse_trend=pulse_trend,
        session_count=session_count,
        concluded_count=concluded_count,
        severity_counts=severity_counts,
        emotion_counts=top_emotions,
        insights=insights,
        unsub_link=unsub_link,
        sessions=sessions
    )
    resend.Emails.send({
        "from": SENDER,
        "to": to_email,
        "subject": "Your Solace-AI Wellness Analytics Report",
        "html": html_content
    })

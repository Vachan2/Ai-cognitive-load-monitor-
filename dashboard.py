"""
dashboard.py — Streamlit cognitive load dashboard.

Reads the most recent session CSV from the sessions/ folder and
displays live-updating charts and metrics.

Run with:
    streamlit run dashboard.py

The dashboard auto-refreshes every 2 seconds while a session is active.
"""

import streamlit as st
import pandas as pd
import os
import glob
import time

# ─── Page config ─────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Cognitive Load Monitor",
    page_icon="🧠",
    layout="wide",
)

st.title("🧠 Developer Cognitive Load Monitor")
st.caption("Real-time eye tracking dashboard — powered by MediaPipe + OpenCV")

SESSIONS_DIR = "sessions"


def get_latest_session() -> str | None:
    """Return path to the most recently modified session CSV."""
    files = glob.glob(os.path.join(SESSIONS_DIR, "session_*.csv"))
    if not files:
        return None
    return max(files, key=os.path.getmtime)


def load_session(path: str) -> pd.DataFrame:
    """Load and parse a session CSV."""
    df = pd.read_csv(path, parse_dates=["timestamp"])
    return df


# ─── Sidebar ─────────────────────────────────────────────────────────────────
st.sidebar.header("Session")

session_files = sorted(
    glob.glob(os.path.join(SESSIONS_DIR, "session_*.csv")), reverse=True
)

if not session_files:
    st.warning("No session data found. Run `python3 webcam_test.py` first.")
    st.stop()

selected = st.sidebar.selectbox(
    "Select session",
    options=session_files,
    format_func=lambda p: os.path.basename(p),
)

auto_refresh = st.sidebar.toggle("Auto-refresh (live session)", value=True)
refresh_interval = st.sidebar.slider("Refresh interval (sec)", 1, 10, 2)

# ─── Load data ───────────────────────────────────────────────────────────────
df = load_session(selected)

if df.empty:
    st.info("Session file is empty — waiting for data...")
    if auto_refresh:
        time.sleep(refresh_interval)
        st.rerun()
    st.stop()

# ─── Summary metrics (top row) ───────────────────────────────────────────────
st.subheader("Session Summary")

col1, col2, col3, col4, col5 = st.columns(5)

col1.metric("Total Blinks", int(df["blink_count"].iloc[-1]))
col2.metric("Avg Blink Rate", f"{df['blink_rate'].mean():.1f} /min")
col3.metric("Avg EAR", f"{df['ear'].mean():.3f}")
col4.metric("Drowsy Events", int(df["drowsy"].sum()))

# Cognitive level distribution
level_counts = df["cognitive_level"].value_counts()
dominant = level_counts.index[0] if not level_counts.empty else "N/A"
col5.metric("Dominant Load Level", dominant)

st.divider()

# ─── Charts ──────────────────────────────────────────────────────────────────
col_left, col_right = st.columns(2)

with col_left:
    st.subheader("Blink Rate Over Time")
    st.line_chart(
        df.set_index("elapsed_sec")["blink_rate"],
        use_container_width=True,
        color="#00cc88",
    )

    st.subheader("EAR Over Time")
    st.line_chart(
        df.set_index("elapsed_sec")["ear"],
        use_container_width=True,
        color="#4488ff",
    )

with col_right:
    st.subheader("Cognitive Load Score Over Time")
    st.line_chart(
        df.set_index("elapsed_sec")["cognitive_score"],
        use_container_width=True,
        color="#ff6644",
    )

    st.subheader("Cognitive Load Level Distribution")
    level_df = df["cognitive_level"].value_counts().reset_index()
    level_df.columns = ["Level", "Count"]
    st.bar_chart(level_df.set_index("Level"), use_container_width=True)

# ─── Eye closure events ──────────────────────────────────────────────────────
st.subheader("Eye Closure Duration Over Time")
st.area_chart(
    df.set_index("elapsed_sec")["closure_duration"],
    use_container_width=True,
    color="#ffaa00",
)

# ─── Raw data table ──────────────────────────────────────────────────────────
with st.expander("Raw session data"):
    st.dataframe(df, use_container_width=True)

# ─── Auto-refresh ────────────────────────────────────────────────────────────
if auto_refresh:
    time.sleep(refresh_interval)
    st.rerun()

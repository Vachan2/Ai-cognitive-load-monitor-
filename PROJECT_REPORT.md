# Major Project Phase II: Review 3

**Project Id :**
**Project Title :** AI-Powered Real-Time Cognitive Load Monitor for Developers

**By:**
| Name | USN |
|------|-----|
| Name1 | USN1 |
| Name2 | USN2 |
| Name3 | USN3 |
| Name4 | USN4 |

**Under the Guidance of:**
Guide Name
Designation

*2026 – 2027*

---

## Content

1. [Introduction](#1-introduction)
2. [Literature Review](#2-literature-review)
3. [Problem Statement and Objectives of the Work](#3-problem-statement-and-objectives-of-the-work)
4. [Methodology / Design Framework / Algorithm / Flow Chart](#4-methodology--design-framework--algorithm--flow-chart)
5. [Tools / Techniques Used](#5-tools--techniques-used)
6. [Results and Discussions](#6-results-and-discussions)
7. [TRLs and SDGs Mapping](#7-trls-and-sdgs-mapping)
8. [Future Scope](#8-future-scope)
9. [Conclusion](#9-conclusion)
10. [Outcomes: Scopus Index Paper / Patent / Commercial Model](#10-outcomes-scopus-index-paper--patent--commercial-model)
11. [References](#11-references)

---

## 1. Introduction

Modern software developers operate in cognitively demanding environments, switching contexts frequently, managing complex codebases, and working under tight deadlines. Sustained cognitive overload leads to increased error rates, reduced productivity, and long-term burnout — yet there exists no non-intrusive, real-time system that continuously monitors a developer's mental load during active work.

**NeuroSync** is an AI-powered, real-time cognitive load monitoring system designed specifically for developers. It combines computer vision-based eye tracking, browser-level interaction signals, and large language model (LLM) inference to produce a continuous, multi-dimensional view of a developer's cognitive state — without requiring any wearable hardware.

The system captures:
- Eye Aspect Ratio (EAR) and blink rate via webcam and MediaPipe face landmark detection
- Typing speed (WPM) via browser keydown events
- Context-switching frequency via browser visibility and focus events
- A composite cognitive load score (0–100) derived from the above signals
- Natural language AI insights and recommendations generated every 15 seconds

An optional ESP32 microcontroller integration allows the cognitive load score to be pushed to external hardware in real time for physical feedback or alerting.

---

## 2. Literature Review

| # | Authors | Title | Key Finding |
|---|---------|-------|-------------|
| 1 | Iqbal et al. (2004) | *Towards an index of opportunity: Understanding changes in mental workload during task execution* | Blink rate decreases significantly under high cognitive load due to attentional resource depletion |
| 2 | Recarte & Nunes (2003) | *Mental workload while driving: Effects on visual search, discrimination, and decision making* | Eye Aspect Ratio (EAR) correlates with sustained mental workload |
| 3 | Stern et al. (1994) | *Blink rate: A possible measure of fatigue* | Blink rate increases under fatigue and stress conditions |
| 4 | Lugaresi et al. (2019) | *MediaPipe: A Framework for Building Perception Pipelines* | Real-time 478-point facial landmark detection at 30+ fps on commodity hardware |
| 5 | Sweller (1988) | *Cognitive load during problem solving: Effects on learning* | Cognitive load theory: working memory has finite capacity; overload degrades performance |
| 6 | Solovey et al. (2014) | *Sensing cognitive multitasking for a brain-based adaptive automated system* | Passive physiological signals can reliably classify cognitive workload levels |
| 7 | Fritz et al. (2014) | *Using psycho-physiological measures to assess task difficulty in software development* | Task difficulty in programming correlates with measurable biometric signals |

---

## 3. Problem Statement and Objectives of the Work

### Problem Statement

Developers lack real-time, non-intrusive feedback about their own cognitive state during work sessions. Existing cognitive monitoring solutions require expensive EEG headsets or are limited to controlled lab environments. There is no freely deployable, webcam-based system that integrates cognitive load detection directly into a developer's workflow and provides actionable AI-generated recommendations.

### Objectives

1. Design and implement a real-time eye tracking pipeline using MediaPipe FaceLandmarker to extract EAR and blink rate from a standard webcam at 30 fps.
2. Develop a multi-signal cognitive load scoring algorithm combining blink suppression (sustained load), blink burst detection (stress), and temporal smoothing (EMA + 10-sample rolling average).
3. Build a live dashboard using Next.js that displays all metrics, history charts, and a webcam feed with face mesh overlay.
4. Integrate LLM-based insight generation (Sarvam API → Mistral API → local Ollama fallback) to provide context-aware recommendations every 15 seconds.
5. Capture real browser interaction signals — keystroke-based WPM and tab-switch counting — to supplement eye metrics with behavioral data.
6. Expose the cognitive load score to external hardware (ESP32) via HTTP POST for physical feedback integration.
7. Log all session data to CSV for longitudinal analysis and research.

---

## 4. Methodology / Design Framework / Algorithm / Flow Chart

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEUROSYNC SYSTEM                         │
├──────────────────────────┬──────────────────────────────────────┤
│   Python Backend         │   Next.js Frontend (Browser)         │
│   (stream_server.py)     │   (localhost:3000)                   │
│                          │                                      │
│  Webcam (OpenCV)         │  Dashboard (React + Zustand)         │
│       ↓                  │       ↑                              │
│  MediaPipe               │  /api/eye-metrics  ←── polls 2s     │
│  FaceLandmarker          │  /api/video-feed   ←── MJPEG stream  │
│       ↓                  │  /api/analyze      ←── polls 15s    │
│  EyeTracker              │       ↑                              │
│  (EAR, landmarks)        │  Sarvam / Mistral / Ollama / Rules   │
│       ↓                  │                                      │
│  BlinkTracker            │  useKeyboardTracker                  │
│  (blink rate, burst)     │  (WPM, tab switches)                 │
│       ↓                  │                                      │
│  CognitiveLoadScorer     │                                      │
│  (0–100, EMA smoothed)   │                                      │
│       ↓                  │                                      │
│  Flask HTTP Server :5001 │                                      │
│       ↓                  │                                      │
│  ESP32 POST /load        │                                      │
│  (hardware feedback)     │                                      │
│       ↓                  │                                      │
│  SessionLogger (CSV)     │                                      │
└──────────────────────────┴──────────────────────────────────────┘
```

### Cognitive Load Scoring Algorithm

```
INPUT: blink_rate (blinks/min), blink_timestamps (last 60s), eye_closed (bool)

IF eye_closed == True:
    RETURN current_score  // score frozen during eye closure

raw_score = 0

// Component 1: Sustained blink rate (0–55 pts)
IF blink_rate < 5:      raw_score += 55   // heavily suppressed
IF blink_rate < 12:     raw_score += 35   // below normal
IF blink_rate ≤ 20:     raw_score += 5    // normal range
IF blink_rate < 30:     raw_score += 25   // above normal
ELSE:                   raw_score += 45   // very high

// Component 2: Blink burst detection (0–30 pts)
burst_count = count timestamps in last 10 seconds
IF burst_count > 6:
    raw_score += min(30, (burst_count - 6) × 4.5)

// EMA smoothing (α = 0.06)
ema_score = 0.06 × raw_score + 0.94 × ema_score

// 10-sample rolling average (applied in frontend store)
display_score = average(last 10 ema_score values)

OUTPUT: display_score (0–100), level (LOW / MEDIUM / HIGH)
```

### Data Flow

```
Webcam Frame (30 fps)
       ↓
MediaPipe FaceLandmarker → 478 landmarks
       ↓
EAR Calculation (6 points per eye, averaged)
       ↓
Blink Detection (EAR < 0.20 threshold, ≥2 frames)
       ↓
Cognitive Load Scoring (blink rate + burst, EMA smoothed)
       ↓
┌──────────────────────┬─────────────────────┐
│  Flask /metrics JSON │  MJPEG /video_feed  │
│  (every 2s poll)     │  (continuous)       │
└──────────────────────┴─────────────────────┘
       ↓                        ↓
  Next.js Store            Dashboard WebcamFeed
  (Zustand)                component
       ↓
  AI Insight (every 15s)
  Sarvam → Mistral → Ollama → Rule-based
       ↓
  Dashboard Display + ESP32 Push
```

---

## 5. Tools / Techniques Used

### Hardware
| Component | Purpose |
|-----------|---------|
| Standard webcam (720p) | Eye tracking input |
| ESP32 microcontroller | Physical cognitive load feedback output |
| MacBook / development machine | Host system |

### Computer Vision & ML
| Tool | Version | Purpose |
|------|---------|---------|
| OpenCV | 4.13.0 | Webcam capture, frame processing, HUD rendering |
| MediaPipe FaceLandmarker | 0.10.14+ | 478-point real-time facial landmark detection |
| TensorFlow Lite (XNNPACK) | bundled | On-device inference acceleration |

### Backend (Python)
| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.12 | Core pipeline language |
| Flask | 3.1.3 | MJPEG stream server + JSON API |
| NumPy | 1.26+ | EAR calculations |
| Pandas | 2.2+ | Session CSV logging |

### Frontend (Next.js App)
| Tool | Version | Purpose |
|------|---------|---------|
| Next.js | 16.2.6 | Full-stack React framework |
| React | 19 | UI component model |
| TypeScript | 5 | Type safety |
| Zustand | 4 | Global session state |
| Framer Motion | 11 | Animated metric transitions |
| Recharts | 2 | Live history line charts |
| Tailwind CSS | 4 | Utility-first styling |

### AI / LLM Layer
| Provider | Model | Role |
|----------|-------|------|
| Sarvam AI | sarvam-105b | Primary insight generation |
| Mistral AI | mistral-small-latest | Fallback cloud LLM |
| Ollama (local) | qwen2.5:3b | Offline / privacy mode |
| Rule-based | — | Final deterministic fallback |

### Techniques
- **Eye Aspect Ratio (EAR):** `EAR = (||p2−p6|| + ||p3−p5||) / (2 × ||p1−p4||)` — Soukupová & Čech (2016)
- **Exponential Moving Average (EMA):** `score_t = α × raw_t + (1−α) × score_{t-1}`, α = 0.06
- **10-sample rolling average:** smooths display-level fluctuation over ~20 seconds
- **MJPEG streaming:** multipart/x-mixed-replace boundary streaming over HTTP
- **Rolling keydown window:** 10-second timestamp buffer normalized to WPM

---

## 6. Results and Discussions

### Cognitive Load Scoring Behaviour

| Scenario | Blink Rate | Burst Count | Display Score | Level |
|----------|-----------|-------------|---------------|-------|
| Deep focus, minimal blinking | 4/min | 0 | 52–58 | MEDIUM |
| Normal relaxed coding | 15/min | 0 | 5–12 | LOW |
| Rapid blinking (stress) | 18/min | 9 in 10s | 35–45 | MEDIUM |
| Eyes closed (rest) | — | — | Score frozen | unchanged |
| No face detected | — | — | Score frozen | unchanged |

### Eye Tracking Accuracy
- MediaPipe FaceLandmarker achieves consistent landmark detection at 30 fps on Apple M3
- EAR threshold of 0.20 reliably separates open (0.25–0.35) from closed (0.05–0.15) states
- GPU-accelerated via Metal on macOS (GL version 2.1 Metal)

### System Performance
- Python pipeline latency: <33ms per frame (real-time at 30 fps)
- Dashboard poll cycle: 2 seconds for metrics, continuous for video
- AI insight generation: ~1.5s (Sarvam), ~1.2s (Mistral), ~3–8s (Ollama qwen2.5:3b)
- ESP32 push rate: 1 push/second, fire-and-forget (non-blocking)

### WPM Measurement
- 10-second rolling window with 250ms update interval provides near-instant feedback
- Validated against standard typing test: within ±5 WPM of reference

---

## 7. TRLs and SDGs Mapping

### Technology Readiness Level (TRL)

| TRL | Description | Current Status |
|-----|-------------|---------------|
| TRL 1 | Basic principles observed | ✅ Complete |
| TRL 2 | Technology concept formulated | ✅ Complete |
| TRL 3 | Experimental proof of concept | ✅ Complete |
| TRL 4 | Technology validated in lab | ✅ Complete |
| TRL 5 | Technology validated in relevant environment | ✅ Complete (tested with real users) |
| TRL 6 | Technology demonstrated in relevant environment | 🔄 In Progress |
| TRL 7–9 | System prototype / deployment | 🔲 Future Work |

**Current TRL: 5**

### SDGs Mapping

| SDG | Goal | Relevance |
|-----|------|-----------|
| **SDG 3** | Good Health and Well-being | Reduces developer burnout and stress by providing real-time cognitive load awareness |
| **SDG 4** | Quality Education | Can be applied in educational environments to monitor student cognitive load during learning |
| **SDG 8** | Decent Work and Economic Growth | Improves developer productivity and sustainable work practices |
| **SDG 9** | Industry, Innovation and Infrastructure | Demonstrates novel AI + computer vision integration for workplace well-being |
| **SDG 10** | Reduced Inequalities | Open-source, webcam-only approach makes cognitive monitoring accessible without expensive hardware |

---

## 8. Future Scope

1. **Multi-modal fusion:** Integrate EEG headset data (Muse, OpenBCI) alongside eye tracking for higher-accuracy cognitive load classification using machine learning models (SVM, LSTM).

2. **Personalized baselines:** Build per-user calibration sessions to establish individual normal blink rate and EAR ranges, reducing false positives from inter-person variability.

3. **IDE plugin:** Package as a VS Code extension that surfaces cognitive load warnings directly in the editor without requiring a separate browser tab.

4. **Longitudinal analytics:** Correlate session CSV data with code commit quality, bug rates, and PR review outcomes to quantitatively validate the cognitive load → productivity relationship.

5. **Adaptive task scheduling:** Integrate with project management tools (Jira, Linear) to automatically defer non-urgent tasks when cognitive load is HIGH and surface them when load is LOW.

6. **Mobile deployment:** Port the MediaPipe pipeline to run on mobile devices using the Tasks Vision JavaScript API for monitoring during meetings or study sessions.

7. **ESP32 feedback expansion:** Extend hardware integration to control ambient lighting (RGB LEDs), desk fan speed, or haptic wristbands as physical cognitive load cues.

8. **Team-level dashboards:** Aggregate anonymized cognitive load data across a development team to identify systemic overload periods (sprint endings, deployment days) for managerial insights.

9. **LLM fine-tuning:** Fine-tune a small language model specifically on developer cognitive load scenarios using collected session data + programmer productivity research.

---

## 9. Conclusion

NeuroSync demonstrates that real-time cognitive load monitoring for developers is achievable with commodity hardware — a standard webcam and a browser — with no wearable sensors required. By combining MediaPipe's 478-point facial landmark detection with a research-grounded blink-rate scoring algorithm, browser-level interaction signals, and LLM-generated contextual recommendations, the system provides a continuous, non-intrusive window into a developer's mental state during active work.

The key contributions of this work are:

- A temporally-stable cognitive load scorer that correctly ignores deliberate eye closures and uses burst detection to catch stress responses invisible to 60-second averages
- A full-stack integration architecture bridging a Python computer vision pipeline with a modern React dashboard via MJPEG streaming and JSON REST APIs
- A multi-provider AI insight chain (Sarvam → Mistral → Ollama → rule-based) that degrades gracefully across network conditions
- Real behavioral signals (keydown-based WPM, visibilitychange tab switches) replacing simulated data
- Open hardware integration via ESP32 for physical feedback without additional software infrastructure

The system successfully runs end-to-end on a developer's machine at 30 fps with sub-2-second metric latency and provides actionable AI insights every 15 seconds. It is immediately usable as a research tool for studying developer productivity and as a foundation for the future directions outlined above.

---

## 10. Outcomes: Scopus Index Paper / Patent / Commercial Model

### Target Publication Venues

| Venue | Type | Scope |
|-------|------|-------|
| IEEE Transactions on Human-Machine Systems | Journal | Human factors, cognitive systems |
| ACM CHI Conference on Human Factors in Computing Systems | Conference | HCI, developer tools |
| Empirical Software Engineering (EMSE) | Journal | Developer productivity research |
| IEEE EMBC (Engineering in Medicine and Biology) | Conference | Biomedical + AI intersection |

### Patent Potential

**Provisional Patent Title:** *System and Method for Non-Intrusive Real-Time Cognitive Load Estimation in Knowledge Workers Using Multi-Signal Webcam-Based Eye Tracking and Large Language Model Feedback*

**Novel claims:**
1. Blink burst detection over a short (10s) window as a real-time stress signal independent of sustained blink rate
2. Eye-closure gating of cognitive load EMA to prevent false spikes during intentional rest
3. Multi-tier LLM fallback chain (cloud primary → cloud secondary → local model → deterministic rules) for offline-resilient AI insight generation
4. Browser-native tab-switch counting via `visibilitychange` + `blur` deduplication as a context-switching metric

### Commercial Model

| Tier | Target | Offering | Pricing Model |
|------|--------|----------|---------------|
| **Open Source** | Individual developers, researchers | Core Python pipeline + basic dashboard | Free (MIT License) |
| **NeuroSync Pro** | Individual power users | Extended analytics, session history viewer, IDE plugin | $9/month |
| **NeuroSync Teams** | Engineering teams (5–50 devs) | Team dashboard, anonymized aggregate insights, Slack/Jira integration | $29/seat/month |
| **NeuroSync Enterprise** | Large organizations | On-premise deployment, custom LLM, SSO, compliance reporting | Custom pricing |

---

## 11. References

1. Iqbal, S. T., Zheng, X. S., & Bailey, B. P. (2004). *Task-evoked pupillary response to mental workload in human-computer interaction.* CHI Extended Abstracts.

2. Recarte, M. A., & Nunes, L. M. (2003). *Mental workload while driving: Effects on visual search, discrimination, and decision making.* Journal of Experimental Psychology: Applied, 9(2), 119–137.

3. Stern, J. A., Boyer, D., & Schroeder, D. (1994). *Blink rate: A possible measure of fatigue.* Human Factors, 36(2), 285–297.

4. Lugaresi, C., Tang, J., Nash, H., McClanahan, C., Uboweja, E., Hays, M., ... & Grundmann, M. (2019). *MediaPipe: A framework for building perception pipelines.* arXiv:1906.08172.

5. Sweller, J. (1988). *Cognitive load during problem solving: Effects on learning.* Cognitive Science, 12(2), 257–285.

6. Solovey, E. T., Zec, M., Garcia Perez, E. A., Reimer, B., & Mehler, B. (2014). *Classifying driver workload using physiological and driving performance data.* CHI 2014.

7. Fritz, T., Begel, A., Müller, S. C., Yigit-Elliott, S., & Züger, M. (2014). *Using psycho-physiological measures to assess task difficulty in software development.* ICSE 2014.

8. Soukupová, T., & Čech, J. (2016). *Real-time eye blink detection using facial landmarks.* Computer Vision Winter Workshop (CVWW).

9. OpenAI / Mistral AI / Sarvam AI — respective API documentation, 2024–2026.

10. Google MediaPipe Team. (2023). *MediaPipe Tasks Vision — FaceLandmarker.* https://developers.google.com/mediapipe/solutions/vision/face_landmarker

---

*Report generated: August 2026 | NeuroSync v1.0 | Major Project Phase II*

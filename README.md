# NeuroSync

AI-powered real-time cognitive-load monitoring for developers.

NeuroSync uses a standard webcam to estimate cognitive load from eye behavior, then combines the result with browser activity signals such as typing speed and tab switching. The project includes a Python computer-vision backend, a Next.js dashboard, CSV session logging, AI-generated insights, and optional Azure Foundry voice alerts.

## What it does

- Detects facial landmarks and calculates Eye Aspect Ratio (EAR) with MediaPipe.
- Detects blinks, blink rate, eye closure duration, and drowsiness.
- Estimates cognitive load on a 0–100 scale using blink suppression, blink bursts, and EMA smoothing.
- Tracks browser typing speed and tab/application switches.
- Displays live metrics, charts, an annotated webcam stream, and AI recommendations.
- Logs session data to timestamped CSV files.
- Optionally sends the cognitive-load score to an ESP32 LED ring.
- On the voice-agent integration branch, speaks break reminders through an Azure Foundry Voice Live agent when real cognitive load crosses 50% or 70%.

## Architecture

```text
Webcam
  │
  ▼
Python + OpenCV + MediaPipe
  │  EAR, blink rate, drowsiness, cognitive score
  ├── Flask :5001/metrics       ──► Next.js dashboard polling
  ├── Flask :5001/video_feed    ──► Next.js MJPEG proxy
  └── CSV session logger

Browser / Next.js :3000
  ├── Keyboard and tab tracking
  ├── Live dashboard and charts
  ├── Sarvam / Mistral / Ollama AI insights
  └── Azure Foundry voice alerts (feature branch)
```

## Repository layout

```text
.
├── blink_detection.py          # Blink and eye-closure tracking
├── cognitive_load.py           # Cognitive-load scoring engine
├── data_logger.py              # One-row-per-second CSV logger
├── dashboard.py                # Streamlit session analytics dashboard
├── eye_tracking.py             # MediaPipe FaceLandmarker wrapper
├── stream_server.py            # Flask MJPEG and metrics server
├── utils.py                    # EAR calculation and OpenCV overlays
├── webcam_test.py              # Standalone OpenCV entry point
├── requirements.txt            # Python dependencies
└── keyboard_implementation/
    └── Focus-plus/             # Next.js dashboard application
```

## Requirements

- Python 3.10+ (Python 3.12 recommended)
- Node.js 18+
- A webcam for live monitoring
- npm
- MediaPipe-compatible local environment

## Python setup

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
```

`stream_server.py` also requires Flask. If it is not already installed in your environment, install it with:

```bash
pip install flask
```

The MediaPipe face-landmarker model is downloaded automatically on the first run and is intentionally excluded from Git.

## Next.js setup

```bash
cd keyboard_implementation/Focus-plus
npm install
cp .env.example .env.local
```

Edit `.env.local` with the AI provider settings you want to use. Do not commit `.env.local` or any API keys.

## Running the application

### Full dashboard

Start the Python backend from the repository root:

```bash
source .venv/bin/activate
python3 stream_server.py
```

In a second terminal, start the Next.js app:

```bash
cd keyboard_implementation/Focus-plus
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), launch the dashboard, and start a session.

### Standalone webcam mode

```bash
python3 webcam_test.py
```

Press `Q` to stop the session.

### Historical session dashboard

```bash
streamlit run dashboard.py
```

Session CSV files are written to `sessions/`, which is ignored by Git.

## AI insight providers

The dashboard supports the following insight providers:

1. Ollama when `USE_OLLAMA=true`.
2. Sarvam AI as the primary cloud provider.
3. Mistral AI as the cloud fallback.
4. A deterministic rule-based fallback when providers are unavailable.

Configure provider credentials in `keyboard_implementation/Focus-plus/.env.local` using the names shown in `.env.example`.

## Azure Foundry voice alerts

Voice alerts are implemented on the `feature/voice-agent-integration` branch and should be merged into `main` only after external testing.

The feature uses a server-side Azure Foundry Voice Live session. The browser never receives Azure credentials and no microphone is required for the one-way break reminders.

### Foundry prerequisites

The tester must provide:

- An Azure Foundry resource.
- A Foundry project.
- A voice-enabled Foundry agent.
- Microsoft Entra access with the required Foundry roles.
- Azure authentication through `az login` or service-principal environment variables.

### Voice environment variables

After the feature branch is checked out or merged, add these values to `.env.local`:

```env
VOICE_ALERTS_ENABLED=true
AZURE_VOICELIVE_ENDPOINT=https://<resource>.services.ai.azure.com/
AZURE_FOUNDRY_AGENT_NAME=<agent-name>
AZURE_FOUNDRY_PROJECT_NAME=<project-name>
AZURE_FOUNDRY_AGENT_VERSION=
AZURE_FOUNDRY_RESOURCE_OVERRIDE=
AZURE_FOUNDRY_AUTHENTICATION_IDENTITY_CLIENT_ID=
NEXT_PUBLIC_VOICE_ALERT_COOLDOWN_SEC=600
```

The alert behavior is:

- At 50%: the agent says the cognitive load is getting high and recommends taking a break in the next 20 minutes.
- At 70%: the agent gives a stronger reminder to finish up and take a break within the next 20 minutes.
- Alerts use threshold crossing, hysteresis, and cooldown to prevent repeated speech.
- Simulated or offline dashboard values do not trigger voice alerts.
- If Azure is unavailable, monitoring continues and the dashboard shows the voice service as unavailable.

See the [Microsoft Foundry Voice Live quickstart](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-agents-quickstart) for Azure-side agent setup.

## Testing and checks

From `keyboard_implementation/Focus-plus`:

```bash
npm test
npm run lint
npm run build
```

For voice-agent testing, verify both threshold crossings, cooldown behavior, mute/unmute, Azure-unavailable handling, and session stop/reset behavior. Live Azure validation requires the tester's Foundry credentials and agent configuration.

## Git workflow

The stable branch is `main`. Feature work should use a separate branch, for example:

```bash
git switch -c feature/voice-agent-integration
```

Before merging a feature branch:

1. Install dependencies and regenerate `package-lock.json`.
2. Run tests, lint, and production build checks.
3. Complete live integration testing with the required external credentials.
4. Review the diff and confirm no secrets are staged.
5. Open a pull request into `main`.

## Security notes

- Never commit `.env.local`, Azure credentials, API keys, or tokens.
- Keep Azure authentication in server-side environment variables.
- The webcam stream and metrics server are intended for local development and do not currently provide user authentication.

## Documentation

For the complete technical description, data flow, scoring algorithm, API details, and known limitations, see [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md). The academic project context is documented in [PROJECT_REPORT.md](PROJECT_REPORT.md).

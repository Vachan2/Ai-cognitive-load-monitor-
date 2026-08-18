# NeuroSync 🧠

**AI-powered cognitive monitoring system with real-time focus intelligence**

A production-quality web app that monitors cognitive load and focus using **Gemma 4 running locally through Ollama**.

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Gemma](https://img.shields.io/badge/AI-Gemma%204-purple)

## ✨ Features

- 🎯 **Real-time Focus Monitoring** - Track attention and productivity metrics
- 🤖 **Local AI Analysis** - Powered by Gemma 4 via Ollama
- 📊 **Live Analytics** - Beautiful charts and visualizations
- 🔒 **100% Private** - All processing on your device
- 💡 **Smart Recommendations** - AI-driven insights every 15 seconds
- 🎨 **Premium UI** - Modern glassmorphism design with animations

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Ollama installed
- Gemma 4 model

### Installation

```bash
# 1. Install Ollama
# macOS/Linux: curl -fsSL https://ollama.com/install.sh | sh
# Windows: Download from ollama.com

# 2. Pull Gemma model
ollama pull gemma4:e4b

# 3. Start Ollama
ollama serve

# 4. Install dependencies
npm install

# 5. Setup environment
cp .env.example .env.local

# 6. Run the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🎮 Usage

1. Click **"Launch Dashboard"**
2. Click **"Start Session"**
3. Watch real-time metrics update
4. AI insights appear every 15 seconds

## 🛠️ Tech Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **Framer Motion** - Animations
- **Recharts** - Data visualization
- **Zustand** - State management
- **Ollama + Gemma 4** - Local AI

## 📁 Project Structure

```
neurosync/
├── app/
│   ├── api/analyze/      # AI analysis endpoint
│   ├── dashboard/        # Main dashboard
│   └── page.tsx          # Landing page
├── components/           # React components
├── hooks/               # Custom hooks
├── services/            # Business logic
└── store/              # State management
```

## 🔧 Configuration

Edit `.env.local`:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e4b
```

## 📊 Metrics Tracked

- **Focus Score** (0-100) - Attention level
- **Cognitive Load** (0-100) - Mental effort
- **Productivity Score** (0-100) - Performance
- **Session Duration** - Time tracking
- **Typing Speed** - WPM simulation
- **Tab Switches** - Context switching
- **Distraction Level** - Low/Moderate/High

## 🎨 Design Features

- Animated mesh gradient backgrounds
- Glassmorphism cards
- Neon glow effects
- Floating particles
- Smooth transitions
- Responsive design

## 🐛 Troubleshooting

**Ollama not running:**
```bash
ollama serve
```

**Model not found:**
```bash
ollama pull gemma4:e4b
ollama list
```

**Port in use:**
```bash
npm run dev -- -p 3001
```

## 📦 Build for Production

```bash
npm run build
npm start
```

## 🤝 Contributing

Contributions welcome! Feel free to submit PRs.

## 📄 License

MIT License

---

**Built with ❤️ for AI-powered productivity**

*NeuroSync - Your brain's new best friend* 🧠✨

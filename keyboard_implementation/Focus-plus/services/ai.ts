/**
 * ai.ts — Intelligence layer: Sarvam API (primary) + Mistral API (fallback)
 *
 * Replaces the original Ollama local model with cloud APIs.
 * Strategy:
 *   1. Try Sarvam API first (sarvam-m model)
 *   2. If Sarvam fails (missing key, rate limit, error) → fallback to Mistral
 *   3. If both fail → return a deterministic rule-based analysis
 */

export interface CognitiveMetrics {
  focusScore: number;         // 0–100
  cognitiveLoad: number;      // 0–100
  productivityScore: number;  // 0–100
  typingSpeed: number;        // WPM
  tabSwitches: number;        // context switches
  sessionDuration: number;    // seconds
  distractionLevel: 'Low' | 'Moderate' | 'High';
  blinkRate?: number;         // blinks/min from eye tracker
  earValue?: number;          // eye aspect ratio from eye tracker
}

export interface AIAnalysis {
  insight: string;
  recommendation: string;
  alertLevel: 'info' | 'warning' | 'critical';
  provider: 'sarvam' | 'mistral' | 'ollama' | 'fallback';
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(metrics: CognitiveMetrics): string {
  return `You are a cognitive load monitoring AI assistant analyzing a developer's real-time focus metrics.

Current metrics:
- Focus Score: ${metrics.focusScore}/100
- Cognitive Load: ${metrics.cognitiveLoad}/100
- Productivity Score: ${metrics.productivityScore}/100
- Typing Speed: ${metrics.typingSpeed} WPM
- Tab Switches: ${metrics.tabSwitches} (context switches)
- Session Duration: ${Math.floor(metrics.sessionDuration / 60)} minutes
- Distraction Level: ${metrics.distractionLevel}
${metrics.blinkRate !== undefined ? `- Blink Rate: ${metrics.blinkRate} blinks/min` : ''}
${metrics.earValue !== undefined ? `- Eye Aspect Ratio (EAR): ${metrics.earValue}` : ''}

Provide a concise analysis in exactly this JSON format:
{
  "insight": "One sentence describing the developer's current cognitive state",
  "recommendation": "One actionable recommendation to improve focus or reduce load",
  "alertLevel": "info|warning|critical"
}

Rules:
- alertLevel is "critical" if cognitive load > 75 or focus score < 30
- alertLevel is "warning" if cognitive load > 50 or focus score < 55
- alertLevel is "info" otherwise
- Keep insight under 20 words
- Keep recommendation under 20 words
- Return only valid JSON, no markdown`;
}

// ─── Sarvam API ──────────────────────────────────────────────────────────────

async function callSarvam(metrics: CognitiveMetrics): Promise<AIAnalysis> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) throw new Error('SARVAM_API_KEY not set');

  const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
    },
    body: JSON.stringify({
      model: 'sarvam-105b',
      messages: [{ role: 'user', content: buildPrompt(metrics) }],
      max_tokens: 500,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(10000), // 10s timeout
  });

  if (!response.ok) {
    throw new Error(`Sarvam API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  // sarvam-105b is a reasoning model — answer may be in reasoning_content, not content
  const raw = data.choices?.[0]?.message;
  const content: string = raw?.content ?? raw?.reasoning_content ?? '';
  if (!content) throw new Error('Sarvam returned empty content');
  // Strip markdown code fences if the model wraps output in ```json ... ```
  const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(jsonStr);

  return {
    insight: parsed.insight,
    recommendation: parsed.recommendation,
    alertLevel: parsed.alertLevel ?? 'info',
    provider: 'sarvam',
  };
}

// ─── Mistral API (fallback) ───────────────────────────────────────────────────

async function callMistral(metrics: CognitiveMetrics): Promise<AIAnalysis> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY not set');

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: buildPrompt(metrics) }],
      max_tokens: 200,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('Mistral returned empty content');
  const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(jsonStr);

  return {
    insight: parsed.insight,
    recommendation: parsed.recommendation,
    alertLevel: parsed.alertLevel ?? 'info',
    provider: 'mistral',
  };
}

// ─── Local Ollama ─────────────────────────────────────────────────────────────

async function callOllama(metrics: CognitiveMetrics): Promise<AIAnalysis> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model   = process.env.OLLAMA_MODEL   ?? 'qwen2.5:3b';

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: 'user', content: buildPrompt(metrics) }],
      options: { temperature: 0.3 },
    }),
    signal: AbortSignal.timeout(30000), // local models can be slower
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content: string = data.message?.content ?? '';
  if (!content) throw new Error('Ollama returned empty content');

  // Strip markdown fences if the model wraps output
  const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed  = JSON.parse(jsonStr);

  return {
    insight:        parsed.insight,
    recommendation: parsed.recommendation,
    alertLevel:     parsed.alertLevel ?? 'info',
    provider:       'ollama',
  };
}

// ─── Rule-based fallback ─────────────────────────────────────────────────────

function ruleBasedAnalysis(metrics: CognitiveMetrics): AIAnalysis {
  const load = metrics.cognitiveLoad;
  const focus = metrics.focusScore;

  let insight: string;
  let recommendation: string;
  let alertLevel: AIAnalysis['alertLevel'];

  if (load > 75 || focus < 30) {
    alertLevel = 'critical';
    insight = 'Cognitive overload detected — mental resources critically depleted.';
    recommendation = 'Take a 10-minute break immediately and hydrate.';
  } else if (load > 50 || focus < 55) {
    alertLevel = 'warning';
    insight = 'Elevated cognitive load — focus degrading under sustained effort.';
    recommendation = 'Use Pomodoro: 5-minute break after 25 minutes of work.';
  } else if (metrics.tabSwitches > 10) {
    alertLevel = 'warning';
    insight = 'Frequent context switching is fragmenting your attention.';
    recommendation = 'Close unused tabs and work in single-task mode.';
  } else {
    alertLevel = 'info';
    insight = 'Cognitive load is manageable — you are in a productive flow state.';
    recommendation = 'Maintain current pace. Review goals every 30 minutes.';
  }

  return { insight, recommendation, alertLevel, provider: 'fallback' };
}

// ─── Main exported function ──────────────────────────────────────────────────

export async function analyzeMetrics(metrics: CognitiveMetrics): Promise<AIAnalysis> {
  // ── Local Ollama override ─────────────────────────────────────────────────
  // When USE_OLLAMA=true, skip cloud APIs entirely and use the local model.
  if (process.env.USE_OLLAMA === 'true') {
    try {
      return await callOllama(metrics);
    } catch (ollamaErr) {
      console.warn('[AI] Ollama failed, falling back to rule-based:', (ollamaErr as Error).message);
      return ruleBasedAnalysis(metrics);
    }
  }

  // 1. Try Sarvam
  try {
    return await callSarvam(metrics);
  } catch (sarvamErr) {
    console.warn('[AI] Sarvam failed, trying Mistral:', (sarvamErr as Error).message);
  }

  // 2. Try Mistral
  try {
    return await callMistral(metrics);
  } catch (mistralErr) {
    console.warn('[AI] Mistral failed, using rule-based fallback:', (mistralErr as Error).message);
  }

  // 3. Rule-based fallback
  return ruleBasedAnalysis(metrics);
}

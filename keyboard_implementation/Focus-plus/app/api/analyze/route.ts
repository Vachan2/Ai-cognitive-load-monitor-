/**
 * POST /api/analyze
 * Accepts cognitive metrics, returns AI insight + recommendation.
 * Uses Sarvam API → Mistral fallback → rule-based fallback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeMetrics, type CognitiveMetrics } from '@/services/ai';

export async function POST(req: NextRequest) {
  try {
    const metrics: CognitiveMetrics = await req.json();

    // Basic validation
    if (typeof metrics.focusScore !== 'number') {
      return NextResponse.json({ error: 'Invalid metrics payload' }, { status: 400 });
    }

    const analysis = await analyzeMetrics(metrics);
    return NextResponse.json(analysis);

  } catch (err) {
    console.error('[/api/analyze] Error:', err);
    return NextResponse.json(
      { error: 'Analysis failed', detail: (err as Error).message },
      { status: 500 }
    );
  }
}

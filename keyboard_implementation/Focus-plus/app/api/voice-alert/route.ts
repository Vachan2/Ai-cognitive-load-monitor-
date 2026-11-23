import { NextRequest, NextResponse } from 'next/server';
import { synthesizeVoiceAlert, voiceAlertsEnabled } from '@/services/voiceAgent';
import { VOICE_ALERT_MESSAGES, type VoiceAlertLevel } from '@/services/voiceAlerts';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!voiceAlertsEnabled()) {
    return NextResponse.json(
      { available: false, error: 'Voice alerts are disabled' },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const level = body?.level;
    const cognitiveLoad = body?.cognitiveLoad;
    const message = body?.message;

    if (![50, 70].includes(level) || typeof cognitiveLoad !== 'number' ||
        !Number.isFinite(cognitiveLoad) || typeof message !== 'string' ||
        message !== VOICE_ALERT_MESSAGES[level as VoiceAlertLevel]) {
      return NextResponse.json({ error: 'Invalid voice alert payload' }, { status: 400 });
    }

    const wav = await synthesizeVoiceAlert({ level, cognitiveLoad, message });
    return new NextResponse(new Uint8Array(wav), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[/api/voice-alert] Error:', error);
    return NextResponse.json(
      { available: false, error: 'Voice alert unavailable' },
      { status: 503 },
    );
  }
}

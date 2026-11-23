export type VoiceAlertLevel = 50 | 70;

export interface VoiceAlert {
  level: VoiceAlertLevel;
  cognitiveLoad: number;
  message: string;
}

export const VOICE_ALERT_MESSAGES: Record<VoiceAlertLevel, string> = {
  50: 'Your cognitive load is getting high. Please finish up and take a break in the next 20 minutes.',
  70: 'Your cognitive load is very high. Please finish up and take a break within the next 20 minutes.',
};

export class VoiceAlertController {
  private fired50 = false;
  private fired70 = false;
  private lastAlertAt: number | null = null;
  private lastAlertLevel: VoiceAlertLevel | null = null;

  constructor(private readonly cooldownMs = 10 * 60 * 1000) {}

  evaluate(cognitiveLoad: number, now = Date.now()): VoiceAlert | null {
    if (!Number.isFinite(cognitiveLoad)) return null;

    if (cognitiveLoad < 45) this.fired50 = false;
    if (cognitiveLoad < 65) this.fired70 = false;

    const canAlert = this.lastAlertAt === null || now - this.lastAlertAt >= this.cooldownMs;
    const escalatingTo70 = cognitiveLoad >= 70 && !this.fired70 && this.lastAlertLevel === 50;

    if (cognitiveLoad >= 70 && !this.fired70 && (canAlert || escalatingTo70)) {
      this.fired50 = true;
      this.fired70 = true;
      this.lastAlertAt = now;
      this.lastAlertLevel = 70;
      return { level: 70, cognitiveLoad, message: VOICE_ALERT_MESSAGES[70] };
    }

    if (cognitiveLoad >= 50 && !this.fired50 && canAlert) {
      this.fired50 = true;
      this.lastAlertAt = now;
      this.lastAlertLevel = 50;
      return { level: 50, cognitiveLoad, message: VOICE_ALERT_MESSAGES[50] };
    }

    return null;
  }

  reset() {
    this.fired50 = false;
    this.fired70 = false;
    this.lastAlertAt = null;
    this.lastAlertLevel = null;
  }
}

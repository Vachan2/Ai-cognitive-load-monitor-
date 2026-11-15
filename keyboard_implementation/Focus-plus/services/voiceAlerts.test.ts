import { describe, expect, it } from 'vitest';
import { VoiceAlertController } from './voiceAlerts';

describe('VoiceAlertController', () => {
  it('alerts once when crossing 50 and does not repeat while elevated', () => {
    const controller = new VoiceAlertController(10_000);
    expect(controller.evaluate(49, 0)).toBeNull();
    expect(controller.evaluate(50, 1_000)?.level).toBe(50);
    expect(controller.evaluate(60, 2_000)).toBeNull();
  });

  it('allows an immediate escalation from 50 to 70', () => {
    const controller = new VoiceAlertController(10_000);
    expect(controller.evaluate(50, 0)?.level).toBe(50);
    expect(controller.evaluate(70, 1_000)?.level).toBe(70);
  });

  it('only emits the 70 alert when load jumps over both thresholds', () => {
    const controller = new VoiceAlertController(10_000);
    expect(controller.evaluate(75, 0)?.level).toBe(70);
    expect(controller.evaluate(55, 1_000)).toBeNull();
  });

  it('requires hysteresis before a threshold can fire again', () => {
    const controller = new VoiceAlertController(0);
    expect(controller.evaluate(50, 0)?.level).toBe(50);
    expect(controller.evaluate(46, 1_000)).toBeNull();
    expect(controller.evaluate(44, 2_000)).toBeNull();
    expect(controller.evaluate(50, 3_000)?.level).toBe(50);
  });

  it('enforces cooldown for repeated alerts after reset', () => {
    const controller = new VoiceAlertController(10_000);
    expect(controller.evaluate(50, 0)?.level).toBe(50);
    controller.evaluate(44, 1_000);
    expect(controller.evaluate(50, 2_000)).toBeNull();
    expect(controller.evaluate(50, 11_000)?.level).toBe(50);
  });
});

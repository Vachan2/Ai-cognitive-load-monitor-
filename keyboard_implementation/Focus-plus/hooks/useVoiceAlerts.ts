'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { VoiceAlertController } from '@/services/voiceAlerts';

const cooldownMs = Math.max(
  0,
  Number(process.env.NEXT_PUBLIC_VOICE_ALERT_COOLDOWN_SEC ?? 600) * 1000,
);

export function useVoiceAlerts() {
  const isRunning = useSessionStore((s) => s.isRunning);
  const cognitiveLoad = useSessionStore((s) => s.metrics.cognitiveLoad);
  const faceDetected = useSessionStore((s) => s.metrics.faceDetected);
  const voiceMuted = useSessionStore((s) => s.voiceMuted);
  const controllerRef = useRef(new VoiceAlertController(cooldownMs));
  const audioContextRef = useRef<AudioContext | null>(null);
  const armedRef = useRef(false);
  const queueRef = useRef<ReturnType<VoiceAlertController['evaluate']>[]>([]);
  const processingRef = useRef(false);

  const armVoice = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const AudioContextCtor = window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    audioContextRef.current ??= new AudioContextCtor();
    await audioContextRef.current.resume();
    armedRef.current = true;
  }, []);

  const playNext = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;
    const store = useSessionStore.getState();

    try {
      while (queueRef.current.length > 0) {
        const alert = queueRef.current.shift();
        if (!alert) continue;
        store.setVoiceStatus('speaking');

        try {
          if (!armedRef.current) await armVoice();
          const res = await fetch('/api/voice-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alert),
          });
          if (!res.ok) throw new Error(`Voice alert request failed: ${res.status}`);

          const context = audioContextRef.current;
          if (!context) throw new Error('Audio output is not available');
          const buffer = await context.decodeAudioData(await res.arrayBuffer());
          await new Promise<void>((resolve) => {
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.onended = () => resolve();
            source.start();
          });
        } catch (error) {
          console.warn('[useVoiceAlerts] Voice alert unavailable:', error);
          store.setVoiceStatus('unavailable');
          break;
        }
      }

      if (useSessionStore.getState().isRunning) store.setVoiceStatus('idle');
    } finally {
      processingRef.current = false;
    }
  }, [armVoice]);

  useEffect(() => {
    if (!isRunning) {
      controllerRef.current.reset();
      queueRef.current = [];
      processingRef.current = false;
      useSessionStore.getState().setVoiceStatus('idle');
      return;
    }

    if (!faceDetected) return;

    const alert = controllerRef.current.evaluate(cognitiveLoad);
    if (!alert) return;

    useSessionStore.getState().setLastVoiceAlert({ level: alert.level, at: Date.now() });
    if (voiceMuted) return;
    queueRef.current = [...queueRef.current.filter(Boolean), alert];
    void playNext();
  }, [cognitiveLoad, faceDetected, isRunning, playNext, voiceMuted]);

  useEffect(() => () => {
    audioContextRef.current?.close().catch(() => undefined);
  }, []);

  return {
    voiceMuted,
    voiceStatus: useSessionStore((s) => s.voiceStatus),
    lastVoiceAlert: useSessionStore((s) => s.lastVoiceAlert),
    armVoice,
    toggleVoiceMuted: () => useSessionStore.getState().setVoiceMuted(!voiceMuted),
  };
}

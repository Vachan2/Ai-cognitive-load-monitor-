/**
 * WebcamFeed — Embeds the MJPEG stream from stream_server.py with a
 * connection-state overlay and eye-metric badges.
 *
 * The component is purely presentational: it displays whatever the Python
 * server is streaming and accepts live metric props from the session store.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WebcamFeedProps {
  /** URL of the MJPEG stream endpoint (proxied through Next.js) */
  streamUrl?: string;
  /** Current EAR value (0–1) from the store */
  earValue?: number;
  /** Blink rate /min from the store */
  blinkRate?: number;
  /** True when Python reports a face in frame */
  faceDetected?: boolean;
  /** Whether the session is running */
  isRunning?: boolean;
}

type ConnectionState = 'connecting' | 'connected' | 'error' | 'offline';

const STREAM_URL = '/api/video-feed';

export default function WebcamFeed({
  streamUrl = STREAM_URL,
  earValue = 0,
  blinkRate = 0,
  faceDetected = false,
  isRunning = false,
}: WebcamFeedProps) {
  const [conn, setConn] = useState<ConnectionState>('offline');
  const imgRef = useRef<HTMLImageElement>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only attempt to connect when the session is running
  useEffect(() => {
    if (!isRunning) {
      setConn('offline');
      if (imgRef.current) imgRef.current.src = '';
      return;
    }

    setConn('connecting');
    if (imgRef.current) {
      // Append a cache-bust so the browser re-requests on reconnect
      imgRef.current.src = `${streamUrl}?t=${Date.now()}`;
    }

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [isRunning, streamUrl]);

  function handleLoad() {
    setConn('connected');
    if (retryRef.current) clearTimeout(retryRef.current);
  }

  function handleError() {
    setConn('error');
    // Auto-retry every 3 s while the session is running
    retryRef.current = setTimeout(() => {
      if (imgRef.current && isRunning) {
        setConn('connecting');
        imgRef.current.src = `${streamUrl}?t=${Date.now()}`;
      }
    }, 3000);
  }

  const earPercent = Math.round(earValue * 100);
  const earColor =
    earValue < 0.2 ? 'text-red-400' : earValue < 0.25 ? 'text-orange-400' : 'text-emerald-400';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-xs font-medium text-white/50 uppercase tracking-widest">
          📷 Live Eye Tracking
        </span>
        <ConnectionBadge state={conn} />
      </div>

      {/* Video area */}
      <div className="relative bg-black w-full" style={{ aspectRatio: '4/3' }}>
        {/* MJPEG <img> — always in DOM so it buffers in the background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          alt="Live webcam eye tracking feed"
          onLoad={handleLoad}
          onError={handleError}
          className="w-full h-full object-cover"
          style={{ display: conn === 'connected' ? 'block' : 'none' }}
        />

        {/* Placeholder shown when not connected */}
        <AnimatePresence>
          {conn !== 'connected' && (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            >
              {conn === 'offline' && (
                <>
                  <span className="text-4xl opacity-30">👁</span>
                  <p className="text-white/30 text-xs text-center px-4">
                    Start a session to activate<br />the eye tracking feed
                  </p>
                </>
              )}
              {conn === 'connecting' && (
                <>
                  <span className="inline-block w-6 h-6 rounded-full border-2 border-white/20 border-t-cyan-400 animate-spin" />
                  <p className="text-white/40 text-xs">Connecting to stream server…</p>
                </>
              )}
              {conn === 'error' && (
                <>
                  <span className="text-3xl opacity-40">⚠️</span>
                  <p className="text-white/40 text-xs text-center px-4">
                    Stream unavailable<br />
                    <span className="text-white/20">Make sure <code className="font-mono">stream_server.py</code> is running</span>
                  </p>
                  <p className="text-white/20 text-xs">Retrying in 3 s…</p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Face-detected indicator — top-left corner overlay */}
        {conn === 'connected' && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}
            />
            <span className="text-xs text-white/70 font-mono">
              {faceDetected ? 'Face detected' : 'No face'}
            </span>
          </div>
        )}
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10">
        <div className="flex flex-col items-center py-3 gap-0.5">
          <span className="text-xs text-white/40 uppercase tracking-widest">EAR</span>
          <span className={`text-lg font-bold font-mono ${earColor}`}>
            {earValue.toFixed(3)}
          </span>
          {/* EAR gauge bar */}
          <div className="w-3/4 h-1 rounded-full bg-white/10 overflow-hidden mt-1">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                earValue < 0.2 ? 'bg-red-400' : earValue < 0.25 ? 'bg-orange-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, earPercent * 2)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col items-center py-3 gap-0.5">
          <span className="text-xs text-white/40 uppercase tracking-widest">Blink Rate</span>
          <span className="text-lg font-bold font-mono text-cyan-400">
            {blinkRate.toFixed(1)}
          </span>
          <span className="text-xs text-white/30">/min</span>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const styles: Record<ConnectionState, { dot: string; label: string; text: string }> = {
    connected:  { dot: 'bg-emerald-400 animate-pulse', label: 'Live',       text: 'text-emerald-400' },
    connecting: { dot: 'bg-yellow-400 animate-pulse',  label: 'Connecting', text: 'text-yellow-400' },
    error:      { dot: 'bg-red-400',                   label: 'Error',      text: 'text-red-400' },
    offline:    { dot: 'bg-white/20',                  label: 'Offline',    text: 'text-white/30' },
  };
  const s = styles[state];

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
    </div>
  );
}

/**
 * GET /api/eye-metrics
 *
 * Proxies the Python stream_server /metrics endpoint so the browser never
 * hits a mixed-content or CORS issue.  Falls back to a null-data response
 * when the Python server is not running, letting the dashboard degrade
 * gracefully without throwing.
 */

import { NextResponse } from 'next/server';

const PYTHON_METRICS_URL = 'http://localhost:5001/metrics';
// Timeout short enough that the dashboard polling loop stays snappy
const FETCH_TIMEOUT_MS = 800;

export async function GET() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(PYTHON_METRICS_URL, {
      signal: controller.signal,
      // Always bypass Next.js data cache — we want a fresh reading every call
      cache: 'no-store',
    });
    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json({ available: false }, { status: 200 });
    }

    const data = await res.json();
    return NextResponse.json({ available: true, ...data });

  } catch {
    // Python server not running, timed out, or network error — not a 500
    return NextResponse.json({ available: false }, { status: 200 });
  }
}

/**
 * GET /api/video-feed
 *
 * Proxies the MJPEG stream from the Python stream_server so the browser
 * never makes a cross-origin request to localhost:5001.
 *
 * The response is a pass-through stream: bytes from Python are forwarded
 * directly to the browser as they arrive, preserving the
 * multipart/x-mixed-replace content-type that MJPEG requires.
 */

import { NextResponse } from 'next/server';

const PYTHON_STREAM_URL = 'http://localhost:5001/video_feed';
const CONNECT_TIMEOUT_MS = 3000;

export async function GET() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

    const upstream = await fetch(PYTHON_STREAM_URL, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    if (!upstream.ok || !upstream.body) {
      return new NextResponse(null, { status: 502 });
    }

    // Forward the raw byte stream and the original content-type header so the
    // browser receives a proper multipart/x-mixed-replace; boundary=frame
    // response it can render as a live <img>.
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type':  upstream.headers.get('Content-Type') ?? 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-cache, no-store',
        'X-Accel-Buffering': 'no',   // prevents nginx/proxy buffering if ever deployed
      },
    });

  } catch {
    // Python server not running or timed out
    return new NextResponse(null, { status: 503 });
  }
}

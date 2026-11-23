import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action === 'stop' ? 'stop' : 'start';

    const response = await fetch(`http://localhost:5001/session/${action}`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) {
      return NextResponse.json({ available: false }, { status: 502 });
    }

    return NextResponse.json(await response.json(), { status: 200 });
  } catch {
    return NextResponse.json({ available: false }, { status: 503 });
  }
}

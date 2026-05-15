'use server';

import { NextRequest } from 'next/server';

const MAYA_BACKEND = process.env.MAYA_BACKEND_URL || 'http://localhost:8092';

export async function POST(req: NextRequest) {
  try {
    const response = await fetch(`${MAYA_BACKEND}/v1/voice/abort`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
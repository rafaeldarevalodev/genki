'use server';

import { NextRequest } from 'next/server';

const MAYA_BACKEND = process.env.MAYA_BACKEND_URL || 'http://localhost:8092';

export async function POST(req: NextRequest) {
  const body = await req.json();
  
  try {
    // Forward the request to Maya backend
    const mayaResponse = await fetch(`${MAYA_BACKEND}/v1/voice/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_audio: body.user_audio,
        session_id: body.session_id,
        mode: body.mode || 'fast',
        vocabulary: body.vocabulary || [],
        tts_provider: body.tts_provider || 'f5tts',
        tts_voice: body.tts_voice || 'en-Emma_woman'
      })
    });

    if (!mayaResponse.body) {
      return new Response(JSON.stringify({ error: 'No response from Maya backend' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Stream the response back to client - pass through as-is
    return new Response(mayaResponse.body, {
      status: mayaResponse.status,
      headers: {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
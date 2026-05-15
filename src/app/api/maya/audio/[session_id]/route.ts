'use server';

import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { exists } from 'fs';

const MAYA_BACKEND = process.env.MAYA_BACKEND_URL || 'http://localhost:8092';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  const { session_id } = await params;
  
  try {
    // Fetch from Maya backend
    const response = await fetch(`${MAYA_BACKEND}/v1/voice/audio/${session_id}`);
    
    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Audio not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const audioBuffer = await response.arrayBuffer();
    
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Disposition': `attachment; filename="maya_response.wav"`,
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
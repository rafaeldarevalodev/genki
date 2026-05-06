'use server';

import { voicePractice } from '@/ai/flows/voice-practice';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  console.log('[voice-practice-api] Received request');
  
  try {
    const body = await req.json();
    console.log('[voice-practice-api] Body:', { text: body.text, audioLength: body.audio?.length });
    
    const { text, audio, language } = body;

    if (!text || !audio) {
      return NextResponse.json(
        { error: 'text and audio are required' },
        { status: 400 }
      );
    }

    console.log('[voice-practice-api] Calling voicePractice...');
    const result = await voicePractice({ text, audio, language: language || 'en' });
    console.log('[voice-practice-api] Result:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[voice-practice-api]', message);
    return NextResponse.json(
      { error: 'Failed to evaluate pronunciation: ' + message },
      { status: 500 }
    );
  }
}
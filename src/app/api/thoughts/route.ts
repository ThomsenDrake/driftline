import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { RateLimiter } from '@/lib/rate-limiter';
import { containsProfanity } from '@/lib/profanity-filter';

interface Thought {
  text: string;
  audio_url?: string;
  lat: number;
  lng: number;
}

export async function POST(req: Request) {
  try {
    console.log('🔍 [DEBUG] Thoughts API: Starting request processing...');
    
    // Get client IP address
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    console.log('🔍 [DEBUG] Thoughts API: Client IP:', ip);
    
    // Check rate limit
    const rateLimitResult = RateLimiter.isAllowed(ip);
    console.log('🔍 [DEBUG] Thoughts API: Rate limit result:', rateLimitResult);
    if (!rateLimitResult.allowed) {
      const resetTime = new Date(rateLimitResult.resetTime || Date.now());
      console.log('🔍 [DEBUG] Thoughts API: Rate limit exceeded');
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. You can post again in 60 seconds.',
          retryAfter: Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000)
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '1',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.floor(rateLimitResult.resetTime! / 1000).toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000).toString()
          }
        }
      );
    }

    const body = await req.json();
    console.log('🔍 [DEBUG] Thoughts API: Request body:', body);
    const { text, audio_url, lat, lng }: Thought = body;

    // Validate input
    if (!text || !lat || !lng) {
      return NextResponse.json(
        { error: 'Text, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    if (text.length > 200) {
      return NextResponse.json(
        { error: 'Text must be 200 characters or less' },
        { status: 400 }
      );
    }

    // Server-side profanity check (additional layer of security)
    if (containsProfanity(text)) {
      return NextResponse.json(
        { error: 'Inappropriate content detected. Please modify your thought.' },
        { status: 400 }
      );
    }

    // Insert into database with expiration
    console.log('🔍 [DEBUG] Thoughts API: Inserting into database...');
    const insertData = {
      text: text.trim(),
      audio_url: audio_url || null,
      lat,
      lng,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
    };
    console.log('🔍 [DEBUG] Thoughts API: Insert data:', insertData);
    
    const { data: insertedThought, error: insertError } = await supabase
      .from('thoughts')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('🔍 [DEBUG] Thoughts API: Database insert error:', insertError);
      console.error('🔍 [DEBUG] Thoughts API: Error details:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint
      });
      return NextResponse.json(
        { error: 'Failed to save thought. Please try again.' },
        { status: 500 }
      );
    }

    console.log('🔍 [DEBUG] Thoughts API: Database insert successful:', insertedThought);

    // Increment rate limit counter
    RateLimiter.increment(ip);
    console.log('🔍 [DEBUG] Thoughts API: Rate limit incremented');

    const response = {
      success: true,
      data: insertedThought,
      message: 'Thought submitted successfully'
    };
    console.log('🔍 [DEBUG] Thoughts API: Returning response:', response);
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('🔍 [DEBUG] Thoughts API: Error in thoughts API:', error);
    const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
    console.error('🔍 [DEBUG] Thoughts API: Error type:', errorType);
    console.error('🔍 [DEBUG] Thoughts API: Error details:', error);
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Internal server error';
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please wait before trying again.';
      } else if (error.message.includes('database') || error.message.includes('connection')) {
        errorMessage = 'Database connection error. Please try again later.';
      } else if (error.message.includes('permission') || error.message.includes('RLS')) {
        errorMessage = 'Permission denied. Please check your access rights.';
      } else {
        errorMessage = error.message || 'An unexpected error occurred.';
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
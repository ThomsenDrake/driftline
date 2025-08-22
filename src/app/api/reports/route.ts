import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface ReportData {
  thoughtId: string;
  reason: string;
  details?: string;
}

export async function POST(req: Request) {
  try {
    const { thoughtId, reason, details }: ReportData = await req.json();

    // Validate input
    if (!thoughtId || !reason) {
      return NextResponse.json(
        { error: 'Thought ID and reason are required' },
        { status: 400 }
      );
    }

    // Get client IP address
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';

    // Check if this thought has already been reported by this IP
    const { data: existingReport } = await supabase
      .from('reports')
      .select('id')
      .eq('thought_id', thoughtId)
      .eq('ip_address', ip)
      .single();

    if (existingReport) {
      return NextResponse.json(
        { error: 'You have already reported this thought' },
        { status: 400 }
      );
    }

    // Insert report into database
    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        thought_id: thoughtId,
        reason: reason.trim(),
        details: details?.trim() || null,
        ip_address: ip,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting report:', insertError);
      return NextResponse.json(
        { error: 'Failed to submit report. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      report,
      message: 'Report submitted successfully. Thank you for helping keep our community safe.'
    });

  } catch (error) {
    console.error('Error in reports API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
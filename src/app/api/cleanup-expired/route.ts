import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    // Delete thoughts that have expired (older than 24 hours)
    const { error } = await supabase
      .from('thoughts')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error cleaning up expired thoughts:', error);
      return NextResponse.json(
        { error: 'Failed to cleanup expired thoughts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Expired thoughts cleaned up successfully'
    });
  } catch (error) {
    console.error('Error in cleanup API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
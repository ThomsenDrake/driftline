import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface Thought {
  id: string;
  text: string;
  audio_url?: string;
  lat: number;
  lng: number;
  mood?: string | null;
  created_at: string;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    
    const ne_lat = parseFloat(searchParams.get('ne_lat') || '0');
    const ne_lng = parseFloat(searchParams.get('ne_lng') || '0');
    const sw_lat = parseFloat(searchParams.get('sw_lat') || '0');
    const sw_lng = parseFloat(searchParams.get('sw_lng') || '0');
    const limit = parseInt(searchParams.get('limit') || '40');

    // Validate coordinates
    if (isNaN(ne_lat) || isNaN(ne_lng) || isNaN(sw_lat) || isNaN(sw_lng)) {
      return NextResponse.json({ 
        error: 'Invalid coordinates', 
        thoughts: [] 
      }, { status: 400 });
    }

    // Fetch thoughts within bounds, ordered by most recent, excluding expired ones
    const { data, error } = await supabase
      .from('thoughts')
      .select('*')
      .gte('lat', sw_lat)
      .lte('lat', ne_lat)
      .gte('lng', sw_lng)
      .lte('lng', ne_lng)
      .gt('expires_at', new Date().toISOString()) // Only include non-expired thoughts
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching thoughts in bounds:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch thoughts', 
        thoughts: [] 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      thoughts: data || [],
      count: data?.length || 0 
    });
  } catch (error) {
    console.error('Error in thoughts-in-bounds API:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      thoughts: [] 
    }, { status: 500 });
  }
}
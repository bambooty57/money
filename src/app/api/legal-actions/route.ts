import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('legal_actions')
      .select('*,customers(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching legal actions:', error);
    return NextResponse.json({ error: 'Failed to fetch legal actions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from('legal_actions')
      .insert([body])
      .select('*,customers(*)')
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating legal action:', error);
    return NextResponse.json({ error: 'Failed to create legal action' }, { status: 500 });
  }
} 
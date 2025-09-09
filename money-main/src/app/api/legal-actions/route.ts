import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const accessToken = authHeader?.replace(/^Bearer /i, '');
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = createServerClient(accessToken);
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
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const accessToken = authHeader?.replace(/^Bearer /i, '');
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = createServerClient(accessToken);
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
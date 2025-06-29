import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customer_id = searchParams.get('customer_id');
  if (!customer_id) {
    return NextResponse.json({ data: [] });
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('customer_id', customer_id)
    .order('sent_at', { ascending: false });
  if (error) {
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
} 
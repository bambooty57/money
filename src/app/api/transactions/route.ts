import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const url = request instanceof Request ? new URL(request.url) : null;
    const countOnly = url?.searchParams.get('count') === '1';
    if (countOnly) {
      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return NextResponse.json({ count: count ?? 0 });
    }
    const { data, error } = await supabase
      .from('transactions')
      .select('*,customers(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from('transactions')
      .insert([body])
      .select('*,customers(*)')
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  // Implementation for PUT request
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: '거래 ID가 필요합니다.' }, { status: 400 });
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
} 
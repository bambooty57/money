import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customer_id = searchParams.get('customer_id');
    let query = supabase.from('files').select('*,customers(*)').order('created_at', { ascending: false });
    if (customer_id) query = query.eq('customer_id', customer_id);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isValidUUID = (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
    const body = await req.json();
    if (!body.customer_id || !isValidUUID(body.customer_id)) {
      return NextResponse.json({ error: '유효한 customer_id가 필요합니다.' }, { status: 400 });
    }
    if (body.transaction_id && !isValidUUID(body.transaction_id)) {
      return NextResponse.json({ error: '유효한 transaction_id가 필요합니다.' }, { status: 400 });
    }
    const { data, error } = await supabase.from('files').insert([body]).select('*,customers(*)').single();
    if (error) {
      console.error('Error creating file:', error);
      return NextResponse.json({ error: error.message || 'Failed to create file' }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating file:', error);
    return NextResponse.json({ error: 'Failed to create file' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const file_id = searchParams.get('file_id');
    if (!file_id) throw new Error('Missing file_id');
    const { data, error } = await supabase.from('files').delete().eq('id', file_id);
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
} 
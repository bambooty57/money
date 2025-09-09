import { NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customer_id = searchParams.get('customer_id');
  const event_type = searchParams.get('event_type');
  let query = supabase.from('event_logs').select('*').order('created_at', { ascending: false }).limit(100);
  if (customer_id) query = query.eq('customer_id', customer_id);
  if (event_type) query = query.eq('event_type', event_type);
  const { data } = await query;
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  // 관리자 권한 체크 예시(실제 구현은 인증 연동 필요)
  const isAdmin = true; // TODO: 실제 인증 연동
  if (!isAdmin) return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  const body = await request.json();
  const { customer_id, event_type, message } = body;
  const { data, error } = await supabase.from('event_logs').insert([{ customer_id, event_type, message }]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.[0] ?? null);
}

export async function DELETE(request: Request) {
  // Authorization 헤더에서 토큰 추출
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  if (!token) {
    return NextResponse.json(
      { error: 'Authorization token required' }, 
      { status: 401 }
    )
  }
  
  // 인증된 Supabase 클라이언트 생성
  const authenticatedSupabase = createServerClient(token)
  
  const { searchParams } = new URL(request.url);
  const event_id = searchParams.get('event_id');
  if (!event_id) return NextResponse.json({ error: 'event_id가 필요합니다' }, { status: 400 });
  const { data, error } = await authenticatedSupabase.from('event_logs').delete().eq('id', event_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: '삭제 결과 없음' }, { status: 404 });
  return NextResponse.json(data ?? []);
} 
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customer_id = searchParams.get('customer_id');
  if (!customer_id) {
    return NextResponse.json({ data: [] });
  }
  const supabase = createClient();
  const db = supabase as any;

  try {
    // 1. sms_messages (고객 카드에서 개별 발송한 문자)
    const { data: smsData } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('customer_id', customer_id);

    // 2. notification_history (문자메세지 메뉴 / 자동/일괄 발송한 문자)
    const { data: notifData } = await db
      .from('notification_history')
      .select('*')
      .eq('customer_id', customer_id);

    // 3. 데이터 통합 및 정규화
    const list1 = (smsData || []).map((item: any) => ({
      id: item.id,
      customer_id: item.customer_id,
      content: item.content || item.message || '',
      sent_at: item.sent_at || item.created_at,
      status: item.status || 'sent',
      source_table: 'sms_messages',
    }));

    const list2 = (notifData || []).map((item: any) => ({
      id: item.id,
      customer_id: item.customer_id,
      content: item.message || item.content || '',
      sent_at: item.sent_at || item.created_at,
      status: item.status || 'sent',
      source_table: 'notification_history',
    }));

    // ID 중복 제거 및 최신순 정렬
    const combinedMap = new Map();
    [...list1, ...list2].forEach(item => {
      if (item.id && !combinedMap.has(item.id)) {
        combinedMap.set(item.id, item);
      }
    });

    const combined = Array.from(combinedMap.values()).sort((a: any, b: any) => {
      const timeA = new Date(a.sent_at || 0).getTime();
      const timeB = new Date(b.sent_at || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({ data: combined });
  } catch (err: any) {
    console.error('SMS 메시지 이력 조회 실패:', err);
    return NextResponse.json({ data: [], error: err?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { customer_id, content, status } = body;
  if (!customer_id || !content) {
    return NextResponse.json({ error: 'customer_id, content는 필수입니다.' }, { status: 400 });
  }
  const supabase = createClient();
  const { error } = await supabase
    .from('sms_messages')
    .insert([{ customer_id, content, status: status || 'pending' }]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const table = searchParams.get('table');
  if (!id) {
    return NextResponse.json({ error: 'id 파라미터가 필요합니다.' }, { status: 400 });
  }
  const supabase = createClient();
  const db = supabase as any;

  try {
    if (table === 'notification_history') {
      await db.from('notification_history').delete().eq('id', id);
    } else if (table === 'sms_messages') {
      await db.from('sms_messages').delete().eq('id', id);
    } else {
      await db.from('sms_messages').delete().eq('id', id);
      await db.from('notification_history').delete().eq('id', id);
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('SMS 이력 삭제 실패:', err);
    return NextResponse.json({ error: err?.message || '삭제 실패' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// 무효 처리 (void): 문서는 삭제하지 않고 상태만 전환 (감사 추적)
export async function POST(request: Request, context: any) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const supabase = createServerClient(token);

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const { data: stmt } = await supabase
      .from('transaction_statements')
      .select('status')
      .eq('id', id)
      .single();

    if (!stmt) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (stmt.status === 'voided') {
      return NextResponse.json({ error: '이미 무효 처리된 문서입니다.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('transaction_statements')
      .update({
        status: 'voided',
        voided_at: new Date().toISOString(),
        void_reason: body.reason || null,
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}

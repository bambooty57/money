import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// 공개: 본인 인증 (생년월일 6자리 또는 전화번호 뒷 4자리)
// 잠금/실패 카운트/열람 기록은 RPC(verify_statement_access) 내부에서 처리
export async function POST(request: Request, context: any) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const authValue = (body.auth || '').trim();

    if (!authValue) {
      return NextResponse.json({ error: '인증값을 입력해 주세요.' }, { status: 400 });
    }

    const supabase = createClient();
    const { data, error } = await supabase.rpc('verify_statement_access', {
      p_id: id,
      p_auth: authValue,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}

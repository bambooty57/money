import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// 공개: 문서 기본 정보 조회 (인증 전 화면 표시용, 민감정보 제외)
// RLS로 테이블 직접 접근이 차단되므로 security definer RPC 사용
export async function GET(request: Request, context: any) {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    const { data, error } = await supabase.rpc('get_statement_public_info', { p_id: id });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const info = data as Record<string, any> | null;
    if (!info?.found) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json(info);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}

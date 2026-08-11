import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// 인증된 Supabase 클라이언트 확보 (Bearer 토큰 필수 — RLS authenticated 정책)
function getAuthedClient(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  return createServerClient(token);
}

// 문서번호 채번: ST-YYYY-MM-NNNN (월별 일련, UNIQUE 충돌 시 재시도)
async function generateDocumentNo(supabase: any): Promise<string> {
  const now = new Date();
  const prefix = `ST-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data } = await supabase
      .from('transaction_statements')
      .select('document_no')
      .like('document_no', `${prefix}%`)
      .order('document_no', { ascending: false })
      .limit(1);

    let nextSeq = 1;
    if (data && data.length > 0) {
      const lastSeq = parseInt(data[0].document_no.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }
    const candidate = `${prefix}${String(nextSeq + attempt).padStart(4, '0')}`;

    // 존재 여부 확인
    const { data: existing } = await supabase
      .from('transaction_statements')
      .select('id')
      .eq('document_no', candidate)
      .limit(1);
    if (!existing || existing.length === 0) return candidate;
  }
  // 최후 수단: 랜덤 접미사
  return `${prefix}${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

// POST: 서명 대기(pending) 문서 생성 → { id, document_no }
export async function POST(request: Request) {
  try {
    const supabase = getAuthedClient(request);
    if (!supabase) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { customer_id } = body;
    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id가 필요합니다.' }, { status: 400 });
    }

    // 생성자 ID 확보 (선택적)
    let createdBy: string | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      createdBy = data?.user?.id || null;
    } catch { /* 무시 */ }

    const documentNo = await generateDocumentNo(supabase);

    const { data, error } = await supabase
      .from('transaction_statements')
      .insert({
        document_no: documentNo,
        customer_id,
        status: 'pending',
        created_by: createdBy,
      })
      .select('id, document_no')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id: data.id, document_no: data.document_no });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}

// GET: 고객별 서명 이력 목록 (?customer_id=...)
export async function GET(request: Request) {
  try {
    const supabase = getAuthedClient(request);
    if (!supabase) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    if (!customerId) {
      return NextResponse.json({ error: 'customer_id가 필요합니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('transaction_statements')
      .select('id, document_no, customer_id, signer_name, status, signed_at, expires_at, sms_sent_at, sms_to, resend_count, viewed_at, view_count, view_failed_count, locked_until, voided_at, void_reason, total_amount, total_paid, total_unpaid, transaction_count, pdf_size, file_hash, consent_version, consent_agreed_at, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}

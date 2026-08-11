import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendSmsMessage, getAppBaseUrl } from '@/lib/sms';
import { LINK_EXPIRY_DAYS } from '@/lib/esign-constants';

// 링크 재발송: 만료기한 30일 갱신 + 문자 재발송 (번호 수정 가능)
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
    const overridePhone = (body.phone || '').replace(/[^0-9]/g, '');

    const { data: stmt, error: fetchError } = await supabase
      .from('transaction_statements')
      .select('id, customer_id, document_no, status')
      .eq('id', id)
      .single();

    if (fetchError || !stmt) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (stmt.status !== 'signed') {
      return NextResponse.json({ error: '서명 완료된 문서만 재발송할 수 있습니다.' }, { status: 400 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('name, mobile, ssn')
      .eq('id', stmt.customer_id)
      .single();

    const ssnDigits = (customer?.ssn || '').replace(/[^0-9]/g, '');
    const authMethod = ssnDigits.length >= 6 ? 'ssn' : 'phone';
    const targetPhone = overridePhone || (customer?.mobile || '').replace(/[^0-9]/g, '');

    if (targetPhone.length < 10) {
      return NextResponse.json({ error: '발송할 휴대폰 번호가 없습니다. 번호를 입력해 주세요.' }, { status: 400 });
    }

    // 만료기한 갱신 + 재발송
    const expiresAt = new Date(Date.now() + LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const baseUrl = getAppBaseUrl();
    const authHint = authMethod === 'ssn' ? '생년월일 6자리' : '전화번호 뒷 4자리';
    const message =
      `[구보다농기계 영암대리점]\n` +
      `${customer?.name || ''}님, 서명하신 거래명세서입니다. (재발송)\n` +
      `문서번호: ${stmt.document_no}\n` +
      `${baseUrl}/statement/view/${id}\n` +
      `※ ${authHint} 입력 후 열람 (${LINK_EXPIRY_DAYS}일간 유효)\n` +
      `문의: 010-2602-3276`;

    const result = await sendSmsMessage(targetPhone, message);
    if (!result.ok) {
      return NextResponse.json({ error: `문자 발송 실패: ${result.error}` }, { status: 500 });
    }

    await supabase
      .from('transaction_statements')
      .update({
        expires_at: expiresAt.toISOString(),
        sms_sent_at: new Date().toISOString(),
        sms_to: targetPhone,
        // 재발송 횟수는 별도 증가 (SQL 직접 증가가 어려워 현재값+1 조회 방식 대신 RPC 없이 처리)
      })
      .eq('id', id);

    // resend_count 증가 (읽기-쓰기)
    const { data: cur } = await supabase
      .from('transaction_statements')
      .select('resend_count')
      .eq('id', id)
      .single();
    await supabase
      .from('transaction_statements')
      .update({ resend_count: (cur?.resend_count || 0) + 1 })
      .eq('id', id);

    return NextResponse.json({ ok: true, expires_at: expiresAt.toISOString(), sent_to: targetPhone });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}

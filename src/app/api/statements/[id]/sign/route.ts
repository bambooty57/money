import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendSmsMessage, getAppBaseUrl } from '@/lib/sms';
import { LINK_EXPIRY_DAYS } from '@/lib/esign-constants';
import crypto from 'crypto';

// 서명 완료 처리: PDF 저장 + 해시 + signed 전환 + 만료 설정 + SMS 자동 1회 발송
export async function POST(request: Request, context: any) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const supabase = createServerClient(token);

    const { id } = await context.params;
    const body = await request.json();
    const { pdfBase64, snapshot } = body;

    if (!pdfBase64) {
      return NextResponse.json({ error: 'PDF 데이터가 필요합니다.' }, { status: 400 });
    }

    // 1. pending 상태 확인 + 고객 정보 조회
    const { data: stmt, error: fetchError } = await supabase
      .from('transaction_statements')
      .select('id, customer_id, document_no, status, signature_data')
      .eq('id', id)
      .single();

    if (fetchError || !stmt) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (stmt.status !== 'pending') {
      return NextResponse.json({ error: '이미 처리된 문서입니다.' }, { status: 409 });
    }
    if (!stmt.signature_data) {
      return NextResponse.json({ error: '서명 이미지가 먼저 저장되어야 합니다.' }, { status: 400 });
    }

    // 2. PDF 바이트 + SHA-256 해시 (저장되는 실제 바이트 기준)
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const byteaHex = '\\x' + pdfBuffer.toString('hex');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // 3. signed 전환
    const { error: updateError } = await supabase
      .from('transaction_statements')
      .update({
        pdf_data: byteaHex,
        pdf_size: pdfBuffer.length,
        file_hash: fileHash,
        total_amount: snapshot?.total_amount || 0,
        total_paid: snapshot?.total_paid || 0,
        total_unpaid: snapshot?.total_unpaid || 0,
        transaction_count: snapshot?.transaction_count || 0,
        status: 'signed',
        signed_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending');

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 4. 고객 정보 조회 (인증 방식 + 문자 발송 대상)
    const { data: customer } = await supabase
      .from('customers')
      .select('name, mobile, ssn')
      .eq('id', stmt.customer_id)
      .single();

    const ssnDigits = (customer?.ssn || '').replace(/[^0-9]/g, '');
    const mobileDigits = (customer?.mobile || '').replace(/[^0-9]/g, '');
    const authMethod = ssnDigits.length >= 6 ? 'ssn' : (mobileDigits.length >= 4 ? 'phone' : 'none');

    // 5. SMS 자동 1회 발송 (휴대폰 번호가 있을 때만)
    let sms: { sent: boolean; reason?: string; error?: string } = { sent: false };
    if (mobileDigits.length >= 10) {
      const baseUrl = getAppBaseUrl();
      const authHint = authMethod === 'ssn' ? '생년월일 6자리' : '전화번호 뒷 4자리';
      const message =
        `[구보다농기계 영암대리점]\n` +
        `${customer?.name || ''}님, 서명하신 거래명세서입니다.\n` +
        `문서번호: ${stmt.document_no}\n` +
        `${baseUrl}/statement/view/${id}\n` +
        `※ ${authHint} 입력 후 열람 (${LINK_EXPIRY_DAYS}일간 유효)\n` +
        `문의: 010-2602-3276`;

      const result = await sendSmsMessage(mobileDigits, message);
      if (result.ok) {
        sms = { sent: true };
        await supabase
          .from('transaction_statements')
          .update({ sms_sent_at: new Date().toISOString(), sms_to: mobileDigits })
          .eq('id', id);
      } else {
        sms = { sent: false, reason: 'failed', error: result.error };
      }
    } else {
      sms = { sent: false, reason: 'no_phone' };
    }

    return NextResponse.json({
      ok: true,
      document_no: stmt.document_no,
      auth_method: authMethod,
      sms,
    });
  } catch (error: any) {
    console.error('서명 완료 처리 오류:', error);
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}

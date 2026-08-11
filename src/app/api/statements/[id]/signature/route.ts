import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// 서명 원본 PNG 선저장 (현장 네트워크 실패 대비 — 서명 이미지 최우선 보존)
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
    const { signatureDataUrl, signerName, consentAgreedAt, consentVersion } = body;

    if (!signatureDataUrl) {
      return NextResponse.json({ error: '서명 이미지가 필요합니다.' }, { status: 400 });
    }

    // base64 → bytea hex
    const base64 = signatureDataUrl.includes(',') ? signatureDataUrl.split(',')[1] : signatureDataUrl;
    const sigBuffer = Buffer.from(base64, 'base64');
    const byteaHex = '\\x' + sigBuffer.toString('hex');

    const { error } = await supabase
      .from('transaction_statements')
      .update({
        signature_data: byteaHex,
        signer_name: signerName || null,
        consent_agreed_at: consentAgreedAt || new Date().toISOString(),
        consent_version: consentVersion || null,
      })
      .eq('id', id)
      .eq('status', 'pending');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}

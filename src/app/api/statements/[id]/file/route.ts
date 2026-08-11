import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// 관리자용 서명본 PDF 다운로드 (인증 필수, 만료와 무관하게 열람 가능)
export async function GET(request: Request, context: any) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const supabase = createServerClient(token);

    const { id } = await context.params;

    const { data: stmt, error } = await supabase
      .from('transaction_statements')
      .select('document_no, pdf_data')
      .eq('id', id)
      .single();

    if (error || !stmt || !stmt.pdf_data) {
      return NextResponse.json({ error: 'PDF를 찾을 수 없습니다.' }, { status: 404 });
    }

    // bytea hex → 바이너리 (PostgREST는 bytea를 "\x..." hex 문자열로 반환)
    const hex = (stmt.pdf_data as unknown as string).replace(/^\\x/, '');
    const pdfBuffer = Buffer.from(hex, 'hex');

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(stmt.document_no)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}

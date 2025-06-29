import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const customer_id = params.id;
    const body = await request.json();
    // id, customer_type_custom 필드는 DB에 저장하지 않음
    const { id, customer_type_custom, ...updateData } = body;

    // 실제 DB 업데이트 예시 (컬럼명/테이블명에 맞게 수정)
    const { error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', customer_id);

    if (error) {
      console.error('DB update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PUT handler error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: any, context: any) {
  const { params } = await context;
  const customer_id = params.id;
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customer_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
} 
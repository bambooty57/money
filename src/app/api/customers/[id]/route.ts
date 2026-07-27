import { NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';

export async function GET(request: any, context: any) {
  const { id } = await context.params;
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PUT(request: any, context: any) {
  try {
    // Authorization 헤더에서 토큰 추출 (선택적)
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    // 토큰이 있으면 인증된 클라이언트, 없으면 서비스 클라이언트 사용
    const authenticatedSupabase = token ? createServerClient(token) : supabase;
    
    const { id: customer_id } = await context.params;
    const body = await request.json();
    
    // customers 테이블에 존재하는 필드만 허용
    const allowedFields = [
      'name', 'phone', 'mobile', 'ssn', 'business_no', 'business_name',
      'representative_name', 'address', 'address_road', 'address_jibun',
      'zipcode', 'customer_type', 'customer_type_multi', 'fax', 'memo'
    ];
    
    // NOT NULL 필드 (빈 문자열 허용, null 불가)
    const notNullFields = ['name', 'phone'];
    
    // 허용된 필드만 추출
    const updateData: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in body && body[key] !== undefined) {
        if (notNullFields.includes(key)) {
          // NOT NULL 필드: 값 그대로 유지 (빈 문자열도 허용)
          updateData[key] = body[key];
        } else {
          // NULLABLE 필드: 빈 문자열은 null로 변환
          updateData[key] = body[key] === '' ? null : body[key];
        }
      }
    }

    // 디버깅: 요청 데이터 로깅
    console.log('🔍 고객 수정 요청:', {
      customer_id,
      updateData,
      bodyKeys: Object.keys(body),
      allowedFields
    });

    // 실제 DB 업데이트 예시 (컬럼명/테이블명에 맞게 수정)
    const { data, error } = await (authenticatedSupabase as any)
      .from('customers')
      .update(updateData)
      .eq('id', customer_id)
      .select()
      .single();

    if (error) {
      console.error('❌ DB update error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        updateData
      });
      return NextResponse.json({ 
        error: error.message || '고객 정보 수정 실패',
        details: error.details,
        hint: error.hint
      }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('PUT handler error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: any, context: any) {
  try {
    // Authorization 헤더에서 토큰 추출 (선택적)
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    // 토큰이 있으면 인증된 클라이언트, 없으면 서비스 클라이언트 사용
    const authenticatedSupabase = token ? createServerClient(token) : supabase;
    
    const { id: customer_id } = await context.params;

    // 1. 해당 고객의 모든 파일 조회
    const { data: files } = await authenticatedSupabase
      .from('files')
      .select('id, url')
      .eq('customer_id', customer_id);

    // 2. Supabase Storage에서 실제 파일들 삭제
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          if (file.url && file.url.includes('/storage/v1/object/public/')) {
            const parts = file.url.split('/storage/v1/object/public/');
            if (parts.length > 1) {
              const pathParts = parts[1].split('/');
              const bucket = pathParts[0];
              const path = pathParts.slice(1).join('/');
              await authenticatedSupabase.storage.from(bucket).remove([path]);
            }
          }
        } catch (err) {
          console.warn('Storage 파일 삭제 중 오류:', err);
        }
      }
    }

    // 3. 거래 ID 목록 조회 및 거래/입금 삭제
    const { data: transactions } = await authenticatedSupabase.from('transactions').select('id').eq('customer_id', customer_id);
    const txIds = (transactions || []).map(tx => tx.id);
    if (txIds.length > 0) {
      await authenticatedSupabase.from('payments').delete().in('transaction_id', txIds);
      await authenticatedSupabase.from('files').delete().in('transaction_id', txIds);
      await authenticatedSupabase.from('transactions').delete().in('id', txIds);
    }

    // 4. 연관 테이블 레코드 삭제 (외래키 제약 방지)
    const db = authenticatedSupabase as any;
    await db.from('customer_prospects').delete().eq('customer_id', customer_id);
    await db.from('legal_actions').delete().eq('customer_id', customer_id);
    await db.from('sms_exclusions').delete().eq('customer_id', customer_id);
    await db.from('sms_messages').delete().eq('customer_id', customer_id);
    await db.from('notification_history').delete().eq('customer_id', customer_id);
    await db.from('event_logs').delete().eq('customer_id', customer_id);
    await db.from('contacts').delete().eq('customer_id', customer_id);
    await db.from('files').delete().eq('customer_id', customer_id);

    // 5. customers 테이블에서 고객 삭제
    const { error } = await authenticatedSupabase
      .from('customers')
      .delete()
      .eq('id', customer_id);

    if (error) {
      console.error('Error deleting customer:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedFiles: files?.length || 0 });

  } catch (e: any) {
    console.error('DELETE handler error:', e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
} 
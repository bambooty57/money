import { NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';

export async function GET(request: any, context: any) {
  const { id } = context.params;
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
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token required' }, 
        { status: 401 }
      )
    }
    
    // 인증된 Supabase 클라이언트 생성
    const authenticatedSupabase = createServerClient(token)
    
    const customer_id = context.params.id;
    const body = await request.json();
    
    // customers 테이블에 존재하는 필드만 허용
    const allowedFields = [
      'name', 'phone', 'mobile', 'ssn', 'business_no', 'business_name',
      'representative_name', 'address', 'address_road', 'address_jibun',
      'zipcode', 'customer_type', 'customer_type_multi', 'fax', 'memo'
    ];
    
    // 허용된 필드만 추출하고, undefined/null 값을 null로 변환
    const updateData: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in body && body[key] !== undefined) {
        // 빈 문자열은 null로 변환 (UUID 필드는 null이어야 함)
        updateData[key] = body[key] === '' ? null : body[key];
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
    const { data, error } = await authenticatedSupabase
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
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token required' }, 
        { status: 401 }
      )
    }
    
    // 인증된 Supabase 클라이언트 생성
    const authenticatedSupabase = createServerClient(token)
    
    const customer_id = context.params.id;

    // 1. 해당 고객의 모든 파일 조회
    const { data: files, error: filesError } = await authenticatedSupabase
      .from('files')
      .select('id, url')
      .eq('customer_id', customer_id);

    if (filesError) {
      console.error('Error fetching files:', filesError);
      return NextResponse.json({ error: filesError.message }, { status: 500 });
    }

    // 2. Supabase Storage에서 실제 파일들 삭제
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          // URL에서 파일 경로 추출
          if (file.url && file.url.includes('/storage/v1/object/public/')) {
            const parts = file.url.split('/storage/v1/object/public/');
            if (parts.length > 1) {
              const pathParts = parts[1].split('/');
              const bucket = pathParts[0]; // 'photos'
              const path = pathParts.slice(1).join('/'); // 'customer_photos/uuid/filename.jpg'
              
              console.log('🗑️ Storage 파일 삭제:', { bucket, path });
              const { error: storageError } = await authenticatedSupabase.storage
                .from(bucket)
                .remove([path]);
              
              if (storageError) {
                console.warn('⚠️ Storage 파일 삭제 실패:', storageError);
              }
            }
          }
        } catch (err) {
          console.warn('⚠️ 파일 삭제 중 오류 (계속 진행):', err);
        }
      }

      // 3. files 테이블에서 파일 레코드들 삭제
      const { error: deleteFilesError } = await authenticatedSupabase
        .from('files')
        .delete()
        .eq('customer_id', customer_id);

      if (deleteFilesError) {
        console.error('Error deleting files:', deleteFilesError);
        return NextResponse.json({ error: deleteFilesError.message }, { status: 500 });
      }

      console.log(`✅ ${files.length}개 파일 완전 삭제 완료`);
    }

    // 4. customers 테이블에서 고객 삭제
    const { error } = await authenticatedSupabase
      .from('customers')
      .delete()
      .eq('id', customer_id);

    if (error) {
      console.error('Error deleting customer:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ 고객 및 관련 파일 완전 삭제 완료');
    return NextResponse.json({ success: true, deletedFiles: files?.length || 0 });

  } catch (e) {
    console.error('DELETE handler error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
} 
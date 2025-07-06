import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request, context: { params: { id: string } }) {
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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const customer_id = params.id;
    const body = await request.json();
    // id, customer_type_custom 필드는 DB에 저장하지 않음
    const { id, customer_type_custom, ...updateData } = body;

    // 실제 DB 업데이트 예시 (컬럼명/테이블명에 맞게 수정)
    const { data, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', customer_id)
      .select()
      .single();

    if (error) {
      console.error('DB update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('PUT handler error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: any, context: any) {
  try {
    const { params } = await context;
    const customer_id = params.id;

    // 1. 해당 고객의 모든 파일 조회
    const { data: files, error: filesError } = await supabase
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
              const { error: storageError } = await supabase.storage
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
      const { error: deleteFilesError } = await supabase
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
    const { error } = await supabase
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
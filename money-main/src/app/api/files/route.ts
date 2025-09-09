import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customer_id = searchParams.get('customer_id');
    let query = supabase.from('files').select('*,customers(*)').order('created_at', { ascending: false });
    if (customer_id) query = query.eq('customer_id', customer_id);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isValidUUID = (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
    const body = await req.json();
    if (!body.customer_id || !isValidUUID(body.customer_id)) {
      return NextResponse.json({ error: '유효한 customer_id가 필요합니다.' }, { status: 400 });
    }
    if (body.transaction_id && !isValidUUID(body.transaction_id)) {
      return NextResponse.json({ error: '유효한 transaction_id가 필요합니다.' }, { status: 400 });
    }
    const { data, error } = await supabase.from('files').insert([body]).select('*,customers(*)').single();
    if (error) {
      console.error('Error creating file:', error);
      return NextResponse.json({ error: error.message || 'Failed to create file' }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating file:', error);
    return NextResponse.json({ error: 'Failed to create file' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token required' }, 
        { status: 401 }
      )
    }
    
    // 인증된 Supabase 클라이언트 생성
    const authenticatedSupabase = createServerClient(token)
    
    const { searchParams } = new URL(req.url);
    const file_id = searchParams.get('file_id');
    if (!file_id) throw new Error('Missing file_id');
    
    // 1. 파일 정보 먼저 조회 (Storage 경로 확인용)
    const { data: fileData, error: fetchError } = await authenticatedSupabase
      .from('files')
      .select('url, name')
      .eq('id', file_id)
      .single();
    
    if (fetchError) {
      console.error('Error fetching file info:', fetchError);
      throw new Error('파일 정보를 찾을 수 없습니다');
    }
    
    // 2. Supabase Storage에서 실제 파일 삭제
    if (fileData?.url) {
      try {
        // URL에서 파일 경로 추출
        const url = fileData.url;
        let filePath = '';
        
        // Supabase Storage URL 패턴 분석
        if (url.includes('/storage/v1/object/public/')) {
          // 예: https://xxx.supabase.co/storage/v1/object/public/photos/customer_photos/uuid/filename.jpg
          const parts = url.split('/storage/v1/object/public/');
          if (parts.length > 1) {
            const pathParts = parts[1].split('/');
            const bucket = pathParts[0]; // 'photos'
            const path = pathParts.slice(1).join('/'); // 'customer_photos/uuid/filename.jpg'
            filePath = path;
            
            console.log('🗑️ Storage 파일 삭제 시도:', { bucket, path: filePath });
            
            const { error: storageError } = await authenticatedSupabase.storage
              .from(bucket)
              .remove([filePath]);
            
            if (storageError) {
              console.warn('⚠️ Storage 파일 삭제 실패 (파일이 이미 없을 수 있음):', storageError);
              // Storage 삭제 실패해도 DB 레코드는 삭제 진행
            } else {
              console.log('✅ Storage 파일 삭제 성공');
            }
          }
        }
      } catch (storageError) {
        console.warn('⚠️ Storage 파일 삭제 중 오류 (계속 진행):', storageError);
        // Storage 삭제 실패해도 DB 레코드는 삭제 진행
      }
    }
    
    // 3. files 테이블에서 레코드 삭제
    const { data, error } = await authenticatedSupabase.from('files').delete().eq('id', file_id);
    if (error) throw error;
    
    console.log('✅ 파일 완전 삭제 완료 (Storage + DB)');
    return NextResponse.json({ success: true, message: '파일이 완전히 삭제되었습니다' });
    
  } catch (error) {
    console.error('Error deleting file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete file';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 
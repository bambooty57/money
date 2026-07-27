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
    const contentType = req.headers.get('content-type') || '';

    // 1. FormData 요청 처리 (서버 사이드 Storage 업로드 + DB 저장)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const customerId = formData.get('customer_id') as string | null;

      if (!file || !customerId || !isValidUUID(customerId)) {
        return NextResponse.json({ error: '유효한 file과 customer_id가 필요합니다.' }, { status: 400 });
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `customer_photos/${customerId}/${Date.now()}_${safeName}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Storage 업로드 (서버 권한으로 바이패스)
      const { data: stData, error: stError } = await supabase.storage
        .from('photos')
        .upload(filePath, buffer, {
          contentType: file.type || 'image/jpeg',
          upsert: true,
        });

      if (stError) {
        console.error('Storage 업로드 실패:', stError);
        return NextResponse.json({ error: `Storage 업로드 실패: ${stError.message}` }, { status: 500 });
      }

      const { data: publicUrl } = supabase.storage.from('photos').getPublicUrl(filePath);

      // files 테이블 저장
      const { data: fileRecord, error: fileError } = await supabase
        .from('files')
        .insert([{
          customer_id: customerId,
          name: safeName,
          url: publicUrl.publicUrl,
          type: file.type || 'image/jpeg',
        }])
        .select()
        .single();

      if (fileError) {
        console.error('files 테이블 저장 실패:', fileError);
        return NextResponse.json({ error: fileError.message }, { status: 500 });
      }

      return NextResponse.json(fileRecord, { status: 201 });
    }

    // 2. JSON 요청 처리
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
  } catch (error: any) {
    console.error('Error creating file:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create file' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const authenticatedSupabase = token ? createServerClient(token) : supabase;

    const { searchParams } = new URL(req.url);
    const file_id = searchParams.get('file_id');
    if (!file_id) throw new Error('Missing file_id');

    // 1. 파일 정보 조회
    const { data: fileData, error: fetchError } = await authenticatedSupabase
      .from('files')
      .select('url, name')
      .eq('id', file_id)
      .single();

    if (fetchError) {
      console.error('Error fetching file info:', fetchError);
      throw new Error('파일 정보를 찾을 수 없습니다');
    }

    // 2. Storage에서 파일 삭제
    if (fileData?.url) {
      try {
        const url = fileData.url;
        if (url.includes('/storage/v1/object/public/')) {
          const parts = url.split('/storage/v1/object/public/');
          if (parts.length > 1) {
            const pathParts = parts[1].split('/');
            const bucket = pathParts[0];
            const path = pathParts.slice(1).join('/');

            await authenticatedSupabase.storage
              .from(bucket)
              .remove([path]);
          }
        }
      } catch (storageError) {
        console.warn('Storage 파일 삭제 중 오류 (계속 진행):', storageError);
      }
    }

    // 3. DB 삭제
    const db = authenticatedSupabase as any;
    const { error } = await db.from('files').delete().eq('id', file_id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: '파일이 완전히 삭제되었습니다' });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete file' }, { status: 500 });
  }
}
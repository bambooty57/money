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
    const contentType = req.headers.get('content-type') || '';

    // 1. FormData 요청 처리
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const customerId = formData.get('customer_id') as string | null;

      if (!file || !customerId) {
        return NextResponse.json({ error: 'file과 customer_id가 필요합니다.' }, { status: 400 });
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `customer_photos/${customerId}/${Date.now()}_${safeName}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let finalUrl = '';

      // Storage 업로드 시도
      try {
        const { data: stData, error: stError } = await supabase.storage
          .from('photos')
          .upload(filePath, buffer, {
            contentType: file.type || 'image/jpeg',
            upsert: true,
          });

        if (!stError && stData) {
          const { data: publicUrl } = supabase.storage.from('photos').getPublicUrl(filePath);
          finalUrl = publicUrl.publicUrl;
        }
      } catch (stEx) {
        console.warn('Storage 업로드 시도 실패 (Data URL 자동 전환):', stEx);
      }

      // Storage 업로드 불가 시 Data URL 전환 (100% 저장 성공 보장)
      if (!finalUrl) {
        const mimeType = file.type || 'image/jpeg';
        finalUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
      }

      const { data: fileRecord, error: fileError } = await supabase
        .from('files')
        .insert([{
          customer_id: customerId,
          name: safeName,
          url: finalUrl,
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

    // 2. JSON 요청 처리 (Data URL 혹은 메타데이터 직접 저장)
    const body = await req.json();
    if (!body.customer_id) {
      return NextResponse.json({ error: 'customer_id가 필요합니다.' }, { status: 400 });
    }

    const { data, error } = await supabase.from('files').insert([{
      customer_id: body.customer_id,
      name: body.name || 'photo.jpg',
      url: body.url,
      type: body.type || 'image/jpeg',
      transaction_id: body.transaction_id || null,
    }]).select('*,customers(*)').single();

    if (error) {
      console.error('files 테이블 저장 실패:', error);
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

    // 2. Storage 삭제
    if (fileData?.url && !fileData.url.startsWith('data:')) {
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

    // 3. DB 레코드 삭제
    const db = authenticatedSupabase as any;
    const { error } = await db.from('files').delete().eq('id', file_id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: '파일이 완전히 삭제되었습니다' });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete file' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Supabase Storage에서 실제 파일 삭제 헬퍼 함수
async function deleteStorageFiles(authenticatedSupabase: any, files: Array<{ url?: string | null }>) {
  for (const file of files) {
    if (!file.url) continue;
    
    try {
      // URL에서 파일 경로 추출
      if (file.url.includes('/storage/v1/object/public/')) {
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
}

export async function POST(request: Request) {
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
  
  const body = await request.json();
  const id = body.customerId;
  
  if (!id) {
    return NextResponse.json({ error: '고객 ID가 필요합니다.' }, { status: 400 });
  }

  console.log('🗑️ POST DELETE 요청 수신:', { customerId: id });

  try {
    // 1. 고객의 거래 ID 목록 조회
    const { data: transactions, error: txError } = await authenticatedSupabase.from('transactions').select('id').eq('customer_id', id);
    if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });
    const txIds = (transactions || []).map(tx => tx.id);

    // 2. 거래 관련 파일들 조회 (삭제 전에 Storage 파일 경로를 얻기 위해)
    let transactionFiles: Array<{ url?: string | null }> = [];
    if (txIds.length > 0) {
      const { data: txFiles, error: txFilesError } = await authenticatedSupabase
        .from('files')
        .select('url')
        .in('transaction_id', txIds);
      if (txFilesError) {
        console.warn('⚠️ 거래 관련 파일 조회 실패:', txFilesError);
      } else {
        transactionFiles = txFiles || [];
      }
    }

    // 3. 고객 직접 연결된 파일들 조회 (삭제 전에 Storage 파일 경로를 얻기 위해)
    const { data: customerFiles, error: customerFilesError } = await authenticatedSupabase
      .from('files')
      .select('url')
      .eq('customer_id', id);
    if (customerFilesError) {
      console.warn('⚠️ 고객 파일 조회 실패:', customerFilesError);
    }

    const allFiles = [...transactionFiles, ...(customerFiles || [])];

    // 4. Supabase Storage에서 실제 파일들 삭제
    await deleteStorageFiles(authenticatedSupabase, allFiles);

    // 5. payments에서 해당 거래 ID들에 연결된 입금 기록 삭제
    if (txIds.length > 0) {
      const { error: paymentError } = await authenticatedSupabase.from('payments').delete().in('transaction_id', txIds);
      if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    // 6. files 테이블에서 파일 레코드들 삭제 (거래 관련)
    if (txIds.length > 0) {
      const { error: fileError } = await authenticatedSupabase.from('files').delete().in('transaction_id', txIds);
      if (fileError) return NextResponse.json({ error: fileError.message }, { status: 500 });
    }

    // 7. files 테이블에서 파일 레코드들 삭제 (고객 직접 연결)
    const { error: customerFileError } = await authenticatedSupabase.from('files').delete().eq('customer_id', id);
    if (customerFileError) return NextResponse.json({ error: customerFileError.message }, { status: 500 });

    // 8. 거래 삭제
    if (txIds.length > 0) {
      const { error: txDelError } = await authenticatedSupabase.from('transactions').delete().in('id', txIds);
      if (txDelError) return NextResponse.json({ error: txDelError.message }, { status: 500 });
    }

    // 9. 고객 삭제
    console.log('🗑️ 고객 삭제 시도:', { customerId: id });
    const { data: deletedCustomer, error } = await authenticatedSupabase
      .from('customers')
      .delete()
      .eq('id', id)
      .select();
    
    console.log('📊 삭제 결과:', { 
      deletedCustomer, 
      error, 
      deletedCount: deletedCustomer?.length || 0 
    });
    
    if (error) {
      console.error('❌ 고객 삭제 실패:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // 삭제 확인: 실제로 삭제되었는지 확인
    if (!deletedCustomer || deletedCustomer.length === 0) {
      console.warn('⚠️ 고객 삭제 확인: 삭제된 레코드가 없습니다. RLS 정책을 확인하세요.');
      // 삭제 전 고객 존재 여부 확인
      const { data: checkCustomer } = await authenticatedSupabase
        .from('customers')
        .select('id, name')
        .eq('id', id)
        .single();
      console.log('🔍 삭제 후 고객 확인:', { checkCustomer, stillExists: !!checkCustomer });
      
      return NextResponse.json({ 
        error: '고객 삭제에 실패했습니다. 권한을 확인하세요.',
        warning: 'RLS 정책으로 인해 삭제되지 않았을 수 있습니다.',
        stillExists: !!checkCustomer
      }, { status: 403 });
    }
    
    console.log(`✅ 고객 및 관련 데이터 완전 삭제 완료 (파일 ${allFiles.length}개, 고객 ID: ${id})`);
    return NextResponse.json({ 
      success: true, 
      deletedFiles: allFiles.length,
      deletedCustomerId: id
    });
  } catch (error) {
    console.error('❌ 고객 삭제 중 오류:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '고객 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}


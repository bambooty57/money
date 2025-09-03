import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    // 1. files 테이블의 모든 레코드 조회
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*');
    
    if (filesError) {
      return NextResponse.json({ error: 'files 테이블 조회 실패', details: filesError }, { status: 500 });
    }
    
    // 2. ac776 포함된 파일들 찾기
    const ac776Files = files.filter(f => f.url && f.url.includes('ac776'));
    
    // 3. 고객 테이블에서 해당 ID들 확인
    const customerIds = ac776Files.map(f => f.customer_id).filter((id): id is string => Boolean(id));
    const transactionIds = ac776Files.map(f => f.transaction_id).filter((id): id is string => Boolean(id));
    
    let connectedCustomers: any[] = [];
    let connectedTransactions: any[] = [];
    
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds);
      
      connectedCustomers = customers || [];
    }
    
    if (transactionIds.length > 0) {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('id, customer_id, amount, description')
        .in('id', transactionIds);
      
      connectedTransactions = transactions || [];
    }
    
    // 4. 모든 고객 목록 확인
    const { data: allCustomers } = await supabase
      .from('customers')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });
    
    // 5. orphaned files 찾기 (고객이나 거래가 삭제된 파일들)
    const orphanedFiles = [];
    for (const file of files) {
      let isOrphaned = false;
      
      if (file.customer_id) {
        const customerExists = allCustomers?.some(c => c.id === file.customer_id);
        if (!customerExists) {
          isOrphaned = true;
        }
      }
      
      if (file.transaction_id) {
        const { data: txExists } = await supabase
          .from('transactions')
          .select('id')
          .eq('id', file.transaction_id)
          .single();
        
        if (!txExists) {
          isOrphaned = true;
        }
      }
      
      if (isOrphaned) {
        orphanedFiles.push(file);
      }
    }
    
    // cleanup 액션 실행
    if (action === 'cleanup' && orphanedFiles.length > 0) {
      const deletedFiles = [];
      const failedFiles = [];
      
      for (const file of orphanedFiles) {
        try {
          // files 테이블에서 삭제
          const { error } = await supabase
            .from('files')
            .delete()
            .eq('id', file.id);
          
          if (error) {
            failedFiles.push({ file, error });
          } else {
            deletedFiles.push(file);
          }
        } catch (err) {
          failedFiles.push({ file, error: err });
        }
      }
      
      return NextResponse.json({
        message: '정리 완료',
        totalFiles: files.length,
        ac776Files: ac776Files.length,
        orphanedFiles: orphanedFiles.length,
        deletedFiles: deletedFiles.length,
        failedFiles: failedFiles.length,
        deletedFilesList: deletedFiles,
        failedFilesList: failedFiles,
        allCustomers,
        connectedCustomers,
        connectedTransactions
      });
    }
    
    return NextResponse.json({
      totalFiles: files.length,
      ac776Files: ac776Files.length,
      ac776FileDetails: ac776Files,
      orphanedFiles: orphanedFiles.length,
      orphanedFileDetails: orphanedFiles,
      allCustomers,
      connectedCustomers,
      connectedTransactions,
      analysis: {
        message: ac776Files.length > 0 
          ? `ac776 폴더는 ${ac776Files.length}개 파일과 연결됨`
          : 'ac776 폴더와 연결된 파일 없음',
        customerCount: allCustomers?.length || 0,
        orphanedCount: orphanedFiles.length
      }
    });
    
  } catch (error) {
    console.error('Storage cleanup 에러:', error);
    return NextResponse.json(
      { error: 'Storage cleanup 실패', details: error },
      { status: 500 }
    );
  }
} 
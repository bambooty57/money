import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cqdjkxllgiedjqxryoq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZGpreGxsZ2llZGpxeHJ5b3EiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDMyNDg5NCwiZXhwIjoyMDQ5OTAwODk0fQ.7RJUEr-TqeKq2_1LdBLf4RGS3-R1LqdH1cdhgW_-oK4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorageFiles() {
  console.log('🔍 Storage 파일 분석 시작...\n');
  
  try {
    // 1. files 테이블의 모든 레코드 조회
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*');
    
    if (filesError) {
      console.error('❌ files 테이블 조회 실패:', filesError);
      return;
    }
    
    console.log(`📁 files 테이블 총 레코드: ${files.length}개\n`);
    
    // 2. ac776 포함된 파일들 찾기
    const ac776Files = files.filter(f => f.url && f.url.includes('ac776'));
    
    console.log(`🎯 'ac776' 포함된 파일들: ${ac776Files.length}개`);
    ac776Files.forEach((file, idx) => {
      console.log(`  ${idx + 1}. ID: ${file.id}`);
      console.log(`     고객 ID: ${file.customer_id || '없음'}`);
      console.log(`     거래 ID: ${file.transaction_id || '없음'}`);
      console.log(`     파일명: ${file.name || '없음'}`);
      console.log(`     URL: ${file.url}`);
      console.log(`     생성일: ${file.created_at}\n`);
    });
    
    // 3. 고객 테이블에서 해당 ID들 확인
    const customerIds = ac776Files.map(f => f.customer_id).filter(Boolean);
    const transactionIds = ac776Files.map(f => f.transaction_id).filter(Boolean);
    
    if (customerIds.length > 0) {
      console.log('👥 연결된 고객들 확인:');
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds);
      
      customers?.forEach(customer => {
        console.log(`  - ${customer.name} (ID: ${customer.id})`);
      });
      console.log('');
    }
    
    if (transactionIds.length > 0) {
      console.log('💰 연결된 거래들 확인:');
      const { data: transactions } = await supabase
        .from('transactions')
        .select('id, customer_id, amount, description')
        .in('id', transactionIds);
      
      transactions?.forEach(tx => {
        console.log(`  - 거래 ID: ${tx.id}, 고객 ID: ${tx.customer_id}, 금액: ${tx.amount}, 설명: ${tx.description}`);
      });
      console.log('');
    }
    
    // 4. 모든 고객 목록 확인
    const { data: allCustomers } = await supabase
      .from('customers')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });
    
    console.log(`👥 전체 고객 목록: ${allCustomers?.length || 0}개`);
    allCustomers?.forEach((customer, idx) => {
      console.log(`  ${idx + 1}. ${customer.name} (ID: ${customer.id}) - ${customer.created_at}`);
    });
    console.log('');
    
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
    
    if (orphanedFiles.length > 0) {
      console.log(`🗑️ 정리 대상 orphaned files: ${orphanedFiles.length}개`);
      orphanedFiles.forEach((file, idx) => {
        console.log(`  ${idx + 1}. ${file.name} (고객: ${file.customer_id}, 거래: ${file.transaction_id})`);
        console.log(`     URL: ${file.url}`);
      });
      console.log('');
    }
    
    // 6. 삭제 제안
    if (orphanedFiles.length > 0) {
      console.log('💡 해결 방법:');
      console.log('1. 아래 SQL로 orphaned files 삭제:');
      orphanedFiles.forEach(file => {
        console.log(`   DELETE FROM files WHERE id = '${file.id}';`);
      });
      console.log('');
      console.log('2. 또는 /api/files?file_id={id} DELETE API 사용');
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

// 실행
checkStorageFiles(); 
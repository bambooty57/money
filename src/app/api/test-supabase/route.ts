import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('🧪 Supabase 연결 테스트 시작');
    
    // 1. 기본 연결 테스트
    const { data: healthCheck, error: healthError } = await supabase
      .from('customers')
      .select('count')
      .limit(1);
    
    if (healthError) {
      console.error('❌ Supabase 연결 실패:', healthError);
      return NextResponse.json({
        success: false,
        error: 'Supabase 연결 실패',
        details: healthError,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
    // 2. 테이블 존재 확인
    const tables = ['customers', 'transactions', 'payments'];
    const tableTests = [];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table as any)
          .select('*')
          .limit(1);
        
        tableTests.push({
          table,
          exists: !error,
          error: error?.message || null,
          hasData: data && data.length > 0
        });
      } catch (err) {
        tableTests.push({
          table,
          exists: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          hasData: false
        });
      }
    }
    
    // 3. 인증 상태 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('✅ Supabase 연결 테스트 완료');
    
    return NextResponse.json({
      success: true,
      connection: 'OK',
      tables: tableTests,
      auth: {
        user: user ? 'Authenticated' : 'Anonymous',
        error: authError?.message || null
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Supabase 테스트 중 오류:', error);
    return NextResponse.json({
      success: false,
      error: 'Supabase 테스트 실패',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🧪 테스트 API 시작');
    
    return NextResponse.json({
      message: '테스트 API 정상 작동',
      timestamp: new Date().toISOString(),
      data: {
        totalUnpaid: 15000000,
        testCustomers: [
          { name: '테스트 고객 1', amount: 5000000 },
          { name: '테스트 고객 2', amount: 3000000 }
        ]
      }
    });
  } catch (error) {
    console.error('❌ 테스트 API 오류:', error);
    return NextResponse.json({ 
      error: 'Test API failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

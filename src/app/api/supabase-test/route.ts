import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🧪 Supabase 연결 테스트 시작');
    
    // 1. 기본 URL 접근 테스트
    const testUrl = 'https://cqdjkxllgiedjqxryoq.supabase.co/rest/v1/';
    const testHeaders = {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZGpreGxsZ2llZGpxeHJ5b3EiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDMyNDg5NCwiZXhwIjoyMDQ5OTAwODk0fQ.7RJUEr-TqeKq2_1LdBLf4RGS3-R1LqdH1cdhgW_-oK4',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZGpreGxsZ2llZGpxeHJ5b3EiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDMyNDg5NCwiZXhwIjoyMDQ5OTAwODk0fQ.7RJUEr-TqeKq2_1LdBLf4RGS3-R1LqdH1cdhgW_-oK4',
      'Content-Type': 'application/json'
    };
    
    console.log('🔗 테스트 URL:', testUrl);
    console.log('🔑 API 키 첫 20자:', testHeaders.apikey.substring(0, 20) + '...');
    
    // 기본 fetch 테스트
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: testHeaders
    });
    
    console.log('📊 응답 상태:', response.status);
    console.log('📊 응답 헤더:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 응답 오류:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Supabase REST API 연결 실패',
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
    const data = await response.text();
    console.log('✅ 응답 데이터:', data.substring(0, 200) + '...');
    
    return NextResponse.json({
      success: true,
      message: 'Supabase 연결 성공',
      status: response.status,
      dataLength: data.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Supabase 연결 테스트 실패:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Supabase 연결 테스트 실패',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

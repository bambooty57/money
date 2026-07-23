import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// 하드코딩된 Supabase 설정 (환경 변수 문제 해결)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jcqdjkxllgiedjqxryoq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjcWRqa3hsbGdpZWRqcXhyeW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNzI0NTMsImV4cCI6MjA2NTY0ODQ1M30.WQA3Ycqeq8f-4RsWOCwP12iZ4HE-U1oAIpnHh63VJeA';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 인증된 Supabase 클라이언트 생성 헬퍼 함수
function createAuthenticatedClient(accessToken?: string) {
  if (supabaseServiceKey) {
    return createClient<Database>(supabaseUrl, supabaseServiceKey);
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const supabase = createAuthenticatedClient(accessToken);

    // 기종별 통계 조회
    const { data, error } = await supabase
      .from('customer_prospects')
      .select('prospect_device_type');

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stats', details: error.message },
        { status: 500 }
      );
    }

    // 기종별 카운트 계산
    const stats = {
      트랙터: 0,
      콤바인: 0,
      이앙기: 0,
      작업기: 0,
      기타: 0,
      total: data?.length || 0,
    };

    data?.forEach((item) => {
      const type = item.prospect_device_type as keyof typeof stats;
      if (type in stats && type !== 'total') {
        stats[type]++;
      }
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


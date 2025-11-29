import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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


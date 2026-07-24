/**
 * 솔라피 웹훅 라우트
 * 발송 결과 콜백 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

/**
 * POST /api/solapi/webhook
 * 솔라피 발송 결과 웹훅
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 웹훅 서명 검증 (선택적)
    const signature = request.headers.get('x-solapi-signature');
    if (process.env.SOLAPI_WEBHOOK_SECRET && signature) {
      // 서명 검증 로직 구현
      // const isValid = verifyWebhookSignature(body, signature, process.env.SOLAPI_WEBHOOK_SECRET);
      // if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { 
      messageId, 
      status, 
      statusCode, 
      statusMessage,
      to,
      from,
      type,
      sentAt,
      customFields 
    } = body;

    // 알림 이력 업데이트
    if (messageId) {
      const { error } = await getSupabase()
        .from('notification_history')
        .update({
          status: status === 'DELIVERED' ? 'success' : 'failed',
          errorMessage: statusMessage,
          sentAt: sentAt || new Date().toISOString(),
        })
        .eq('messageId', messageId);

      if (error) {
        console.error('알림 이력 업데이트 오류:', error);
      }
    }

    // 로깅
    console.log('솔라피 웹훅 수신:', {
      messageId,
      status,
      statusCode,
      to,
      sentAt,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('웹훅 처리 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

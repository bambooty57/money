/**
 * Message Settings API
 * SMS template get/save
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jcqdjkxllgiedjqxryoq.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjcWRqa3hsbGdpZWRqcXhyeW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNzI0NTMsImV4cCI6MjA2NTY0ODQ1M30.WQA3Ycqeq8f-4RsWOCwP12iZ4HE-U1oAIpnHh63VJeA';
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

const DEFAULT_TEMPLATE = '{customerName}고객님 구보다대리점입니다 매월 정기발송 안내입니다 {month}월{day}일 기준 잔액이 {amount}원 입니다 농협:302-2602-3276-61(정현목)입금 부탁드립니다 자세한 내용은 010-2603-3276으로 상담 주세요';

/**
 * GET /api/message-settings
 * Get current SMS template and send day
 */
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: templateData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'sms_template')
      .single();

    const { data: dayData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'sms_send_day')
      .single();

    const template = templateData?.value || DEFAULT_TEMPLATE;
    const sendDay = dayData?.value ? parseInt(dayData.value, 10) : 25;

    return NextResponse.json({
      success: true,
      data: {
        template,
        sendDay,
        isDefault: !templateData
      }
    });
  } catch (error) {
    console.error('Message settings get error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/message-settings
 * Save SMS template and send day
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { template, sendDay } = body;

    const supabase = getSupabase();

    if (template !== undefined && typeof template === 'string') {
      const { error: templateError } = await supabase
        .from('app_settings')
        .upsert({
          key: 'sms_template',
          value: template,
          description: 'SMS template',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (templateError) {
        console.error('Template save error:', templateError);
        return NextResponse.json(
          { error: templateError.message },
          { status: 500 }
        );
      }
    }

    if (sendDay !== undefined) {
      const dayNum = parseInt(String(sendDay), 10);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
        return NextResponse.json(
          { error: 'sendDay must be a number between 1 and 31' },
          { status: 400 }
        );
      }

      const { error: dayError } = await supabase
        .from('app_settings')
        .upsert({
          key: 'sms_send_day',
          value: String(dayNum),
          description: 'SMS send day of month',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (dayError) {
        console.error('Send day save error:', dayError);
        return NextResponse.json(
          { error: dayError.message },
          { status: 500 }
        );
      }
    }

    const { data: updatedTemplate } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'sms_template')
      .single();

    const { data: updatedDay } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'sms_send_day')
      .single();

    return NextResponse.json({
      success: true,
      data: {
        template: updatedTemplate?.value || DEFAULT_TEMPLATE,
        sendDay: updatedDay?.value ? parseInt(updatedDay.value, 10) : 25,
      },
      message: 'Settings saved'
    });
  } catch (error) {
    console.error('Message settings save error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

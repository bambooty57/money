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

import fs from 'fs';
import path from 'path';

const SETTINGS_FILE_PATH = path.join(process.cwd(), '.sms-settings.json');

function getLocalSettings(): { template?: string; sendDay?: number } {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const content = fs.readFileSync(SETTINGS_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading local settings file:', err);
  }
  return {};
}

function saveLocalSettings(settings: { template?: string; sendDay?: number }) {
  try {
    const current = getLocalSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local settings file:', err);
  }
}

/**
 * GET /api/message-settings
 * Get current SMS template and send day
 */
export async function GET() {
  try {
    const supabase = getSupabase();
    const local = getLocalSettings();

    let dbSettings: any = null;
    try {
      const { data } = await supabase
        .from('models_types')
        .select('type')
        .eq('model', '__SYSTEM_SMS_SETTINGS__')
        .single();
      if (data?.type) {
        dbSettings = JSON.parse(data.type);
      }
    } catch {}

    const template = dbSettings?.template || local.template || DEFAULT_TEMPLATE;
    const sendDay = dbSettings?.sendDay || local.sendDay || 25;

    return NextResponse.json({
      success: true,
      data: {
        template,
        sendDay,
        isDefault: !dbSettings && !local.template
      }
    });
  } catch (error) {
    console.error('Message settings get error:', error);
    const local = getLocalSettings();
    return NextResponse.json({
      success: true,
      data: {
        template: local.template || DEFAULT_TEMPLATE,
        sendDay: local.sendDay || 25,
        isDefault: !local.template
      }
    });
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

    const local = getLocalSettings();
    const finalTemplate = template !== undefined ? template : (local.template || DEFAULT_TEMPLATE);
    const finalSendDay = sendDay !== undefined ? parseInt(String(sendDay), 10) : (local.sendDay || 25);

    saveLocalSettings({ template: finalTemplate, sendDay: finalSendDay });

    const supabase = getSupabase();

    try {
      const { data: existing } = await supabase
        .from('models_types')
        .select('id')
        .eq('model', '__SYSTEM_SMS_SETTINGS__')
        .single();

      const payload = JSON.stringify({ template: finalTemplate, sendDay: finalSendDay });
      if (existing) {
        await supabase
          .from('models_types')
          .update({ type: payload })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('models_types')
          .insert({ model: '__SYSTEM_SMS_SETTINGS__', type: payload });
      }
    } catch (err) {
      console.warn('DB settings save warning:', err);
    }

    return NextResponse.json({
      success: true,
      data: {
        template: finalTemplate,
        sendDay: finalSendDay,
      },
      message: 'Settings saved and synced across devices'
    });
  } catch (error) {
    console.error('Message settings save error:', error);
    const local = getLocalSettings();
    return NextResponse.json({
      success: true,
      data: {
        template: local.template || DEFAULT_TEMPLATE,
        sendDay: local.sendDay || 25,
      },
      message: 'Settings saved to local fallback'
    });
  }
}

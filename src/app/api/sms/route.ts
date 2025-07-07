import { NextResponse } from 'next/server';
import { smsTemplates, SmsPayload, SmsTemplateKey } from '@/types/sms';
import { createClient } from '@/lib/supabase';

function fillTemplate(template: string, variables: Record<string, string | number>) {
  return template.replace(/\{(.*?)\}/g, (_, key) => variables[key] ? String(variables[key]) : '');
}

export async function POST(request: Request) {
  const body = await request.json();
  const { to, templateKey, category, variables, scheduledAt, customerId }: SmsPayload & { customerId?: string } = body;

  // 템플릿 메시지 생성
  const template = smsTemplates[category][templateKey];
  const message = fillTemplate(template, variables);

  // 실제 SMS 발송 대신 mock
  const log = {
    to,
    message,
    scheduledAt: scheduledAt || null,
    status: 'mock_sent',
    sentAt: new Date().toISOString(),
  };

  // DB 저장
  const supabase = createClient();
  await supabase.from('sms_messages').insert([
    {
      customer_id: customerId || null,
      phone: to,
      content: message,
      status: 'sent',
      sent_at: log.sentAt,
      result_message: 'mock_sent'
    }
  ]);

  return NextResponse.json(log);
} 
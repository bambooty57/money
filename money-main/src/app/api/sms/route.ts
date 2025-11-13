import { NextResponse } from 'next/server';
import { smsTemplates, SmsPayload } from '@/types/sms';
import { createClient } from '@/lib/supabase';

function fillTemplate(template: string, variables: Record<string, string | number>) {
  return template.replace(/\{(.*?)\}/g, (_, key) => variables[key] ? String(variables[key]) : '');
}

export async function POST(request: Request) {
  const body = await request.json();
  const { to, templateKey, category, variables, scheduledAt, customerId }: SmsPayload & { customerId?: string } = body;

  // DB에서 템플릿 로드 시도
  const supabase = createClient();
  let template = '';
  
  const { data: dbTemplate } = await (supabase as any)
    .from('sms_templates')
    .select('content')
    .eq('category', category)
    .eq('key', templateKey)
    .single();
  
  if (dbTemplate) {
    template = dbTemplate.content;
  } else {
    // DB에 없으면 하드코딩된 템플릿 사용
    template = smsTemplates[category]?.[templateKey] || '';
  }
  
  if (!template) {
    return NextResponse.json({ error: '템플릿을 찾을 수 없습니다.' }, { status: 404 });
  }
  
  const message = fillTemplate(template, variables);

  // 실제 SMS 발송 대신 mock
  const log = {
    to,
    message,
    scheduledAt: scheduledAt || null,
    status: 'mock_sent',
    sentAt: new Date().toISOString(),
  };

  // DB 저장 (이미 supabase 클라이언트가 있음)
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
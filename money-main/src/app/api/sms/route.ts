import { NextResponse } from 'next/server';
import { SmsPayload } from '@/types/sms';
import { createClient } from '@/lib/supabase';

function fillTemplate(template: string, variables: Record<string, string | number>) {
  return template.replace(/\{(.*?)\}/g, (_, key) => variables[key] ? String(variables[key]) : '');
}

export async function POST(request: Request) {
  const body = await request.json();
  const { to, templateKey, category, variables, scheduledAt, customerId }: SmsPayload & { customerId?: string } = body;

  // DB에서 템플릿 로드 (DB만 사용)
  const supabase = createClient();
  
  const { data: dbTemplate, error: templateError } = await supabase
    .from('sms_templates')
    .select('content')
    .eq('category', category)
    .eq('key', templateKey)
    .single();
  
  if (templateError || !dbTemplate) {
    return NextResponse.json({ 
      error: `템플릿을 찾을 수 없습니다. (카테고리: ${category}, 키: ${templateKey})` 
    }, { status: 404 });
  }
  
  const template = dbTemplate.content;
  
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
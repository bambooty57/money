import { NextResponse } from 'next/server';
import { smsTemplates, SmsPayload, SmsTemplateKey } from '@/types/sms';

function fillTemplate(template: string, variables: Record<string, string | number>) {
  return template.replace(/\{(.*?)\}/g, (_, key) => variables[key] ? String(variables[key]) : '');
}

export async function POST(request: Request) {
  const body = await request.json();
  const { to, templateKey, variables, scheduledAt }: SmsPayload = body;

  // 템플릿 메시지 생성
  const template = smsTemplates[templateKey as SmsTemplateKey];
  const message = fillTemplate(template, variables);

  // 실제 SMS 발송 대신 로그 반환 (실제 연동 시 외부 API 호출)
  const log = {
    to,
    message,
    scheduledAt: scheduledAt || null,
    status: 'mock_sent',
    sentAt: new Date().toISOString(),
  };

  return NextResponse.json(log);
} 
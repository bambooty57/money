import { SolapiMessageService } from 'solapi';

// Solapi 문자 발송 공통 헬퍼 (전자서명 알림 등 서버 사이드 발송용)
export async function sendSmsMessage(to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    let apiKey = (process.env.SOLAPI_API_KEY || 'NCSC1MQ5IG0XTWHI').trim().replace(/['"]/g, '');
    let apiSecret = (process.env.SOLAPI_API_SECRET || 'ZWN6HLVBJOMCTBWPQYR1NPQNCNWFRD45').trim().replace(/['"]/g, '');
    let senderNumber = (process.env.SOLAPI_SENDER_NUMBER || '01040515179').replace(/[^0-9]/g, '');

    if (apiKey.length !== 16) apiKey = 'NCSC1MQ5IG0XTWHI';
    if (apiSecret.length !== 32) apiSecret = 'ZWN6HLVBJOMCTBWPQYR1NPQNCNWFRD45';

    const cleanTo = to.replace(/[^0-9]/g, '');
    if (!cleanTo) return { ok: false, error: '수신 번호가 없습니다.' };

    const messageService = new SolapiMessageService(apiKey, apiSecret);
    await messageService.send({
      to: cleanTo,
      from: senderNumber,
      text: message,
    });
    return { ok: true };
  } catch (error: any) {
    console.error('SMS 발송 오류:', error);
    return { ok: false, error: error?.message || String(error) };
  }
}

// 열람 링크 기본 URL 결정
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

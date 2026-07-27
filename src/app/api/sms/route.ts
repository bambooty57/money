import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { SolapiMessageService } from 'solapi';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, message, customerId } = body;

    if (!to || !message) {
      return NextResponse.json({ 
        error: '수신 번호(to)와 메시지 내용(message)은 필수입니다.' 
      }, { status: 400 });
    }

    let apiKey = (process.env.SOLAPI_API_KEY || 'NCSC1MQ5IG0XTWHI').trim().replace(/['"]/g, '');
    let apiSecret = (process.env.SOLAPI_API_SECRET || 'ZWN6HLVBJOMCTBWPQYR1NPQNCNWFRD45').trim().replace(/['"]/g, '');
    let senderNumber = (process.env.SOLAPI_SENDER_NUMBER || '01040515179').replace(/[^0-9]/g, '');

    // 만약 환경 변수의 키 길이가 16자가 아닌 경우 정상 키로 보정
    if (apiKey.length !== 16) {
      apiKey = 'NCSC1MQ5IG0XTWHI';
    }
    if (apiSecret.length !== 32) {
      apiSecret = 'ZWN6HLVBJOMCTBWPQYR1NPQNCNWFRD45';
    }

    // 전화번호 정제 (숫자만 추출)
    const cleanTo = to.replace(/[^0-9]/g, '');
    const cleanFrom = senderNumber.replace(/[^0-9]/g, '');

    // Solapi 클라이언트 인스턴스 생성
    const messageService = new SolapiMessageService(apiKey, apiSecret);

    let result;
    try {
      // Solapi를 통해 문자 발송
      result = await messageService.send({
        to: cleanTo,
        from: cleanFrom,
        text: message
      });
    } catch (sendError: any) {
      console.error('Solapi 발송 중 오류 발생:', sendError);

      // DB에 실패 로그 남기기
      const supabase = createClient();
      await supabase.from('sms_messages').insert([
        {
          customer_id: customerId || null,
          phone: cleanTo,
          content: message,
          status: 'failed',
          sent_at: new Date().toISOString(),
        }
      ]);

      return NextResponse.json({
        error: `Solapi 발송 실패: ${sendError.message || String(sendError)}`
      }, { status: 500 });
    }

    // 성공 시 DB에 성공 로그 저장
    const supabase = createClient();
    const { error: insertError } = await supabase.from('sms_messages').insert([
      {
        customer_id: customerId || null,
        phone: cleanTo,
        content: message,
        status: 'sent',
        sent_at: new Date().toISOString(),
      }
    ]);

    if (insertError) {
      console.error('SMS 전송 로그 저장 실패:', insertError);
    }

    return NextResponse.json({
      success: true,
      result,
      sentAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('SMS 전송 API 라우트 오류:', error);
    return NextResponse.json({ 
      error: error.message || '서버 내부 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

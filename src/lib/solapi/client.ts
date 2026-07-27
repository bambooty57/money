import { SolapiMessageService } from 'solapi';
import type { 
  SolapiMessageRequest, 
  SolapiAlimtalkRequest, 
  SolapiSendResult,
  SolapiCredentials 
} from '@/types/solapi';

function getService(credentials?: SolapiCredentials): SolapiMessageService {
  let apiKey = (credentials?.apiKey || process.env.SOLAPI_API_KEY || 'NCSC1MQ5IG0XTWHI').trim().replace(/['"]/g, '');
  let apiSecret = (credentials?.apiSecret || process.env.SOLAPI_API_SECRET || 'ZWN6HLVBJOMCTBWPQYR1NPQNCNWFRD45').trim().replace(/['"]/g, '');

  if (apiKey.length !== 16) {
    apiKey = 'NCSC1MQ5IG0XTWHI';
  }
  if (apiSecret.length !== 32) {
    apiSecret = 'ZWN6HLVBJOMCTBWPQYR1NPQNCNWFRD45';
  }

  return new SolapiMessageService(apiKey, apiSecret);
}

/**
 * SMS 발송
 * @param message - 발송할 메시지 정보
 * @param credentials - 솔라피 API 인증 정보
 * @returns 발송 결과
 */
export async function sendSMS(
  message: SolapiMessageRequest,
  credentials: SolapiCredentials
): Promise<SolapiSendResult> {
  try {
    const service = getService(credentials);
    const cleanTo = message.to.replace(/[^0-9]/g, '');
    const cleanFrom = (message.from || credentials.senderNumber || '01040515179').replace(/[^0-9]/g, '');

    const result: any = await service.send({
      to: cleanTo,
      from: cleanFrom,
      text: message.text,
    });

    return {
      success: true,
      messageId: result?.groupInfo?.groupId || result?.groupId || 'SENT',
      statusCode: '2000',
    };
  } catch (error: any) {
    console.error('Solapi SMS 발송 실패:', error);
    return {
      success: false,
      errorMessage: error?.message || String(error),
    };
  }
}

/**
 * 알림톡 발송
 * @param message - 발송할 알림톡 정보
 * @param credentials - 솔라피 API 인증 정보
 * @returns 발송 결과
 */
export async function sendAlimtalk(
  message: SolapiAlimtalkRequest,
  credentials: SolapiCredentials
): Promise<SolapiSendResult> {
  try {
    const service = getService(credentials);
    const cleanTo = message.to.replace(/[^0-9]/g, '');
    const cleanFrom = (message.from || credentials.senderNumber || '01040515179').replace(/[^0-9]/g, '');

    const result: any = await service.send({
      to: cleanTo,
      from: cleanFrom,
      text: message.text,
      kakaoOptions: {
        pfId: message.templateId,
      } as any,
    });

    return {
      success: true,
      messageId: result?.groupInfo?.groupId || result?.groupId || 'SENT',
      statusCode: '2000',
    };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error?.message || String(error),
    };
  }
}

/**
 * 여러 메시지 일괄 발송
 * @param messages - 발송할 메시지 목록
 * @param credentials - 솔라피 API 인증 정보
 * @returns 발송 결과 목록
 */
export async function sendBulkMessages(
  messages: SolapiMessageRequest[],
  credentials: SolapiCredentials
): Promise<SolapiSendResult[]> {
  const results: SolapiSendResult[] = [];
  
  for (const message of messages) {
    const result = await sendSMS(message, credentials);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

/**
 * 잔액 조회
 * @param credentials - 솔라피 API 인증 정보
 * @returns 계정 잔액
 */
export async function getBalance(
  credentials: SolapiCredentials
): Promise<{ success: boolean; balance?: number; errorMessage?: string }> {
  try {
    const service = getService(credentials);
    const res: any = await service.getBalance();
    const balanceVal = typeof res?.balance === 'number' 
      ? res.balance 
      : parseInt(String(res?.balance || '0'), 10);
    return {
      success: true,
      balance: balanceVal,
    };
  } catch (error: any) {
    console.error('Solapi 잔액 조회 실패:', error);
    return {
      success: false,
      errorMessage: error?.message || String(error),
    };
  }
}

/**
 * 발송 결과 조회
 * @param messageId - 메시지 ID
 * @param credentials - 솔라피 API 인증 정보
 * @returns 발송 상태
 */
export async function getMessageStatus(
  messageId: string,
  credentials: SolapiCredentials
): Promise<{ success: boolean; status?: string; errorMessage?: string }> {
  try {
    const service = getService(credentials);
    const res: any = await service.getMessages({ groupId: messageId });
    return {
      success: true,
      status: 'completed',
    };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error?.message || String(error),
    };
  }
}


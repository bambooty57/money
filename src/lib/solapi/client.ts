/**
 * 솔라피(Solapi) API 클라이언트
 * SMS/알림톡 발송 기능 제공
 */

import type { 
  SolapiMessageRequest, 
  SolapiAlimtalkRequest, 
  SolapiResponse, 
  SolapiSendResult,
  SolapiCredentials 
} from '@/types/solapi';

// 솔라피 API 기본 URL
const SOLAPI_BASE_URL = 'https://api.solapi.com';

// 인증 헤더 생성
function createAuthHeader(credentials: SolapiCredentials): string {
  const authString = `${credentials.apiKey}:${credentials.apiSecret}`;
  return `Basic ${Buffer.from(authString).toString('base64')}`;
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
    const response = await fetch(`${SOLAPI_BASE_URL}/messages/v4/send`, {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(credentials),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          to: message.to.replace(/-/g, ''),
          from: message.from.replace(/-/g, ''),
          text: message.text,
          type: message.type || 'SMS',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        errorMessage: errorData.errorMessage || `HTTP ${response.status}`,
        statusCode: String(response.status),
      };
    }

    const data: SolapiResponse = await response.json();
    
    return {
      success: data.statusCode === '2000',
      messageId: data.messageId,
      statusCode: data.statusCode,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
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
    const response = await fetch(`${SOLAPI_BASE_URL}/messages/v4/send`, {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(credentials),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          to: message.to.replace(/-/g, ''),
          from: message.from.replace(/-/g, ''),
          text: message.text,
          type: 'ATA',
          templateId: message.templateId,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        errorMessage: errorData.errorMessage || `HTTP ${response.status}`,
        statusCode: String(response.status),
      };
    }

    const data: SolapiResponse = await response.json();
    
    return {
      success: data.statusCode === '2000',
      messageId: data.messageId,
      statusCode: data.statusCode,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
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
  
  // 순차적으로 발송 (API rate limit 고려)
  for (const message of messages) {
    const result = await sendSMS(message, credentials);
    results.push(result);
    
    // Rate limiting: 100ms 대기
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
    const response = await fetch(`${SOLAPI_BASE_URL}/cash/v1/balance`, {
      method: 'GET',
      headers: {
        'Authorization': createAuthHeader(credentials),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        errorMessage: errorData.errorMessage || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      balance: data.balance,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
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
    const response = await fetch(`${SOLAPI_BASE_URL}/messages/v4/${messageId}`, {
      method: 'GET',
      headers: {
        'Authorization': createAuthHeader(credentials),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        errorMessage: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      status: data.status,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

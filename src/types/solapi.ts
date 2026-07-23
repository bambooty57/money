/**
 * 솔라피(Solapi) API 타입 정의
 * 월말 미수금 알림 발송을 위한 타입
 */

// SMS 발송 요청 타입
export interface SolapiMessageRequest {
  to: string;           // 수신자 전화번호
  from: string;         // 발신자 전화번호 (등록된 번호)
  text: string;         // 메시지 내용
  type?: 'SMS' | 'LMS' | 'MMS' | 'ATA' | 'CTA';  // 메시지 타입
}

// 알림톡 발송 요청 타입
export interface SolapiAlimtalkRequest {
  to: string;           // 수신자 전화번호
  from: string;         // 발신자 전화번호
  text: string;         // 메시지 내용
  type: 'ATA';          // 알림톡 타입
  templateId?: string;  // 알림톡 템플릿 ID
  variables?: Record<string, string>;  // 템플릿 변수
}

// 솔라피 API 응답 타입
export interface SolapiResponse {
  groupId?: string;
  to: string;
  from: string;
  type: string;
  statusCode: string;
  statusMessage: string;
  customFields?: Record<string, string>;
  messageId?: string;
}

// 발송 결과 타입
export interface SolapiSendResult {
  success: boolean;
  messageId?: string;
  errorMessage?: string;
  statusCode?: string;
}

// 미수금 알림 대상 고객 타입
export interface ArrearsCustomer {
  id: string;
  name: string;
  mobile: string;
  totalArrears: number;      // 총 미수금액
  lastTransactionDate?: string;
  transactionCount: number;  // 미수 거래 건수
}

// 미수금 알림 설정 타입
export interface ArrearsNotificationConfig {
  monthlyDay: number;        // 월말 알림일 (예: 25일)
  minArrearsAmount: number;  // 최소 미수금액 (이 금액 이상일 때만 알림)
  messageTemplate: string;   // 알림 메시지 템플릿
}

// 알림 발송 이력 타입
export interface NotificationHistory {
  id: string;
  customerId: string;
  customerName: string;
  mobile: string;
  message: string;
  amount: number;
  sentAt: string;
  status: 'success' | 'failed' | 'pending';
  messageId?: string;
  errorMessage?: string;
  notificationType: 'monthly' | 'manual';
}

// 솔라피 API 인증 정보
export interface SolapiCredentials {
  apiKey: string;
  apiSecret: string;
  senderNumber: string;  // 등록된 발신번호
}

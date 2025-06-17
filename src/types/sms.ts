export type SmsTemplateKey = '입금요청' | '1차독촉' | '최종고지';

export const smsTemplates: Record<SmsTemplateKey, string> = {
  '입금요청': '[{고객명}]님, 미수금 {미수금액}원이 있습니다. 입금 부탁드립니다. 계좌: {입금계좌}',
  '1차독촉': '[{고객명}]님, {연체일수}일 연체 중입니다. 빠른 입금 부탁드립니다. 계좌: {입금계좌}',
  '최종고지': '[{고객명}]님, 장기 연체로 법적 조치가 진행될 수 있습니다. 미수금: {미수금액}원. 계좌: {입금계좌}',
};

export type SmsPayload = {
  to: string;
  message: string;
  customerId: string;
  templateKey: SmsTemplateKey;
  variables: Record<string, string | number>;
  scheduledAt?: string; // 예약 발송 시각(ISO)
};

export interface SmsMessage {
  id: string;
  customer_id: string;
  content: string;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
  updated_at: string;
} 
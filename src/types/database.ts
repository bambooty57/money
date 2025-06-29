export interface Customer {
  id: string;
  name: string;
  phone: string;
  mobile?: string;
  email?: string;
  grade?: string;
  business_no?: string;
  business_name?: string;
  representative_name?: string;
  ssn?: string;
  address_road?: string;
  address_jibun?: string;
  zipcode?: string;
  customer_type?: string;
  customer_type_multi?: string[];
  created_at?: string;
  updated_at?: string;
  // 호환성용
  address?: string;
  business_number?: string;
  // 프론트 files 연동용
  photos?: { url: string }[];
  model?: string; // 기종
  model_type?: string; // 형식명
  transaction_count?: number;
  fax?: string;
}

export interface CustomerPhoto {
  id: string;
  customer_id: string;
  url: string;
  description: string | null;
  created_at: string;
}

export type Transaction = {
  id: string;
  customer_id: string;
  type: string; // 거래유형(판매/수리 등)
  amount: number;
  status: 'paid' | 'unpaid';
  description: string | null;
  created_at: string;
  updated_at: string;
  model?: string; // 기종
  model_type?: string; // 형식명
  customers?: Customer; // 고객 정보(이름 등)
}

export interface Contact {
  id: string;
  customer_id: string;
  type: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface File {
  id: string;
  customer_id: string;
  name: string;
  type: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface LegalAction {
  id: string;
  customer_id: string;
  type: string;
  description: string;
  status: 'completed' | 'in_progress';
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  transaction_id: string;
  amount: number;
  paid_at: string;
  method: string; // '현금', '계좌이체', '카드', '기타' 등
  payer_name: string;
  // 현금입금 전용
  cash_place?: string | null;
  cash_receiver?: string | null;
  cash_detail?: string | null;
  // 계좌이체(무통장입금 포함) 전용
  account_number?: string | null; // 입금계좌번호
  account_holder?: string | null; // 예금주명
  // 카드 결제 전용
  /** 카드명(예: 신한카드, 현대카드 등) */
  card_name?: string | null;
  /** 결제 장소(오프라인 매장 등) */
  paid_location?: string | null;
  /** 결제 담당자 */
  paid_by?: string | null;
  /** 카드사 승인번호 등(선택) */
  card_approval_code?: string | null;
  // 공통
  note?: string | null; // 비고
  created_at?: string;
  updated_at?: string;
  /** 중고인수 기종 */
  used_model_type?: string | null;
  /** 중고인수 모델 */
  used_model?: string | null;
  /** 중고인수 장소 */
  used_place?: string | null;
  /** 중고인수 담당자 */
  used_by?: string | null;
  /** 중고인수 일자 */
  used_at?: string | null;
} 
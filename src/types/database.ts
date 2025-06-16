export type Customer = {
  id: string;
  name: string;
  phone: string;
  business_no?: string;
  address?: string;
  email?: string;
  credit_limit?: number;
  grade: '우수' | '일반' | '주의' | '요주의';
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  customer_id: string;
  type: '판매' | '입금';
  amount: number;
  balance: number;
  due_date?: string;
  status: '미수' | '완료';
  description?: string;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  customer_id: string;
  type: '통화' | '문자' | '방문';
  content: string;
  created_at: string;
};

export type File = {
  id: string;
  customer_id: string;
  name: string;
  url: string;
  type: string;
  created_at: string;
};

export type LegalAction = {
  id: string;
  customer_id: string;
  type: string;
  status: '진행중' | '완료';
  due_date?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}; 
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
}

export interface CustomerPhoto {
  id: string;
  customer_id: string;
  url: string;
  description: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  customer_id: string;
  type: string;
  amount: number;
  status: 'paid' | 'unpaid';
  description: string | null;
  created_at: string;
  updated_at: string;
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
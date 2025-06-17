export interface Customer {
  id: string;
  name: string;
  business_number: string;
  representative_name: string;
  business_type: string;
  phone: string;
  email: string | null;
  address: string | null;
  grade: string;
  credit_limit: number | null;
  created_at: string;
  updated_at: string;
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
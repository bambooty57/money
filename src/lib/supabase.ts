import { createClient as _createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

// 하드코딩된 Supabase 설정 (환경 변수 문제 해결)
const supabaseUrl = 'https://jcqdjkxllgiedjqxryoq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjcWRqa3hsbGdpZWRqcXhyeW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNzI0NTMsImV4cCI6MjA2NTY0ODQ1M30.WQA3Ycqeq8f-4RsWOCwP12iZ4HE-U1oAIpnHh63VJeA';

// 브라우저 환경 체크
const isBrowser = typeof window !== 'undefined';

// 브라우저용 Supabase 클라이언트 (쿠키 기반 세션) - 싱글톤
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

function getBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}

// 서버용 기본 클라이언트 (API 라우트 등에서 사용)
const serverClient = _createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'money-management-app',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// 타입 안전한 Supabase 클라이언트 - 환경에 따라 적절한 클라이언트 반환
export const supabase = isBrowser ? getBrowserClient() : serverClient;

export function createClient() {
  if (isBrowser) {
    return getBrowserClient();
  }
  return _createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// 서버에서 access_token으로 인증된 Supabase 클라이언트 생성
export function createServerClient(accessToken?: string) {
  return _createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'X-Client-Info': 'money-management-app',
      },
    },
  });
}

// 타입 안전한 쿼리 헬퍼 함수들
export const typedQuery = {
  customers: {
    selectAll: () => supabase.from('customers').select('*'),
    selectBasic: () => supabase.from('customers').select('id, name, phone, customer_type, grade, created_at'),
    insert: (data: Database['public']['Tables']['customers']['Insert']) =>
      supabase.from('customers').insert(data),
    update: (id: string, data: Database['public']['Tables']['customers']['Update']) =>
      supabase.from('customers').update(data).eq('id', id),
    delete: (id: string) => supabase.from('customers').delete().eq('id', id),
  },
  
  transactions: {
    selectAll: () => supabase.from('transactions').select('*'),
    selectWithCustomer: () => supabase
      .from('transactions')
      .select(`
        *,
        customers!inner (
          id,
          name,
          phone
        )
      `),
    insert: (data: Database['public']['Tables']['transactions']['Insert']) =>
      supabase.from('transactions').insert(data),
    update: (id: string, data: Database['public']['Tables']['transactions']['Update']) =>
      supabase.from('transactions').update(data).eq('id', id),
    delete: (id: string) => supabase.from('transactions').delete().eq('id', id),
  },
  
  legalActions: {
    selectAll: () => supabase.from('legal_actions').select('*'),
    selectWithCustomer: () => supabase
      .from('legal_actions')
      .select(`
        *,
        customers!inner (
          id,
          name,
          phone
        )
      `),
    insert: (data: Database['public']['Tables']['legal_actions']['Insert']) =>
      supabase.from('legal_actions').insert(data),
    update: (id: string, data: Database['public']['Tables']['legal_actions']['Update']) =>
      supabase.from('legal_actions').update(data).eq('id', id),
    delete: (id: string) => supabase.from('legal_actions').delete().eq('id', id),
  },
  
  contacts: {
    selectAll: () => supabase.from('contacts').select('*'),
    selectByCustomer: (customerId: string) => 
      supabase.from('contacts').select('*').eq('customer_id', customerId),
    insert: (data: Database['public']['Tables']['contacts']['Insert']) =>
      supabase.from('contacts').insert(data),
    update: (id: string, data: Database['public']['Tables']['contacts']['Update']) =>
      supabase.from('contacts').update(data).eq('id', id),
    delete: (id: string) => supabase.from('contacts').delete().eq('id', id),
  },
  
  files: {
    selectAll: () => supabase.from('files').select('*'),
    selectByCustomer: (customerId: string) => 
      supabase.from('files').select('*').eq('customer_id', customerId),
    insert: (data: Database['public']['Tables']['files']['Insert']) =>
      supabase.from('files').insert(data),
    update: (id: string, data: Database['public']['Tables']['files']['Update']) =>
      supabase.from('files').update(data).eq('id', id),
    delete: (id: string) => supabase.from('files').delete().eq('id', id),
  },
};

// 스키마 검증 헬퍼
export class SchemaChecker {
  private static instance: SchemaChecker;
  private currentSchema: Map<string, unknown> = new Map();
  
  static getInstance() {
    if (!SchemaChecker.instance) {
      SchemaChecker.instance = new SchemaChecker();
    }
    return SchemaChecker.instance;
  }
  
  async checkTableSchema(tableName: string) {
    try {
      const { data, error } = await (supabase as any)
        .from('information_schema.columns')
        .select('*')
        .eq('table_name', tableName);
      
      if (error) {
        console.warn(`⚠️ Could not check schema for table: ${tableName}`, error);
        return;
      }
      
      const currentSchema = this.currentSchema.get(tableName);
      if (currentSchema && JSON.stringify(currentSchema) !== JSON.stringify(data)) {
        console.warn(`⚠️ Schema change detected for table: ${tableName}`);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 Consider regenerating types with: npm run types:generate');
        }
      }
      
      this.currentSchema.set(tableName, data);
    } catch (error) {
      console.warn(`⚠️ Schema check failed for table: ${tableName}`, error);
    }
  }
}

// 타입 가드 함수들
export function isCustomer(data: unknown): data is Database['public']['Tables']['customers']['Row'] {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.business_number === 'string' &&
    typeof obj.representative_name === 'string' &&
    typeof obj.customer_type === 'string' &&
    typeof obj.phone === 'string' &&
    typeof obj.grade === 'string'
  );
}

export function isTransaction(data: unknown): data is Database['public']['Tables']['transactions']['Row'] {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.customer_id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.amount === 'number' &&
    (obj.status === 'paid' || obj.status === 'unpaid')
  );
}

export function assertCustomer(data: unknown): asserts data is Database['public']['Tables']['customers']['Row'] {
  if (!isCustomer(data)) {
    throw new Error('Data is not a valid Customer');
  }
}

export function assertTransaction(data: unknown): asserts data is Database['public']['Tables']['transactions']['Row'] {
  if (!isTransaction(data)) {
    throw new Error('Data is not a valid Transaction');
  }
}

// 성능 최적화를 위한 대용량 데이터 Storage 분리 헬퍼
export const storageHelper = {
  async uploadLargeData(data: any, fileName: string, bucket: string = 'json-data') {
    try {
      const { data: fileData, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, JSON.stringify(data), {
          contentType: 'application/json',
          cacheControl: '3600',
        });
      
      if (error) throw error;
      
      const { data: publicUrl } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);
        
      return publicUrl.publicUrl;
    } catch (error) {
      console.error('Failed to upload large data:', error);
      throw error;
    }
  },
  
  async downloadLargeData(url: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch data');
      return await response.json();
    } catch (error) {
      console.error('Failed to download large data:', error);
      throw error;
    }
  }
};

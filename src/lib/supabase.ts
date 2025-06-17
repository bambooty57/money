import { createClient as _createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = _createClient(supabaseUrl, supabaseAnonKey);
export function createClient() {
  return _createClient(supabaseUrl, supabaseAnonKey);
} 
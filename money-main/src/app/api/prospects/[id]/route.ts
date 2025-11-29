import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// 하드코딩된 Supabase 설정 (환경 변수 문제 해결)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jcqdjkxllgiedjqxryoq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjcWRqa3hsbGdpZWRqcXhyeW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNzI0NTMsImV4cCI6MjA2NTY0ODQ1M30.WQA3Ycqeq8f-4RsWOCwP12iZ4HE-U1oAIpnHh63VJeA';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 인증된 Supabase 클라이언트 생성 헬퍼 함수
function createAuthenticatedClient(accessToken?: string) {
  if (supabaseServiceKey) {
    return createClient<Database>(supabaseUrl, supabaseServiceKey);
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

// Authorization 헤더에서 토큰 추출
function extractToken(request: Request): string | undefined {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return undefined;
}

export async function PUT(
  request: Request,
  context: any
) {
  try {
    const body = await request.json();
    const { prospect_device_type, current_device_model_id } = body;

    const accessToken = extractToken(request);
    const supabase = createAuthenticatedClient(accessToken);

    const updateData: Database['public']['Tables']['customer_prospects']['Update'] = {
      updated_at: new Date().toISOString(),
    };

    if (prospect_device_type !== undefined) {
      updateData.prospect_device_type = prospect_device_type;
    }
    if (current_device_model_id !== undefined) {
      updateData.current_device_model_id = current_device_model_id || null;
    }

    const { data, error } = await supabase
      .from('customer_prospects')
      .update(updateData)
      .eq('id', context.params.id)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json(
        { error: 'Failed to update prospect', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: any
) {
  try {
    const accessToken = extractToken(request);
    const supabase = createAuthenticatedClient(accessToken);

    const { error } = await supabase
      .from('customer_prospects')
      .delete()
      .eq('id', context.params.id);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete prospect', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


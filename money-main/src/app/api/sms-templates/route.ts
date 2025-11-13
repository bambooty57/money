import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(_request: Request) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('sms_templates')
      .select('*')
      .order('category', { ascending: true })
      .order('key', { ascending: true });
    
    // 테이블이 없거나 에러가 발생해도 빈 배열 반환 (하드코딩된 템플릿 사용)
    if (error) {
      console.warn('sms_templates 테이블 조회 실패:', error.message);
      return NextResponse.json({ data: [], error: error.message });
    }
    
    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error('템플릿 조회 중 오류:', err);
    return NextResponse.json({ data: [], error: 'Failed to fetch templates' });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, key, content } = body;
    
    if (!category || !key || !content) {
      return NextResponse.json({ error: 'category, key, content는 필수입니다.' }, { status: 400 });
    }
    
    const supabase = createClient();
    const { data, error } = await supabase
      .from('sms_templates')
      .insert([{ category, key, content }])
      .select()
      .single();
    
    if (error) {
      // 테이블이 없는 경우 명확한 에러 메시지
      if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.code === '42P01') {
        return NextResponse.json({ 
          error: 'sms_templates 테이블이 존재하지 않습니다. Supabase에서 테이블을 먼저 생성해주세요. SQL 파일: sql/create_sms_templates_table.sql' 
        }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('템플릿 추가 중 오류:', err);
    return NextResponse.json({ error: err?.message || 'Failed to create template' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'id는 필수입니다.' }, { status: 400 });
    }
    
    const supabase = createClient();
    const { data, error } = await supabase
      .from('sms_templates')
      .delete()
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('템플릿 삭제 에러:', error);
      // 테이블이 없는 경우 명확한 에러 메시지
      if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.code === '42P01') {
        return NextResponse.json({ 
          error: 'sms_templates 테이블이 존재하지 않습니다. Supabase에서 테이블을 먼저 생성해주세요.' 
        }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, deleted: data });
  } catch (err: any) {
    console.error('템플릿 삭제 중 오류:', err);
    return NextResponse.json({ error: err?.message || 'Failed to delete template' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, category, key, content } = body;
    
    if (!id || !category || !key || !content) {
      return NextResponse.json({ error: 'id, category, key, content는 필수입니다.' }, { status: 400 });
    }
    
    const supabase = createClient();
    const { data, error } = await supabase
      .from('sms_templates')
      .update({ category, key, content })
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('템플릿 수정 에러:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '수정할 템플릿을 찾을 수 없습니다.' }, { status: 404 });
    }
    
    return NextResponse.json({ data: data[0] });
  } catch (err: any) {
    console.error('템플릿 수정 중 오류:', err);
    return NextResponse.json({ error: err?.message || 'Failed to update template' }, { status: 500 });
  }
}


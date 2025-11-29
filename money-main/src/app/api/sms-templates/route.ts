import { NextResponse } from 'next/server';
import { createClient, createServerClient } from '@/lib/supabase';

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
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token required' }, 
        { status: 401 }
      );
    }
    
    // 인증된 Supabase 클라이언트 생성
    const supabase = createServerClient(token);
    
    const body = await request.json();
    const { category, key, content } = body;
    
    if (!category || !key || !content) {
      return NextResponse.json({ error: 'category, key, content는 필수입니다.' }, { status: 400 });
    }
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
      // 중복 키 에러 처리
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return NextResponse.json({ 
          error: `이미 존재하는 템플릿입니다. (카테고리: ${category}, 키: ${key})` 
        }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: '템플릿 추가에 실패했습니다.' }, { status: 500 });
    }
    
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('템플릿 추가 중 오류:', err);
    return NextResponse.json({ error: err?.message || 'Failed to create template' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token required' }, 
        { status: 401 }
      );
    }
    
    // 인증된 Supabase 클라이언트 생성
    const supabase = createServerClient(token);
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    console.log('DELETE 요청:', { id, url: request.url });
    
    if (!id) {
      return NextResponse.json({ error: 'id는 필수입니다.' }, { status: 400 });
    }
    
    // 먼저 템플릿이 존재하는지 확인
    const { data: existing, error: checkError } = await supabase
      .from('sms_templates')
      .select('id, category, key')
      .eq('id', id)
      .single();
    
    if (checkError || !existing) {
      console.error('템플릿 조회 실패:', checkError);
      return NextResponse.json({ 
        error: `템플릿을 찾을 수 없습니다. (ID: ${id})`,
        details: checkError?.message 
      }, { status: 404 });
    }
    
    console.log('삭제할 템플릿:', existing);
    
    // 삭제 실행
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
    
    // 실제로 삭제된 행이 있는지 확인
    if (!data || data.length === 0) {
      console.warn('삭제된 행이 없습니다:', { id, data });
      return NextResponse.json({ 
        error: '템플릿을 삭제할 수 없습니다. 권한이 없거나 이미 삭제되었을 수 있습니다.',
        success: false,
        deleted: []
      }, { status: 404 });
    }
    
    console.log('삭제 성공:', { deleted: data });
    return NextResponse.json({ success: true, deleted: data });
  } catch (err: any) {
    console.error('템플릿 삭제 중 오류:', err);
    return NextResponse.json({ error: err?.message || 'Failed to delete template' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token required' }, 
        { status: 401 }
      );
    }
    
    // 인증된 Supabase 클라이언트 생성
    const supabase = createServerClient(token);
    
    const body = await request.json();
    const { id, category, key, content } = body;
    
    console.log('PUT 요청:', { id, category, key, contentLength: content?.length });
    
    if (!id || !category || !key || !content) {
      return NextResponse.json({ 
        error: 'id, category, key, content는 필수입니다.',
        received: { id: !!id, category: !!category, key: !!key, content: !!content }
      }, { status: 400 });
    }
    
    // 먼저 템플릿이 존재하는지 확인
    const { data: existing, error: checkError } = await supabase
      .from('sms_templates')
      .select('id, category, key')
      .eq('id', id)
      .single();
    
    if (checkError || !existing) {
      console.error('템플릿 조회 실패:', checkError);
      return NextResponse.json({ 
        error: `수정할 템플릿을 찾을 수 없습니다. (ID: ${id})`,
        details: checkError?.message 
      }, { status: 404 });
    }
    
    console.log('수정할 템플릿:', existing);
    
    // 업데이트 실행
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
      console.warn('수정된 행이 없습니다:', { id, data });
      return NextResponse.json({ 
        error: '템플릿을 수정할 수 없습니다. 권한이 없거나 이미 삭제되었을 수 있습니다.',
        details: `ID: ${id}`
      }, { status: 404 });
    }
    
    console.log('수정 성공:', { updated: data[0] });
    return NextResponse.json({ data: data[0] });
  } catch (err: any) {
    console.error('템플릿 수정 중 오류:', err);
    return NextResponse.json({ error: err?.message || 'Failed to update template' }, { status: 500 });
  }
}


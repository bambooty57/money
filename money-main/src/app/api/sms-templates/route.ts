import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(_request: Request) {
  try {
    const supabase = createClient();
    const { data, error } = await (supabase as any)
      .from('sms_templates')
      .select('*')
      .order('category', { ascending: true })
      .order('key', { ascending: true });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
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
    const { data, error } = await (supabase as any)
      .from('sms_templates')
      .insert([{ category, key, content }])
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
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
    const { error } = await (supabase as any)
      .from('sms_templates')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
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
    const { data, error } = await (supabase as any)
      .from('sms_templates')
      .update({ category, key, content })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}


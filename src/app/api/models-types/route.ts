import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  let query = supabase
    .from('models_types')
    .select('id, model, type')
    .order('model')
  if (q) {
    query = query.or(`model.ilike.%${q}%,type.ilike.%${q}%`)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  // Authorization 헤더에서 토큰 추출
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  if (!token) {
    return new NextResponse(JSON.stringify({ error: 'Authorization token required' }), {
      status: 401,
      headers: { 'Cache-Control': 'no-store' }
    })
  }
  
  // 인증된 Supabase 클라이언트 생성
  const supabase = createServerClient(token)
  
  const { id } = await req.json()
  console.log('DELETE id:', id)
  if (!id) {
    return new NextResponse(JSON.stringify({ error: 'id is required' }), {
      status: 400,
      headers: { 'Cache-Control': 'no-store' }
    })
  }
  const { error, count } = await supabase
    .from('models_types')
    .delete({ count: 'exact' })
    .eq('id', id)
  if (error) return new NextResponse(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Cache-Control': 'no-store' } })
  if (!count) return new NextResponse(JSON.stringify({ error: 'No row deleted', affectedRows: 0 }), { status: 404, headers: { 'Cache-Control': 'no-store' } })
  return new NextResponse(JSON.stringify({ success: true, affectedRows: count }), { status: 200, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { model, type } = await req.json()
  if (!model || !type) {
    return NextResponse.json({ error: 'model and type are required' }, { status: 400 })
  }
  const { data: inserted, error } = await supabase
    .from('models_types')
    .insert([{ model, type }])
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: inserted.id })
}

export async function PATCH(req: NextRequest) {
  // Authorization 헤더에서 토큰 추출
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  if (!token) {
    return new NextResponse(JSON.stringify({ error: 'Authorization token required' }), {
      status: 401,
      headers: { 'Cache-Control': 'no-store' }
    })
  }
  
  // 인증된 Supabase 클라이언트 생성
  const supabase = createServerClient(token)
  
  const { id, model, type } = await req.json()
  console.log('PATCH id:', id)
  if (!id || !model || !type) {
    return new NextResponse(JSON.stringify({ error: 'id, model and type are required' }), {
      status: 400,
      headers: { 'Cache-Control': 'no-store' }
    })
  }
  const { error, count } = await supabase
    .from('models_types')
    .update({ model, type }, { count: 'exact' })
    .eq('id', id)
  if (error) return new NextResponse(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Cache-Control': 'no-store' } })
  if (!count) return new NextResponse(JSON.stringify({ error: 'No row updated', affectedRows: 0 }), { status: 404, headers: { 'Cache-Control': 'no-store' } })
  return new NextResponse(JSON.stringify({ success: true, affectedRows: count }), { status: 200, headers: { 'Cache-Control': 'no-store' } })
} 
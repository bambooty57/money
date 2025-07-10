import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const { data, error } = await supabase
    .from('models_types')
    .select('id, model, type')
    .or(`model.ilike.%${q}%,type.ilike.%${q}%`)
    .order('model')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { id } = await req.json()
  if (!id) {
    return new NextResponse(JSON.stringify({ error: 'id is required' }), {
      status: 400,
      headers: { 'Cache-Control': 'no-store' }
    })
  }
  const { error } = await supabase
    .from('models_types')
    .delete()
    .eq('id', id)
  if (error) return new NextResponse(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Cache-Control': 'no-store' } })
  return new NextResponse(JSON.stringify({ success: true }), { status: 200, headers: { 'Cache-Control': 'no-store' } })
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
  const supabase = createClient()
  const { id, model, type } = await req.json()
  if (!id || !model || !type) {
    return new NextResponse(JSON.stringify({ error: 'id, model and type are required' }), {
      status: 400,
      headers: { 'Cache-Control': 'no-store' }
    })
  }
  const { error } = await supabase
    .from('models_types')
    .update({ model, type })
    .eq('id', id)
  if (error) return new NextResponse(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Cache-Control': 'no-store' } })
  return new NextResponse(JSON.stringify({ success: true }), { status: 200, headers: { 'Cache-Control': 'no-store' } })
} 
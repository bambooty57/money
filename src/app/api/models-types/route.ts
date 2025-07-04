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
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  const { error } = await supabase
    .from('models_types')
    .delete()
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { model, type } = await req.json()
  if (!model || !type) {
    return NextResponse.json({ error: 'model and type are required' }, { status: 400 })
  }
  const { error } = await supabase
    .from('models_types')
    .insert([{ model, type }])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { id, model, type } = await req.json()
  if (!id || !model || !type) {
    return NextResponse.json({ error: 'id, model and type are required' }, { status: 400 })
  }
  const { error } = await supabase
    .from('models_types')
    .update({ model, type })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
} 
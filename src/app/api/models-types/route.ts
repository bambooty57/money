import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const { data, error } = await supabase
    .from('models_types')
    .select('model, type')
    .or(`model.ilike.%${q}%,type.ilike.%${q}%`)
    .order('model')
    .limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
} 
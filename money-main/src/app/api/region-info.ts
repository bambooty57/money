import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ region: process.env.VERCEL_REGION || 'unknown' });
} 
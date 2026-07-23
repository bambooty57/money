import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const mdPath = path.resolve(process.cwd(), 'docs/supplier-info.md');
    const md = await fs.readFile(mdPath, 'utf-8');
    const get = (label: string) => {
      const m = md.match(new RegExp(`\\*\\*${label}\\*\\*\\:\\s*([^\\n]+)`));
      return m ? m[1].trim() : '';
    };
    // 계좌번호는 "은행 계좌 (예금주)" 형식이므로 파싱
    const accountRaw = get('계좌번호');
    let bank = '', number = '', holder = '';
    if (accountRaw) {
      const m = accountRaw.match(/([^ ]+) ([0-9\-]+) \(([^)]+)\)/);
      if (m) {
        bank = m[1];
        number = m[2];
        holder = m[3];
      }
    }
    return NextResponse.json({
      name: get('회사명\(상호\)'),
      ceo: get('대표자'),
      biznum: get('사업자등록번호'),
      address: get('주소'),
      phone: get('전화번호'),
      accounts: [bank ? { bank, number, holder } : undefined].filter(Boolean)
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
} 
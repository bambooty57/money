import { NextResponse } from 'next/server';
import Papa from 'papaparse';

export async function GET() {
  const sampleData = [
    {
      '고객명': '홍길동',
      '연락처': '010-1234-5678',
      '거래일': '2024-05-20',
      '거래내용': '샘플 매출',
      '매출액': 10000,
      '수금액': 0,
    },
    {
      '고객명': '이순신',
      '연락처': '010-9876-5432',
      '거래일': '2024-05-21',
      '거래내용': '샘플 수금',
      '매출액': 0,
      '수금액': 5000,
    }
  ];

  const csv = Papa.unparse(sampleData);

  // Add BOM for Excel to recognize UTF-8 correctly
  const csvWithBom = '\uFEFF' + csv;

  const response = new NextResponse(csvWithBom, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="upload_template.csv"',
    },
  });

  return response;
} 
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import ExcelJS from 'exceljs';

export async function GET() {
  // 고객 전체 데이터 조회
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });
  // 엑셀 워크북 생성
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('고객목록');
  sheet.columns = [
    { header: '이름', key: 'name' },
    { header: '고객유형', key: 'customer_type_multi' },
    { header: '사업자명', key: 'business_name' },
    { header: '사업자번호', key: 'business_no' },
    { header: '대표자명', key: 'representative_name' },
    { header: '주민등록번호', key: 'ssn' },
    { header: '휴대전화', key: 'mobile' },
    { header: '일반전화', key: 'phone' },
    { header: '주소(도로명)', key: 'address_road' },
    { header: '주소(지번)', key: 'address_jibun' },
    { header: '우편번호', key: 'zipcode' },
    { header: '이메일', key: 'email' },
    { header: '등급', key: 'grade' },
    { header: '등록일', key: 'created_at' },
  ];
  (customers ?? []).forEach((c: any) => {
    sheet.addRow({
      ...c,
      customer_type_multi: Array.isArray(c.customer_type_multi) ? c.customer_type_multi.join(', ') : c.customer_type_multi
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="customers.xlsx"',
    },
  });
} 
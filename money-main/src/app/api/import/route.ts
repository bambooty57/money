import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
type Customer = Tables<'customers'>;

// Helper function to find a value by multiple possible keys, after trimming whitespace from keys
function getValueByKeys(rawRow: Record<string, unknown>, keys: string[]): unknown {
  const trimmedRow: Record<string, unknown> = {};
  for (const key in rawRow) {
    trimmedRow[key.trim()] = rawRow[key];
  }

  for (const key of keys) {
    if (trimmedRow[key] !== undefined) {
      return trimmedRow[key];
    }
  }
  return undefined;
}

// null을 undefined로 변환하는 헬퍼
function nullToUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === null ? undefined : v])
  ) as T;
}

// 연락처를 기반으로 고객을 찾거나 새로 생성하는 함수 (Upsert)
async function findOrCreateCustomer(
  customerData: Partial<Customer>
): Promise<Customer> {
  const { phone, name } = customerData;
  if (!phone) {
    throw new Error(`고객 '${name}'의 연락처 정보가 없습니다.`);
  }

  // 1. 연락처로 기존 고객 검색
  const { data: existingCustomer, error: findError } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .single();

  if (findError && findError.code !== 'PGRST116') { // PGRST116: no rows found
    throw new Error(`고객 정보 조회 중 오류 발생: ${findError.message}`);
  }

  // 2. 기존 고객이 있으면 해당 정보 반환
  if (existingCustomer) {
    const base = nullToUndefined(existingCustomer);
    return {
      ...base,
      mobile: base.mobile ?? null,
      business_no: base.business_no ?? null,
      address: base.address ?? null,
      address_jibun: base.address_jibun ?? null,
      address_road: base.address_road ?? null,
      business_name: base.business_name ?? null,
      customer_type: base.customer_type ?? null,
      customer_type_multi: Array.isArray(base.customer_type_multi)
        ? base.customer_type_multi.filter((v: any) => typeof v === 'string')
        : null,
      fax: base.fax ?? null,
      representative_name: base.representative_name ?? null,
      ssn: base.ssn ?? null,
      zipcode: base.zipcode ?? null,
    };
  }

  // 3. 기존 고객이 없으면 새로 생성
  const { data: newCustomer, error: createError } = await supabase
    .from('customers')
    .insert({
      name: customerData.name || '이름 없음',
      phone: customerData.phone || '',
      // 엑셀에 없는 필수 값들은 기본값으로 채움
      business_number: '',
      representative_name: '',
      customer_type: '일반농민',
      grade: '일반',
    })
    .select()
    .single();

  if (createError) {
    throw new Error(`새로운 고객 생성 중 오류 발생: ${createError.message}`);
  }
  if (!newCustomer) {
    throw new Error('고객 생성에 실패했습니다.');
  }

  const base = nullToUndefined(newCustomer);
  return {
    ...base,
    mobile: base.mobile ?? null,
    business_no: base.business_no ?? null,
    address: base.address ?? null,
    address_jibun: base.address_jibun ?? null,
    address_road: base.address_road ?? null,
    business_name: base.business_name ?? null,
    customer_type: base.customer_type ?? null,
    customer_type_multi: Array.isArray(base.customer_type_multi)
      ? base.customer_type_multi.filter((v: any) => typeof v === 'string')
      : null,
    fax: base.fax ?? null,
    representative_name: base.representative_name ?? null,
    ssn: base.ssn ?? null,
    zipcode: base.zipcode ?? null,
  };
}


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const fileContent = Buffer.from(buffer).toString('utf8');
    let jsonData: Record<string, unknown>[];

    if (file.name.toLowerCase().endsWith('.csv')) {
      // CSV 파일 처리: papaparse로 파싱
      const parsed = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
      });
      jsonData = parsed.data as Record<string, unknown>[];
      if (parsed.errors.length > 0) {
        console.warn('CSV 파싱 중 일부 오류 발생:', parsed.errors);
      }
    } else {
      // 엑셀 파일 처리
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      jsonData = xlsx.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const row of jsonData) {
      try {
        const customerName = getValueByKeys(row, ['고객명', 'name']);
        const customerPhone = getValueByKeys(row, ['연락처', 'phone']);
        const revenue = getValueByKeys(row, ['매출액', 'revenue']) || 0;
        const deposit = getValueByKeys(row, ['수금액', 'deposit']) || 0;
        const description = getValueByKeys(row, ['거래내용', 'description']);

        if (!customerName || !customerPhone) {
          const availableHeaders = Object.keys(row).join(', ');
          throw new Error(`필수 컬럼(고객명, 연락처)을 찾을 수 없습니다. 실제 파일의 컬럼: [${availableHeaders}]`);
        }

        const customer = await findOrCreateCustomer({
          name: String(customerName || ''),
          phone: String(customerPhone || ''),
        });

        // 매출 거래 생성
        if (Number(revenue) > 0) {
          const { error } = await supabase.from('transactions').insert({
            customer_id: customer.id,
            description: String(description || '엑셀 업로드 매출'),
            type: '매출',
            amount: Number(revenue),
            status: 'unpaid' as const,
          });
          if (error) throw new Error(`매출 거래 생성 오류: ${error.message}`);
        }

        // 수금(입금) 거래 생성
        if (Number(deposit) > 0) {
          const { error } = await supabase.from('transactions').insert({
            customer_id: customer.id,
            description: String(description || '엑셀 업로드 수금'),
            type: '입금',
            amount: Number(deposit),
            status: 'paid' as const, // 입금은 '완납' 상태로 처리
          });
          if (error) throw new Error(`수금 거래 생성 오류: ${error.message}`);
        }
        
        // 매출과 수금이 모두 0인 경우도 하나의 행으로 간주하여 성공 카운트
        if (Number(revenue) === 0 && Number(deposit) === 0) {
            // 특별한 처리가 필요하다면 여기에 추가
        }

        successCount++;

      } catch (e: any) {
        errorCount++;
        errors.push(e.message);
      }
    }

    if (errorCount > 0) {
      return NextResponse.json({ 
        message: `일부 데이터 처리 중 오류 발생 (${successCount}건 성공, ${errorCount}건 실패)`,
        errors,
       }, { status: 400 });
    }

    return NextResponse.json({ message: `${successCount}건의 데이터가 성공적으로 처리되었습니다.` });

  } catch (error: any) {
    console.error('엑셀 파일 처리 중 심각한 오류 발생:', error);
    return NextResponse.json({ error: `서버 오류: ${error.message}` }, { status: 500 });
  }
} 
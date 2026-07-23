/**
 * SMS 발송 예정 고객 조회 API
 * 미수금 고객 중 특정 월 발송 대상 조회 (제외 여부 포함)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getArrearsCustomers } from '@/lib/solapi/service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/solapi/scheduled
 * 특정 월의 발송 예정 고객 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || getCurrentMonth(); // YYYY-MM 형식

    // 1. 미수금 고객 전체 조회
    const arrearsCustomers = await getArrearsCustomers(1); // 1원 이상

    if (arrearsCustomers.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          month,
          customers: [],
          stats: {
            total: 0,
            excluded: 0,
            scheduled: 0,
            totalAmount: 0,
            excludedAmount: 0,
            scheduledAmount: 0,
          }
        }
      });
    }

    // 2. 해당 월의 제외 목록 조회
    const { data: exclusions, error: exclusionError } = await supabase
      .from('sms_exclusions')
      .select('customer_id, reason, excluded_by, created_at')
      .eq('exclusion_month', month);

    if (exclusionError) {
      console.error('제외 목록 조회 오류:', exclusionError);
    }

    // 3. 제외 목록을 Map으로 변환 (빠른 조회)
    const exclusionMap = new Map();
    exclusions?.forEach((ex: any) => {
      exclusionMap.set(ex.customer_id, {
        reason: ex.reason,
        excludedBy: ex.excluded_by,
        excludedAt: ex.created_at,
      });
    });

    // 4. 고객 목록에 제외 여부 추가
    const customersWithStatus = arrearsCustomers.map(customer => {
      const exclusion = exclusionMap.get(customer.id);
      return {
        ...customer,
        isExcluded: !!exclusion,
        exclusionReason: exclusion?.reason || null,
        excludedBy: exclusion?.excludedBy || null,
        excludedAt: exclusion?.excludedAt || null,
      };
    });

    // 5. 통계 계산
    const totalCustomers = customersWithStatus.length;
    const excludedCustomers = customersWithStatus.filter(c => c.isExcluded);
    const scheduledCustomers = customersWithStatus.filter(c => !c.isExcluded);

    const stats = {
      total: totalCustomers,
      excluded: excludedCustomers.length,
      scheduled: scheduledCustomers.length,
      totalAmount: customersWithStatus.reduce((sum, c) => sum + c.totalArrears, 0),
      excludedAmount: excludedCustomers.reduce((sum, c) => sum + c.totalArrears, 0),
      scheduledAmount: scheduledCustomers.reduce((sum, c) => sum + c.totalArrears, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        month,
        customers: customersWithStatus,
        stats,
      }
    });

  } catch (error) {
    console.error('발송 예정 조회 API 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 현재 월을 YYYY-MM 형식으로 반환
 */
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

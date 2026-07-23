/**
 * 솔라피 API 상태 확인 라우트
 * 잔액 확인 및 API 연동 테스트
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBalance } from '@/lib/solapi/client';
import type { SolapiCredentials } from '@/types/solapi';

// 솔라피 인증 정보
const solapiCredentials: SolapiCredentials = {
  apiKey: process.env.SOLAPI_API_KEY || '',
  apiSecret: process.env.SOLAPI_API_SECRET || '',
  senderNumber: process.env.SOLAPI_SENDER_NUMBER || '',
};

/**
 * GET /api/solapi/status
 * 솔라피 API 상태 및 잔액 확인
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 정보 확인
    if (!solapiCredentials.apiKey || !solapiCredentials.apiSecret) {
      return NextResponse.json({
        success: false,
        error: 'Solapi credentials not configured',
        configured: false,
      }, { status: 400 });
    }

    // 잔액 조회
    const balanceResult = await getBalance(solapiCredentials);

    if (!balanceResult.success) {
      return NextResponse.json({
        success: false,
        error: balanceResult.errorMessage,
        configured: true,
        connected: false,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      configured: true,
      connected: true,
      data: {
        balance: balanceResult.balance,
        senderNumber: solapiCredentials.senderNumber,
        estimatedMessages: balanceResult.balance ? Math.floor(balanceResult.balance / 9) : 0, // SMS 기준
      },
    });

  } catch (error) {
    console.error('솔라피 상태 확인 오류:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}

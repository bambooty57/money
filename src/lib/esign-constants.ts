// =====================================================
// 전자서명(ESIGN) 공통 상수
// =====================================================
// 동의 문구를 수정할 때는 반드시 CONSENT_VERSION을 올리고
// 과거 버전 문구는 삭제하지 말 것 (과거 서명자가 어떤 문구에
// 동의했는지 추적하기 위함)

export const CONSENT_VERSION = 'v1.0';

export const CONSENT_TEXT = `본인은 위 거래내용을 확인하였으며, 거래 확인 목적으로 전자서명 이미지를 수집·저장하는 것에 동의합니다. (보유기간: 5년, 문서 열람 링크는 30일간 유효)`;

// PDF 마지막 페이지 서명란에 인쇄되는 문구
export const SIGNATURE_BOX_TEXT = `위 거래내용 및 개인정보 수집·이용(${CONSENT_VERSION})에 동의하며 서명합니다.`;

// 고객 열람 링크 유효 기간 (일)
export const LINK_EXPIRY_DAYS = 30;

// 인증 실패 허용 횟수 (도달 시 10분 잠금)
export const MAX_AUTH_ATTEMPTS = 5;

// 문서번호 접두사
export const DOCUMENT_NO_PREFIX = 'ST';

// 주민등록번호 마스킹 (전자본용): 680101-3****** 형태
export function maskSsn(ssn: string | null | undefined): string {
  if (!ssn) return '';
  const digits = ssn.replace(/[^0-9]/g, '');
  if (digits.length >= 7) {
    return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`;
  }
  if (digits.length === 6) {
    return digits;
  }
  return ssn;
}

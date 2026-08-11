"use client";

import React, { useEffect, useState, useCallback, use } from "react";

// 고객용 서명 거래명세서 열람 페이지 (로그인 불필요)
// 본인 인증: 생년월일 6자리(기본) 또는 전화번호 뒷 4자리(폴백)

interface PublicInfo {
  found: boolean;
  status: string;
  document_no: string;
  signed_at: string | null;
  expires_at: string | null;
  expired: boolean;
  locked: boolean;
  auth_method: 'ssn' | 'phone' | 'none';
  customer_name_masked: string | null;
}

export default function StatementViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [authInput, setAuthInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [verifiedInfo, setVerifiedInfo] = useState<{ document_no: string; signer_name: string; signed_at: string; customer_name: string } | null>(null);

  // 문서 공개 정보 로드
  useEffect(() => {
    fetch(`/api/public/statement/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setInfo(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  // 인증 처리
  const handleVerify = useCallback(async () => {
    if (!authInput.trim()) {
      setErrorMsg(info?.auth_method === 'ssn' ? '생년월일 6자리를 입력해 주세요.' : '전화번호 뒷 4자리를 입력해 주세요.');
      return;
    }
    setVerifying(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/public/statement/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth: authInput }),
      });
      const data = await res.json();

      if (data.ok) {
        // base64 → Blob URL
        const byteChars = atob(data.pdf_base64);
        const byteNumbers = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers], { type: 'application/pdf' });
        setPdfUrl(URL.createObjectURL(blob));
        setVerifiedInfo({
          document_no: data.document_no,
          signer_name: data.signer_name,
          signed_at: data.signed_at,
          customer_name: data.customer_name,
        });
      } else {
        if (data.reason === 'locked') {
          setErrorMsg('인증 시도 횟수를 초과했습니다. 10분 후 다시 시도해 주세요.');
          setInfo(prev => prev ? { ...prev, locked: true } : prev);
        } else if (data.reason === 'expired') {
          setInfo(prev => prev ? { ...prev, expired: true } : prev);
        } else if (data.reason === 'voided') {
          setInfo(prev => prev ? { ...prev, status: 'voided' } : prev);
        } else {
          setRemaining(typeof data.remaining === 'number' ? data.remaining : null);
          setErrorMsg(`인증 정보가 일치하지 않습니다.${typeof data.remaining === 'number' ? ` (남은 시도: ${data.remaining}회)` : ''}`);
        }
      }
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setVerifying(false);
    }
  }, [authInput, id, info?.auth_method]);

  // 로딩
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-500">문서를 불러오는 중...</div>
      </div>
    );
  }

  // 문서 없음
  if (notFound || !info) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold mb-2">문서를 찾을 수 없습니다</h1>
          <p className="text-gray-500">링크가 올바른지 확인해 주세요.</p>
        </div>
      </div>
    );
  }

  // 무효 처리된 문서
  if (info.status === 'voided') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-xl font-bold mb-2">무효 처리된 문서입니다</h1>
          <p className="text-gray-500">이 문서({info.document_no})는 무효 처리되었습니다.</p>
          <p className="text-gray-500 mt-2">문의: 구보다농기계 영암대리점 (010-2602-3276)</p>
        </div>
      </div>
    );
  }

  // 만료된 링크
  if (info.expired) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-bold mb-2">열람 기한이 지났습니다</h1>
          <p className="text-gray-500">열람 기한(30일)이 지났습니다.</p>
          <p className="text-gray-700 font-semibold mt-3">
            구보다농기계 영암대리점(010-2602-3276)으로<br />연락 주시면 다시 보내드립니다.
          </p>
        </div>
      </div>
    );
  }

  // 인증 성공 → PDF 표시
  if (pdfUrl && verifiedInfo) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <div className="bg-white shadow p-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-bold text-lg">📄 {verifiedInfo.customer_name}님 거래명세서</div>
            <div className="text-sm text-gray-500">
              문서번호: {verifiedInfo.document_no} · 서명일시: {new Date(verifiedInfo.signed_at).toLocaleString('ko-KR')}
            </div>
          </div>
          <a
            href={pdfUrl}
            download={`거래명세서_${verifiedInfo.document_no}.pdf`}
            className="bg-blue-600 text-white px-5 py-3 rounded-lg font-bold hover:bg-blue-700"
          >
            ⬇️ PDF 다운로드
          </a>
        </div>
        <iframe src={pdfUrl} className="flex-1 w-full" style={{ minHeight: '80vh' }} title="거래명세서 PDF" />
      </div>
    );
  }

  // 인증 화면
  const isSsn = info.auth_method === 'ssn';
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-2xl font-bold mb-1">거래명세서 열람</h1>
          <p className="text-gray-500">
            {info.customer_name_masked || ''}님의 문서 ({info.document_no})
          </p>
        </div>

        {info.locked ? (
          <div className="text-center">
            <p className="text-red-600 font-bold text-lg mb-2">인증이 잠겼습니다</p>
            <p className="text-gray-500">인증 시도 횟수를 초과했습니다.<br />10분 후 다시 시도해 주세요.</p>
          </div>
        ) : (
          <>
            <label className="block text-lg font-semibold mb-2">
              {isSsn ? '생년월일 6자리를 입력해 주세요' : '전화번호 뒷 4자리를 입력해 주세요'}
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={isSsn ? 6 : 4}
              value={authInput}
              onChange={(e) => {
                setAuthInput(e.target.value.replace(/[^0-9]/g, ''));
                setErrorMsg("");
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
              placeholder={isSsn ? '예: 680101' : '예: 1234'}
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-4 text-2xl text-center tracking-widest font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-200 mb-3"
              autoFocus
            />
            {errorMsg && (
              <div className="text-red-600 font-bold text-center mb-3">⚠️ {errorMsg}</div>
            )}
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="w-full bg-blue-600 text-white py-4 rounded-xl text-xl font-bold hover:bg-blue-700 disabled:bg-gray-400"
            >
              {verifying ? '확인 중...' : '확인'}
            </button>
            <p className="text-sm text-gray-400 text-center mt-4">
              본인 확인을 위해 {isSsn ? '생년월일' : '전화번호 뒷자리'}이 필요합니다.
              {remaining !== null && remaining <= 2 && (
                <span className="block text-red-500 font-bold mt-1">남은 시도: {remaining}회 (5회 실패 시 10분 잠금)</span>
              )}
            </p>
          </>
        )}

        <div className="text-center text-sm text-gray-400 mt-6 border-t pt-4">
          구보다농기계 영암대리점 · 문의: 010-2602-3276
        </div>
      </div>
    </div>
  );
}

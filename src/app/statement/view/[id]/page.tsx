"use client";

import React, { useEffect, useState, useCallback, useRef, use } from "react";

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
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [rendering, setRendering] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [verifiedInfo, setVerifiedInfo] = useState<{ document_no: string; signer_name: string; signed_at: string; customer_name: string } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // 문서 공개 정보 로드 및 자동 인증 실행
  useEffect(() => {
    let active = true;
    
    fetch(`/api/public/statement/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          if (active) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!active) return;
        setInfo(data);

        // 만약 유효한 서명 문서라면 즉시 검증 API를 호출해 PDF를 로드
        if (data.found && data.status === 'signed' && !data.expired && !data.locked) {
          setVerifying(true);
          const verifyRes = await fetch(`/api/public/statement/${id}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth: 'bypass' }),
          });
          const verifyData = await verifyRes.json();
          if (!active) return;

          if (verifyData.ok) {
            const byteChars = atob(verifyData.pdf_base64);
            const byteNumbers = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
              byteNumbers[i] = byteChars.charCodeAt(i);
            }
            const blob = new Blob([byteNumbers.slice()], { type: 'application/pdf' });
            setPdfUrl(URL.createObjectURL(blob));
            setPdfBytes(byteNumbers);
            setVerifiedInfo({
              document_no: verifyData.document_no,
              signer_name: verifyData.signer_name,
              signed_at: verifyData.signed_at,
              customer_name: verifyData.customer_name,
            });
          } else {
            if (verifyData.reason === 'locked') {
              setInfo(prev => prev ? { ...prev, locked: true } : prev);
            } else if (verifyData.reason === 'expired') {
              setInfo(prev => prev ? { ...prev, expired: true } : prev);
            } else if (verifyData.reason === 'voided') {
              setInfo(prev => prev ? { ...prev, status: 'voided' } : prev);
            } else {
              setErrorMsg('문서를 불러오는 데 실패했습니다.');
            }
          }
        }
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setVerifying(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  // 인증 처리 (수동 인증이 필요한 경우를 위한 fallback)
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
        // base64 → 바이트 배열
        const byteChars = atob(data.pdf_base64);
        const byteNumbers = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers.slice()], { type: 'application/pdf' });
        setPdfUrl(URL.createObjectURL(blob));
        setPdfBytes(byteNumbers);
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

  // 인증 성공 후: PDF.js로 전 페이지를 화면에 직접 렌더링
  // (모바일 브라우저는 iframe PDF 미지원이 많아 canvas 렌더링 방식 사용)
  useEffect(() => {
    if (!pdfBytes) return;
    let cancelled = false;

    (async () => {
      setRendering(true);
      setRenderError(null);
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();

        // pdf.js가 버퍼를 worker로 이전(transfer)하므로 사본 전달
        const doc = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
        const container = pdfContainerRef.current;
        if (!container || cancelled) return;
        container.innerHTML = '';

        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const baseViewport = page.getViewport({ scale: 1 });
          const containerWidth = container.clientWidth || window.innerWidth;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const scale = (containerWidth / baseViewport.width) * dpr;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.display = 'block';
          canvas.style.marginBottom = '8px';
          canvas.style.background = '#fff';
          canvas.style.boxShadow = '0 1px 4px rgba(0,0,0,0.15)';
          container.appendChild(canvas);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          }
        }
      } catch (e: any) {
        console.error('PDF 렌더링 오류:', e);
        if (!cancelled) setRenderError(e.message || String(e));
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfBytes]);

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

  // 인증 성공 → PDF 표시 (다운로드 버튼 삭제)
  if (pdfUrl && verifiedInfo) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <div className="bg-white shadow p-4 text-center">
          <div className="font-bold text-lg">📄 {verifiedInfo.customer_name}님 거래명세서</div>
          <div className="text-sm text-gray-500 mt-1">
            문서번호: {verifiedInfo.document_no} · 서명일시: {new Date(verifiedInfo.signed_at).toLocaleString('ko-KR')}
          </div>
        </div>
        {rendering && (
          <div className="text-center py-8 text-gray-500 text-lg">문서를 표시하는 중...</div>
        )}
        {renderError && (
          <div className="max-w-4xl mx-auto w-full p-4">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm">
              <p className="text-red-700 font-bold text-lg">⚠️ 화면을 표시하는 데 실패했습니다.</p>
              <p className="text-sm text-red-600 mt-1">오류 내용: {renderError}</p>
              <div className="text-sm text-gray-700 mt-4 leading-relaxed bg-white p-3 rounded border border-red-100">
                <span className="font-bold block mb-1">💡 해결 안내 지시어</span>
                1. 스마트폰 인앱 브라우저(카카오톡, 네이버 등) 또는 일부 구형 스마트폰 브라우저 환경에서는 PDF.js 뷰어 라이브러리가 호환되지 않을 수 있습니다.<br />
                2. 화면 우측 상단이나 하단의 <strong>더보기 버튼(삼점 메뉴 `...` 또는 설정 아이콘)</strong>을 클릭해 주세요.<br />
                3. <strong>&quot;다른 브라우저로 열기&quot;</strong> 또는 <strong>&quot;기본 브라우저로 열기&quot;</strong>(Chrome, Safari, 삼성 인터넷 등)를 선택하여 다시 접속하시면 정상적으로 표시됩니다.
              </div>
            </div>
          </div>
        )}
        {/* PDF.js가 페이지별 캔버스를 직접 삽입하는 영역 */}
        <div ref={pdfContainerRef} className="flex-1 w-full max-w-4xl mx-auto p-2" />
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

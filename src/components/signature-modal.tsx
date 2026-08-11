"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import SignaturePad from "signature_pad";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CONSENT_TEXT, CONSENT_VERSION } from "@/lib/esign-constants";

interface SignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  documentNo: string;      // 미리 채번된 문서번호 (pending-first)
  onComplete: (signatureDataUrl: string, consentAgreedAt: string) => void;
  saving?: boolean;        // 부모의 저장 진행 중 여부
}

export default function SignatureModal({
  open,
  onOpenChange,
  customerName,
  documentNo,
  onComplete,
  saving = false,
}: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const consentBoxRef = useRef<HTMLDivElement>(null);

  const [consentChecked, setConsentChecked] = useState(false);
  const [consentAgreedAt, setConsentAgreedAt] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [highlightConsent, setHighlightConsent] = useState(false);
  const [highlightCanvas, setHighlightCanvas] = useState(false);

  // 캔버스 초기화 (모달이 열릴 때마다)
  useEffect(() => {
    if (!open) return;

    // 상태 초기화
    setConsentChecked(false);
    setConsentAgreedAt(null);
    setHasSignature(false);
    setErrorMsg("");
    setHighlightConsent(false);
    setHighlightCanvas(false);

    // 다이얼로그 렌더링 이후 캔버스 세팅
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);

      const pad = new SignaturePad(canvas, {
        backgroundColor: "rgba(255, 255, 255, 0)", // 투명 배경: PDF 합성 시 텍스트를 가리지 않음
        penColor: "rgb(0, 0, 80)",
        minWidth: 1.5,
        maxWidth: 3.5,
      });
      pad.addEventListener("endStroke", () => setHasSignature(!pad.isEmpty()));
      padRef.current = pad;
    }, 150);

    return () => {
      clearTimeout(timer);
      padRef.current?.off();
      padRef.current = null;
    };
  }, [open]);

  // 동의 체크 처리
  const handleConsentChange = useCallback((checked: boolean) => {
    setConsentChecked(checked);
    setConsentAgreedAt(checked ? new Date().toISOString() : null);
    setErrorMsg("");
  }, []);

  // 서명 지우기
  const handleClear = useCallback(() => {
    padRef.current?.clear();
    setHasSignature(false);
  }, []);

  // 완료 버튼: 동의/서명 검증 후 부모에 전달
  const handleComplete = useCallback(() => {
    // 1. 동의 체크 검증
    if (!consentChecked) {
      setErrorMsg("개인정보 수집·이용 동의에 체크해 주세요.");
      setHighlightConsent(true);
      consentBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightConsent(false), 2000);
      return;
    }
    // 2. 서명 검증
    if (!padRef.current || padRef.current.isEmpty()) {
      setErrorMsg("서명을 입력해 주세요.");
      setHighlightCanvas(true);
      setTimeout(() => setHighlightCanvas(false), 2000);
      return;
    }

    const dataUrl = padRef.current.toDataURL("image/png");
    onComplete(dataUrl, consentAgreedAt || new Date().toISOString());
  }, [consentChecked, consentAgreedAt, onComplete]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            ✍️ 전자서명
          </DialogTitle>
        </DialogHeader>

        {/* 문서 정보 */}
        <div className="text-center text-lg text-gray-700 mb-2">
          <span className="font-bold text-blue-800">{customerName}</span>님 거래명세서
          <span className="ml-2 text-sm text-gray-500">문서번호: {documentNo}</span>
        </div>

        {/* 개인정보 수집·이용 동의 */}
        <div
          ref={consentBoxRef}
          className={`border-2 rounded-xl p-4 mb-3 transition-colors ${
            highlightConsent
              ? "border-red-500 bg-red-50"
              : consentChecked
                ? "border-green-400 bg-green-50"
                : "border-gray-300 bg-gray-50"
          }`}
        >
          <div className="font-bold text-lg mb-2">📋 개인정보 수집·이용 동의 ({CONSENT_VERSION})</div>
          <div className="text-base text-gray-700 leading-relaxed mb-3">
            <div>· 수집항목: 서명 이미지</div>
            <div>· 이용목적: 거래내용 확인 증빙</div>
            <div>· 보유기간: 5년 (문서 열람 링크는 30일간 유효)</div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => handleConsentChange(e.target.checked)}
              className="w-6 h-6 accent-blue-600"
              style={{ minWidth: 24, minHeight: 24 }}
            />
            <span className="text-lg font-bold">위 내용을 확인하고 동의합니다</span>
          </label>
        </div>

        {/* 서명 캔버스 */}
        <div
          className={`relative border-2 rounded-xl overflow-hidden mb-3 transition-colors ${
            highlightCanvas
              ? "border-red-500"
              : consentChecked
                ? "border-blue-400"
                : "border-gray-300"
          }`}
        >
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{
              height: 220,
              touchAction: "none",
              pointerEvents: consentChecked ? "auto" : "none",
              opacity: consentChecked ? 1 : 0.4,
              background: "#fff",
            }}
          />
          {!consentChecked && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-gray-500 bg-white/80 px-4 py-2 rounded-lg">
                먼저 위의 동의에 체크해 주세요
              </span>
            </div>
          )}
        </div>

        {/* 경고 메시지 */}
        {errorMsg && (
          <div className="text-center text-red-600 font-bold text-lg mb-2 animate-pulse">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* 안내 문구 (동의 내용 요약 — PDF에도 인쇄됨) */}
        <div className="text-xs text-gray-400 mb-2 text-center">{CONSENT_TEXT}</div>

        {/* 버튼 */}
        <div className="flex gap-3 justify-center">
          <Button
            onClick={handleClear}
            disabled={saving || !consentChecked}
            className="bg-yellow-500 text-white px-5 py-3 rounded-lg text-lg font-bold hover:bg-yellow-600 disabled:bg-gray-300"
          >
            🔄 다시하기
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="bg-gray-400 text-white px-5 py-3 rounded-lg text-lg font-bold hover:bg-gray-500 disabled:bg-gray-300"
          >
            취소
          </Button>
          <Button
            onClick={handleComplete}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-bold hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? "저장 중..." : "✅ 서명 완료 및 저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

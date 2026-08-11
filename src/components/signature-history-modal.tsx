"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface StatementRecord {
  id: string;
  document_no: string;
  signer_name: string | null;
  status: string;
  signed_at: string | null;
  expires_at: string | null;
  sms_sent_at: string | null;
  viewed_at: string | null;
  view_count: number | null;
  resend_count: number | null;
  total_unpaid: number | null;
  void_reason: string | null;
  created_at: string | null;
}

interface SignatureHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
}

// 거래명세서 페이지용 서명 이력 모달 (열 때만 lazy fetch)
export default function SignatureHistoryModal({
  open,
  onOpenChange,
  customerId,
  customerName,
}: SignatureHistoryModalProps) {
  const [records, setRecords] = useState<StatementRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 모달 열 때만 데이터 로드 (성능 최적화)
  const loadRecords = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`/api/statements?customer_id=${customerId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const result = await res.json();
      if (res.ok) {
        setRecords(result.data || []);
      } else {
        alert('서명 이력 조회 실패: ' + (result.error || res.statusText));
      }
    } catch (error) {
      console.error('서명 이력 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (open) {
      loadRecords();
      setSelectedIds([]);
    }
  }, [open, loadRecords]);

  // 관리자용 PDF 보기 (새 탭)
  const handleView = useCallback(async (recordId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      alert('로그인이 필요합니다.');
      return;
    }
    try {
      const res = await fetch(`/api/statements/${recordId}/file`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('PDF 조회 실패: ' + (err.error || res.statusText));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      alert('PDF 조회 중 오류가 발생했습니다.');
    }
  }, []);

  // 재발송 (만료기한 30일 갱신 + 문자 재발송)
  const handleResend = useCallback(async (recordId: string) => {
    if (!window.confirm('열람 링크를 30일 연장하고 문자를 재발송하시겠습니까?')) return;
    setActionId(recordId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`/api/statements/${recordId}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (res.ok) {
        alert('✅ 재발송되었습니다. (열람 기한 30일 연장)');
        loadRecords();
      } else {
        alert('재발송 실패: ' + (result.error || res.statusText));
      }
    } catch {
      alert('재발송 중 오류가 발생했습니다.');
    } finally {
      setActionId(null);
    }
  }, [loadRecords]);

  // 무효 처리
  const handleVoid = useCallback(async (recordId: string) => {
    const reason = window.prompt('무효 처리 사유를 입력해 주세요 (예: 고객 서명 실수)');
    if (reason === null) return; // 취소
    if (!window.confirm('정말 무효 처리하시겠습니까? 문서는 삭제되지 않고 무효 상태로 보존됩니다.')) return;
    setActionId(recordId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`/api/statements/${recordId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reason }),
      });
      const result = await res.json();
      if (res.ok) {
        alert('무효 처리되었습니다.');
        loadRecords();
      } else {
        alert('무효 처리 실패: ' + (result.error || res.statusText));
      }
    } catch {
      alert('무효 처리 중 오류가 발생했습니다.');
    } finally {
      setActionId(null);
    }
  }, [loadRecords]);

  // 선택 삭제 처리
  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.length}건의 거래명세서를 정말 삭제하시겠습니까?\n삭제된 문서는 복구할 수 없습니다.`)) return;

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`/api/statements`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const result = await res.json();
      if (res.ok) {
        alert('선택한 거래명세서가 삭제되었습니다.');
        setSelectedIds([]);
        loadRecords();
      } else {
        alert('삭제 실패: ' + (result.error || res.statusText));
      }
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedIds, loadRecords]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(records.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const formatDate = (v: string | null) => v ? new Date(v).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
  const isExpired = (v: string | null) => v ? new Date(v) < new Date() : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            📋 {customerName}님의 서명된 명세서 ({records.length}건)
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-center my-2">
          <div>
            {selectedIds.length > 0 && (
              <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                {selectedIds.length}건 선택됨
              </span>
            )}
          </div>
          {selectedIds.length > 0 && (
            <Button
              onClick={handleDeleteSelected}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg"
            >
              🗑️ 선택 삭제
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500 text-lg">불러오는 중...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-lg">서명된 명세서가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-base border-collapse">
              <thead>
                <tr className="bg-blue-50 border-b-2 border-blue-200">
                  <th className="px-3 py-2 text-center w-12">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={records.length > 0 && selectedIds.length === records.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-2 text-left">문서번호</th>
                  <th className="px-3 py-2 text-center">서명일시</th>
                  <th className="px-3 py-2 text-right">잔금</th>
                  <th className="px-3 py-2 text-center">상태</th>
                  <th className="px-3 py-2 text-center">고객확인</th>
                  <th className="px-3 py-2 text-center">만료일</th>
                  <th className="px-3 py-2 text-center">작업</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className={`border-b ${r.status === 'voided' ? 'bg-gray-100 text-gray-400' : 'hover:bg-gray-50'}`}>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) => handleSelectRow(r.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-3 font-mono font-bold">{r.document_no}</td>
                    <td className="px-3 py-3 text-center">{formatDate(r.signed_at)}</td>
                    <td className="px-3 py-3 text-right">{(r.total_unpaid || 0).toLocaleString()}원</td>
                    <td className="px-3 py-3 text-center">
                      {r.status === 'signed' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-bold">유효</span>}
                      {r.status === 'pending' && <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-bold">대기</span>}
                      {r.status === 'voided' && (
                        <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded font-bold" title={r.void_reason || ''}>
                          무효{r.void_reason ? ` (${r.void_reason})` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {r.viewed_at ? (
                        <span className="text-green-600 font-bold" title={`최초확인: ${formatDate(r.viewed_at)}`}>
                          ✅ 확인함 ({r.view_count || 0}회)
                        </span>
                      ) : r.status === 'signed' ? (
                        <span className="text-gray-400">⏳ 미확인</span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {r.expires_at ? (
                        <span className={isExpired(r.expires_at) ? 'text-red-500 font-bold' : ''}>
                          {isExpired(r.expires_at) ? '만료됨' : formatDate(r.expires_at)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => handleView(r.id)}
                          disabled={r.status === 'pending' || actionId === r.id}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-blue-700 disabled:bg-gray-300"
                        >
                          👁️ 보기
                        </Button>
                        {r.status === 'signed' && (
                          <>
                            <Button
                              onClick={() => handleResend(r.id)}
                              disabled={actionId === r.id}
                              className="bg-purple-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-purple-700 disabled:bg-gray-300"
                            >
                              {actionId === r.id ? '처리중' : '📱 재발송'}
                            </Button>
                            <Button
                              onClick={() => handleVoid(r.id)}
                              disabled={actionId === r.id}
                              className="bg-gray-500 text-white px-3 py-1 rounded text-sm font-bold hover:bg-gray-600 disabled:bg-gray-300"
                            >
                              🚫 무효
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <Button onClick={() => onOpenChange(false)} className="bg-gray-400 text-white px-4 py-2 rounded-lg font-bold">닫기</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

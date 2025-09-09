import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';
import { Alert } from './ui/alert';

interface PaymentFormProps {
  transactionId: string | null;
  payment?: any; // 수정 시 기존 payment 데이터
  onSuccess: () => void;
}

export default function PaymentForm({ transactionId, payment, onSuccess }: PaymentFormProps) {
  const [formData, setFormData] = useState({
    amount: payment?.amount?.toString() || '',
    paid_at: payment?.paid_at?.slice(0, 10) || '',
    method: payment?.method || '',
    payer_name: payment?.payer_name || '',
    note: payment?.note || '',
    bank_name: payment?.bank_name || '',
    account_number: payment?.account_number || '',
    account_holder: payment?.account_holder || '',
    cash_place: payment?.cash_place || '',
    cash_receiver: payment?.cash_receiver || '',
    detail: payment?.detail || '',
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (payment) {
      setFormData({
        amount: payment.amount?.toString() || '',
        paid_at: payment.paid_at?.slice(0, 10) || '',
        method: payment.method || '',
        payer_name: payment.payer_name || '',
        note: payment.note || '',
        bank_name: payment.bank_name || '',
        account_number: payment.account_number || '',
        account_holder: payment.account_holder || '',
        cash_place: payment.cash_place || '',
        cash_receiver: payment.cash_receiver || '',
        detail: payment.detail || '',
      });
    }
  }, [payment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (!transactionId) throw new Error('거래 정보가 없습니다.');
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        transaction_id: transactionId,
        paid_at: formData.paid_at,
      };
      let res, error;
      if (payment) {
        // 수정
        ({ error } = await supabase.from('payments').update(payload).eq('id', payment.id));
      } else {
        // 등록
        ({ error } = await supabase.from('payments').insert(payload));
      }
      if (error) throw error;
      setSuccessMsg(payment ? '입금 수정 완료' : '입금 등록 완료');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || '저장 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!payment?.id) return;
    if (!window.confirm('정말로 이 입금내역을 삭제하시겠습니까?')) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('payments').delete().eq('id', payment.id);
      if (error) throw error;
      setSuccessMsg('입금 삭제 완료');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || '삭제 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-8 w-full max-w-2xl mx-auto bg-green-50 rounded-2xl border-2 border-green-200 shadow-2xl">
      {successMsg && <Alert variant="default" className="text-xl font-bold flex items-center gap-2 bg-green-50 border-green-300 text-green-700 p-4 rounded-lg shadow-lg mb-4"><span>✅</span>{successMsg}</Alert>}
      {errorMsg && <Alert variant="destructive" className="text-xl font-bold flex items-center gap-2 bg-red-50 border-red-300 text-red-700 p-4 rounded-lg shadow-lg mb-4"><span>❌</span>{errorMsg}</Alert>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-xl font-bold flex items-center gap-2">💰 금액<span className="text-red-500">*</span></label>
          <input type="number" required value={formData.amount} onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))} className="w-full rounded-lg border-2 border-green-300 px-4 py-3 text-lg focus:border-green-500 focus:ring-2 focus:ring-green-200" placeholder="예: 100000" title="입금 금액 입력" />
        </div>
        <div>
          <label className="text-xl font-bold flex items-center gap-2">📅 입금일<span className="text-red-500">*</span></label>
          <input type="date" required value={formData.paid_at} onChange={e => setFormData(f => ({ ...f, paid_at: e.target.value }))} className="w-full rounded-lg border-2 border-green-300 px-4 py-3 text-lg focus:border-green-500 focus:ring-2 focus:ring-green-200" title="입금일 선택" />
        </div>
        <div>
          <label className="text-xl font-bold flex items-center gap-2">💳 방법</label>
          <select value={formData.method} onChange={e => setFormData(f => ({ ...f, method: e.target.value }))} className="w-full rounded-lg border-2 border-purple-300 px-4 py-3 text-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200" title="입금 방법 선택">
            <option value="">선택</option>
            <option value="현금">현금</option>
            <option value="계좌이체">계좌이체</option>
            <option value="카드">카드</option>
            <option value="기타">기타</option>
          </select>
        </div>
        <div>
          <label className="text-xl font-bold flex items-center gap-2">👤 입금자</label>
          <input type="text" value={formData.payer_name} onChange={e => setFormData(f => ({ ...f, payer_name: e.target.value }))} className="w-full rounded-lg border-2 border-blue-300 px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="입금자명" title="입금자명 입력" />
        </div>
        <div>
          <label className="text-xl font-bold flex items-center gap-2">🏦 은행명</label>
          <input type="text" value={formData.bank_name} onChange={e => setFormData(f => ({ ...f, bank_name: e.target.value }))} className="w-full rounded-lg border-2 border-blue-300 px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="은행명" title="은행명 입력" />
        </div>
        <div>
          <label className="text-xl font-bold flex items-center gap-2">🔢 계좌번호</label>
          <input type="text" value={formData.account_number} onChange={e => setFormData(f => ({ ...f, account_number: e.target.value }))} className="w-full rounded-lg border-2 border-blue-300 px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="계좌번호" title="계좌번호 입력" />
        </div>
        <div>
          <label className="text-xl font-bold flex items-center gap-2">👤 예금주</label>
          <input type="text" value={formData.account_holder} onChange={e => setFormData(f => ({ ...f, account_holder: e.target.value }))} className="w-full rounded-lg border-2 border-blue-300 px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="예금주" title="예금주 입력" />
        </div>
        <div>
          <label className="text-xl font-bold flex items-center gap-2">🏢 현금 장소</label>
          <input type="text" value={formData.cash_place} onChange={e => setFormData(f => ({ ...f, cash_place: e.target.value }))} className="w-full rounded-lg border-2 border-orange-300 px-4 py-3 text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="현금 장소" title="현금 장소 입력" />
        </div>
        <div>
          <label className="text-xl font-bold flex items-center gap-2">👤 현금 수령자</label>
          <input type="text" value={formData.cash_receiver} onChange={e => setFormData(f => ({ ...f, cash_receiver: e.target.value }))} className="w-full rounded-lg border-2 border-orange-300 px-4 py-3 text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="현금 수령자" title="현금 수령자 입력" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xl font-bold flex items-center gap-2">📝 상세/비고</label>
          <textarea value={formData.detail} onChange={e => setFormData(f => ({ ...f, detail: e.target.value }))} className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-lg focus:border-gray-500 focus:ring-2 focus:ring-gray-200" rows={2} placeholder="상세/비고" title="상세/비고 입력" />
        </div>
      </div>
      <div className="flex justify-center gap-4 mt-6">
        <Button type="submit" disabled={loading} className={`text-2xl px-8 py-4 rounded-lg shadow-lg ${loading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} text-white font-bold transition-colors duration-200`}>
          {loading ? '처리중...' : (payment ? '✏️ 수정하기' : '➕ 등록하기')}
        </Button>
        {payment && (
          <Button type="button" onClick={handleDelete} disabled={loading} className="text-2xl px-8 py-4 rounded-lg shadow-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors duration-200">
            🗑️ 삭제
          </Button>
        )}
        <Button type="button" onClick={() => { if (onSuccess) onSuccess(); }} disabled={loading} className="text-2xl px-8 py-4 rounded-lg shadow-lg bg-gray-400 hover:bg-gray-500 text-white font-bold transition-colors duration-200">
          취소하기
        </Button>
      </div>
    </form>
  );
} 
"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import type { Database } from '@/types/database';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import { Trash2, FileText, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs/promises';
import path from 'path';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import TransactionForm from '@/components/transaction-form';
import { useRouter } from 'next/navigation';
import { useRefreshContext } from '@/lib/refresh-context';
import { usePaymentsRealtime } from '@/lib/usePaymentsRealtime';
import { createClient } from '@/lib/supabase';
import { useToast } from '@/components/ui/alert';
import { VirtualList } from '@/components/ui/virtual-list';

type Transaction = Database['public']['Tables']['transactions']['Row'];
type File = Database['public']['Tables']['files']['Row'];
type PaymentType = Database['public']['Tables']['payments']['Row'];

type TransactionWithDetails = Transaction & {
  customers?: any;
  files?: any[];
  models_types?: any;
  payments?: any[];
};

interface Props {
  transactions: TransactionWithDetails[];
  initialSelectedId?: string;
  customerId?: string;
  onPaymentSuccess?: () => void;
}

const SignaturePad = dynamic(() => import('./SignaturePad'), { ssr: false });

// 계좌 목록 상수 추가 (파일 상단)
const ACCOUNT_LIST = [
  { bank: '농협', number: '302-2602-3276-61', holder: '정현목' },
  { bank: '농협', number: '603113-56-016359', holder: '최형섭' },
];

// 은행/카드사 목록 상수 추가
const KOREA_BANKS = [
  '국민은행', '신한은행', '우리은행', '하나은행', '농협은행', '기업은행', 'SC제일은행', '씨티은행', '케이뱅크', '카카오뱅크', '토스뱅크', '수협은행', '대구은행', '부산은행', '경남은행', '광주은행', '전북은행', '제주은행', '우체국', '새마을금고', '신협', '기타(직접입력)'
];
const KOREA_CARD_COMPANIES = [
  '신한카드', '삼성카드', 'KB국민카드', '현대카드', '롯데카드', '우리카드', '하나카드', '비씨카드', 'NH농협카드', '씨티카드', 'IBK기업카드', '수협카드', '광주카드', '전북카드', '제주카드', '기타(직접입력)'
];

// 파일 상단에 toFile 함수 선언
const toFile = (f: any): File => ({
  id: String(f.id),
  customer_id: String(f.customer_id),
  transaction_id: f.transaction_id ? String(f.transaction_id) : null,
  name: String(f.name),
  type: String(f.type),
  url: String(f.url),
  created_at: String(f.created_at),
});

// Payment 등록 폼 컴포넌트
function PaymentForm({ transactionId, onSuccess, setSuccessMsg, setErrorMsg }: { transactionId: string, onSuccess: () => void, setSuccessMsg: (msg: string) => void, setErrorMsg: (msg: string) => void }) {
  const [method, setMethod] = useState('현금');
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [payerName, setPayerName] = useState('');
  // 카드 결제용
  const [cardName, setCardName] = useState('');
  const [paidLocation, setPaidLocation] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [note, setNote] = useState('');
  // 현금/계좌이체용(간략화)
  const [cashPlace, setCashPlace] = useState('');
  const [cashReceiver, setCashReceiver] = useState('');
  const [cashDetail, setCashDetail] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  // 중고인수용
  const [usedModelType, setUsedModelType] = useState('');
  const [usedModel, setUsedModel] = useState('');
  const [usedPlace, setUsedPlace] = useState('');
  const [usedBy, setUsedBy] = useState('');
  const [usedAt, setUsedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [otherReason, setOtherReason] = useState('');
  const [accountSelect, setAccountSelect] = useState(''); // ''=직접입력, index=계좌목록
  const [bankName, setBankName] = useState('');
  const [customBankName, setCustomBankName] = useState('');
  const [recentAccountNumbers, setRecentAccountNumbers] = useState<string[]>([]);
  const [loanDetail, setLoanDetail] = useState('');
  const [otherDetail, setOtherDetail] = useState('');
  const [otherNote, setOtherNote] = useState('');
  // 수표 다중입력용 (발행은행/금액/수표번호)
  const [cheques, setCheques] = useState<{bank: string, amount: string, number: string}[]>([{bank: '', amount: '', number: ''}]);

  // 수표 합계 계산
  const chequeTotal = cheques.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

  // 수표 추가/삭제/수정 핸들러
  const addCheque = () => setCheques([...cheques, {bank: '', amount: '', number: ''}]);
  const removeCheque = (idx: number) => setCheques(cheques.length === 1 ? cheques : cheques.filter((_, i) => i !== idx));
  const updateCheque = (idx: number, key: 'bank'|'amount'|'number', value: string) => setCheques(cheques.map((c, i) => i === idx ? {...c, [key]: value} : c));

  useEffect(() => {
    if (method === '계좌이체') {
      const list = JSON.parse(localStorage.getItem('recentAccountNumbers') || '[]');
      setRecentAccountNumbers(list);
    }
  }, [method]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (typeof setSuccessMsg === 'function') setSuccessMsg('');
    if (typeof setErrorMsg === 'function') setErrorMsg('');
    try {
      const payload: any = {
        transaction_id: transactionId || '',
        amount: Math.round(parseFloat(amount)),
        paid_at: paidAt,
        method,
        payer_name: payerName,
      };
      if (method === '현금') {
        payload.cash_place = cashPlace;
        payload.cash_receiver = cashReceiver;
        payload.cash_detail = cashDetail;
        payload.note = note;
      }
      if (method === '계좌이체') {
        payload.account_number = accountNumber;
        payload.account_holder = accountHolder;
        payload.note = note;
        payload.bank_name = bankName === '기타(직접입력)' ? customBankName : bankName;
      }
      if (method === '카드') {
        payload.card_name = cardName;
        payload.paid_location = paidLocation;
        payload.paid_by = paidBy;
        payload.note = note;
        payload.bank_name = bankName === '기타(직접입력)' ? customBankName : bankName;
      }
      if (method === '중고인수') {
        payload.used_model_type = usedModelType;
        payload.used_model = usedModel;
        payload.used_place = usedPlace;
        payload.used_by = usedBy;
        payload.used_at = usedAt ? usedAt : null;
        payload.amount = Math.round(parseFloat(amount)); // 인수금액
        payload.note = note;
      }
      if (method === '융자') {
        payload.bank_name = bankName === '기타(직접입력)' ? customBankName : bankName;
        payload.detail = loanDetail;
        payload.note = note;
      }
      if (method === '캐피탈') {
        payload.bank_name = bankName === '기타(직접입력)' ? customBankName : bankName;
        payload.detail = loanDetail;
        payload.note = note;
      }
      if (method === '기타') {
        payload.detail = otherDetail;
        payload.note = otherNote;
      }
      if (method === '수표') {
        payload.cheques = JSON.stringify(cheques);
        payload.amount = Math.round(chequeTotal);
        payload.note = note;
      }
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('저장 실패');
      setAmount(''); setPaidAt(''); setPayerName(''); setCardName(''); setPaidLocation(''); setPaidBy(''); setCashPlace(''); setCashReceiver(''); setCashDetail(''); setAccountNumber(''); setAccountHolder(''); setNote(''); setUsedModelType(''); setUsedModel(''); setUsedPlace(''); setUsedBy(''); setUsedAt(''); setOtherReason(''); setLoanDetail(''); setOtherDetail(''); setOtherNote(''); setCheques([{bank: '', amount: '', number: ''}]);
      if (typeof setSuccessMsg === 'function') setSuccessMsg('입금 등록이 완료되었습니다.');
      onSuccess();
      if (res.ok && method === '계좌이체') {
        let list = JSON.parse(localStorage.getItem('recentAccountNumbers') || '[]');
        list = [accountNumber, ...list.filter((n: string) => n !== accountNumber)];
        if (list.length > 5) list = list.slice(0, 5);
        localStorage.setItem('recentAccountNumbers', JSON.stringify(list));
        setRecentAccountNumbers(list);
      }
    } catch (err: any) {
      if (typeof setErrorMsg === 'function') setErrorMsg((err as Error).message || '저장 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };
  // 계좌 선택 핸들러
  function handleAccountSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setAccountSelect(val);
    if (val === '') {
      setAccountNumber('');
      setAccountHolder('');
    } else {
      const idx = parseInt(val, 10);
      setAccountNumber(ACCOUNT_LIST[idx].number);
      setAccountHolder(ACCOUNT_LIST[idx].holder);
    }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-blue-50 p-6 rounded-lg mb-6 border-2 border-blue-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-lg font-bold text-gray-800">입금방법</label>
          <select value={method} onChange={e => setMethod(e.target.value)} className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" title="입금방법 선택">
            <option value="현금">💰 현금</option>
            <option value="계좌이체">🏦 계좌이체</option>
            <option value="카드">💳 카드</option>
            <option value="수표">💵 수표</option>
            <option value="중고인수">🚜 중고인수</option>
            <option value="융자">📋 융자</option>
            <option value="캐피탈">🏢 캐피탈</option>
            <option value="기타">📝 기타</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-lg font-bold text-gray-800">입금일자</label>
          <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" required title="입금일자" placeholder="입금일자" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-lg font-bold text-gray-800">입금자</label>
          <input type="text" value={payerName} onChange={e => setPayerName(e.target.value)} className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" required title="입금자" placeholder="입금자를 입력하세요" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-lg font-bold text-gray-800">금액</label>
          <input type="number" value={method === '수표' ? chequeTotal : amount} onChange={e => setAmount(e.target.value)} className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" required title="금액" placeholder="금액을 입력하세요" disabled={method==='수표'} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-lg font-bold text-gray-800">비고</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="비고를 입력하세요"
          />
        </div>
      </div>
      {method === '카드' && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded">
          <label>카드회사명</label>
          <select value={bankName} onChange={e => setBankName(e.target.value)} className="border rounded px-2 py-1" required title="카드회사명 선택">
            <option value="">카드회사 선택</option>
            {KOREA_CARD_COMPANIES.map((c, i) => <option key={i} value={c}>{c}</option>)}
          </select>
          {bankName === '기타(직접입력)' && (
            <input type="text" value={customBankName} onChange={e => setCustomBankName(e.target.value)} className="border rounded px-2 py-1" placeholder="카드회사명 직접입력" required />
          )}
          <label>결제장소</label>
          <input type="text" value={paidLocation} onChange={e => setPaidLocation(e.target.value)} className="border rounded px-2 py-1" title="결제장소" placeholder="결제장소" />
          <label>담당자</label>
          <input type="text" value={paidBy} onChange={e => setPaidBy(e.target.value)} className="border rounded px-2 py-1" title="담당자" placeholder="담당자" />
          <label>비고</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" title="비고" placeholder="비고" />
        </div>
      )}
      {method === '현금' && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded">
          <label>입금장소</label>
          <input type="text" value={cashPlace} onChange={e => setCashPlace(e.target.value)} className="border rounded px-2 py-1" title="입금장소" placeholder="입금장소" />
          <label>수령자</label>
          <input type="text" value={cashReceiver} onChange={e => setCashReceiver(e.target.value)} className="border rounded px-2 py-1" title="수령자" placeholder="수령자" />
          <label>상세</label>
          <input type="text" value={cashDetail} onChange={e => setCashDetail(e.target.value)} className="border rounded px-2 py-1" title="상세" placeholder="상세" />
          <label>비고</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" title="비고" placeholder="비고" />
        </div>
      )}
      {method === '계좌이체' && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded">
          <label>입금은행</label>
          <select value={bankName} onChange={e => setBankName(e.target.value)} className="border rounded px-2 py-1" title="입금은행 선택" required>
            <option value="">입금은행 선택</option>
            {KOREA_BANKS.map((b, i) => <option key={i} value={b}>{b}</option>)}
          </select>
          {bankName === '기타(직접입력)' && (
            <input type="text" value={customBankName} onChange={e => setCustomBankName(e.target.value)} className="border rounded px-2 py-1" placeholder="입금은행명 직접입력" required />
          )}
          <label>계좌번호</label>
          <input
            type="text"
            value={accountNumber}
            onChange={e => { setAccountNumber(e.target.value); setAccountSelect(''); }}
            className="border rounded px-2 py-1"
            title="최근 계좌번호 선택"
            placeholder="계좌번호"
            list="recent-account-numbers"
          />
          <datalist id="recent-account-numbers">
            {recentAccountNumbers.map((num) => (
              <option key={num} value={num} />
            ))}
          </datalist>
          <label>예금주</label>
          <input type="text" value={accountHolder} onChange={e => { setAccountHolder(e.target.value); setAccountSelect(''); }} className="border rounded px-2 py-1" title="예금주" placeholder="예금주" />
          <label>비고</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" title="비고" placeholder="비고" />
        </div>
      )}
      {method === '중고인수' && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded">
          <label>담당자</label>
          <input type="text" value={usedBy} onChange={e => setUsedBy(e.target.value)} className="border rounded px-2 py-1" title="담당자" placeholder="담당자" required={method==='중고인수'} />
          <label>인수장소</label>
          <input type="text" value={usedPlace} onChange={e => setUsedPlace(e.target.value)} className="border rounded px-2 py-1" title="인수장소" placeholder="인수장소" required={method==='중고인수'} />
          <label>기종</label>
          <input type="text" value={usedModelType} onChange={e => setUsedModelType(e.target.value)} className="border rounded px-2 py-1" title="기종" placeholder="기종" required={method==='중고인수'} />
          <label>모델</label>
          <input type="text" value={usedModel} onChange={e => setUsedModel(e.target.value)} className="border rounded px-2 py-1" title="모델" placeholder="모델" required={method==='중고인수'} />
          <label>비고</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" title="비고" placeholder="비고" />
        </div>
      )}
      {(method === '융자' || method === '캐피탈') && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded">
          <label>상세</label>
          <input type="text" value={loanDetail} onChange={e => setLoanDetail(e.target.value)} className="border rounded px-2 py-1" title="상세" placeholder="상세" />
          <label>비고</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" title="비고" placeholder="비고" />
        </div>
      )}
      {method === '기타' && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded">
          <label>상세</label>
          <input type="text" value={otherDetail} onChange={e => setOtherDetail(e.target.value)} className="border rounded px-2 py-1" title="상세" placeholder="상세" required={method==='기타'} />
          <label>비고</label>
          <input type="text" value={otherNote} onChange={e => setOtherNote(e.target.value)} className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" title="비고" placeholder="비고" />
        </div>
      )}
      {method === '수표' && (
        <div className="bg-white border rounded-lg p-3 mt-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-blue-700">💵 수표내역 (여러장 입력 가능)</span>
            <button type="button" className="ml-auto bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 text-lg font-bold" onClick={addCheque}>+ 추가</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
            {cheques.map((c, idx) => (
              <div key={idx} className="flex gap-2 items-center mb-2 flex-wrap">
                <select className="border rounded px-2 py-1 w-32" value={c.bank} onChange={e => updateCheque(idx, 'bank', e.target.value)} required title="발행은행 선택">
                  <option value="">발행은행</option>
                  {KOREA_BANKS.map((b, i) => <option key={i} value={b}>{b}</option>)}
                </select>
                <input type="number" min="0" step="1000" className="border rounded px-2 py-1 w-28" placeholder="금액" value={c.amount} onChange={e => updateCheque(idx, 'amount', e.target.value)} required />
                <input type="text" className="border rounded px-2 py-1 w-40" placeholder="수표번호" value={c.number} onChange={e => updateCheque(idx, 'number', e.target.value)} required />
                <button type="button" className="bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 text-base font-bold" onClick={() => removeCheque(idx)} disabled={cheques.length===1}>삭제</button>
              </div>
            ))}
          </div>
          <div className="text-right font-bold text-blue-600 mt-2">합계: {chequeTotal.toLocaleString()}원</div>
        </div>
      )}
      <div className="flex justify-center mt-8">
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-xl font-bold min-w-[200px] shadow-lg transition-colors duration-200 focus:ring-4 focus:ring-blue-300" disabled={loading}>
          {loading ? '저장 중...' : '💾 입금 등록'}
        </button>
      </div>
    </form>
  );
}

// 첨부서류 유형 상수
const ATTACHMENT_TYPES = [
  '계약서', '융자서류', '입금표', '채권확인서', '내용증명', '약속서류', '기타서류',
  '신분증 사본', '사업자등록증', '등기부등본', '세금계산서/영수증'
];

// 파일명/폴더명 sanitize 함수 추가
function sanitizeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_') // 영문, 숫자, ., _, -만 허용
    .replace(/_+/g, '_'); // 연속된 _는 하나로
}

// 고객정보 표시용 함수 추가
const displayValue = (v: any) => v !== undefined && v !== null && String(v).trim() !== '' ? v : '정보 없음';

// pdf-lib 기반 한글 PDF 내보내기 함수
async function handlePdfExportPdfLib(selectedTx: TransactionWithDetails, filteredPayments: PaymentType[], setErrorMsg?: (msg: string) => void) {
  try {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const page = pdfDoc.addPage([595, 842]); // A4

    // 폰트 로드
    const fontUrl = '/Noto_Sans_KR/static/NotoSansKR-Regular.ttf';
    const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
    const font = await pdfDoc.embedFont(fontBytes);

    // 1. 상단 헤더 정렬 (로고, 제목, 출력일 같은 높이로 배치)
    const headerY = 780; // 공통 기준선
    
    // 로고 이미지 (좌측)
    try {
      const logoUrl = '/kubotalogo5.png';
      const logoResponse = await fetch(logoUrl);
      if (logoResponse.ok) {
        const logoBytes = await logoResponse.arrayBuffer();
        const logoImg = await pdfDoc.embedPng(logoBytes);
        // 로고 중앙 정렬을 위해 y 위치 조정
        page.drawImage(logoImg, { x: 50, y: headerY - 20, width: 150, height: 60 });
        console.log('✅ 로고 이미지 로드 성공');
      } else {
        console.warn('⚠️ 로고 파일을 찾을 수 없습니다:', logoUrl);
      }
    } catch (logoError) {
      console.error('❌ 로고 로드 실패:', logoError);
    }

    // 입금명세서 제목 (로고 옆)
    page.drawText('입금명세서', { 
      x: 220, 
      y: headerY, 
      size: 28, 
      font, 
      color: rgb(0,0,0) 
    });
    
    // 출력일 (우측, 좌측으로 이동)
    const today = new Date();
    const printDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    page.drawText(`출력일: ${printDate}`, { 
      x: 420, 
      y: headerY, 
      size: 11, 
      font, 
      color: rgb(0.5,0.5,0.5) 
    });
    
    // y 위치 변수 선언 (입금명세서와 구분선 간격 단축)
    let y = 760;
    
    page.drawLine({ start: {x: 50, y}, end: {x: 545, y}, thickness: 2, color: rgb(0.7,0.7,0.8) });
    y -= 25;

    // 2. 고객정보 표 + 사진
    const customer = (selectedTx.customers as any) || {};
    // 디버깅: 실제 customer 구조 출력
    if (typeof window !== 'undefined') {
      console.log('📋 PDF customer 전체 데이터:', customer);
      console.log('📋 사업자번호 관련 필드들:', {
        business_number: customer.business_number,
        biznum: customer.biznum,
        business_reg_no: customer.business_reg_no,
        biz_no: customer.biz_no,
        business_registration_number: customer.business_registration_number
      });
      console.log('📋 연락처 관련 필드들:', {
        mobile: customer.mobile,
        mobile_phone: customer.mobile_phone,
        cell_phone: customer.cell_phone,
        phone: customer.phone,
        phone_number: customer.phone_number,
        tel: customer.tel,
        contact: customer.contact
      });
    }
    // 주요 필드 자동 매핑
    const getField = (...fields: string[]) => {
      for (const f of fields) {
        if (customer[f] !== undefined && customer[f] !== null) return customer[f];
      }
      return undefined;
    };
    const customerTable = [
      ['고객명', displayValue(getField('name', 'customer_name'))],
      ['고객유형', displayValue(getField('customer_type', 'type'))],
      ['주민번호', displayValue(getField('ssn', 'rrn'))],
      ['사업자번호', displayValue(getField('business_no', 'business_number', 'biznum', 'business_reg_no', 'biz_no'))],
      ['휴대폰번호', displayValue(getField('mobile', 'phone', 'mobile_phone', 'cell_phone', 'phone_number'))],
      ['주소', displayValue(getField('address', 'addr', 'road_address', 'road_addr'))],
      ['지번주소', displayValue(getField('jibun_address', 'jibun_addr', 'lot_address', 'old_address', 'jibun', 'lot_addr', 'address_jibun'))]
    ];
    // 고객정보 박스 테이블 (2열 구조: 1열=고객정보 7행, 2열=고객사진 1행) - 간격 최적화
    const customerBoxX = 60;
    const customerBoxY = y;
    const customerBoxWidth = 350;
    const customerBoxHeight = 126; // 7행 * 15px + 여백 21px = 126px (기존 158px에서 32px 축소)
    const photoBoxX = customerBoxX + customerBoxWidth + 10;
    const photoBoxWidth = 120;
    
    // 고객정보 제목 (박스 밖 좌측 상단) - 삭제됨
    
    // 1열: 고객정보 박스 (테두리 그리기)
    page.drawRectangle({
      x: customerBoxX,
      y: customerBoxY - customerBoxHeight,
      width: customerBoxWidth,
      height: customerBoxHeight,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1
    });
    
    // 고객정보 7행 표시 (박스 내부, 간격 최적화)
    customerTable.forEach(([k, v], i) => {
      const rowY = customerBoxY - 15 - (i * 15); // 행 간격 15px로 축소 (기존 18px)
      // 라벨
      page.drawText(`${k}:`, { 
        x: customerBoxX + 10, 
        y: rowY, 
        size: 9, 
        font, 
        color: rgb(0.3,0.3,0.3) 
      });
      // 값
      page.drawText(v, { 
        x: customerBoxX + 100, 
        y: rowY, 
        size: 9, 
        font, 
        color: rgb(0,0,0) 
      });
      
      // 행 구분선 (텍스트 바로 아래 정렬)
      if (i < customerTable.length - 1) {
        page.drawLine({ 
          start: {x: customerBoxX + 5, y: rowY - 3}, 
          end: {x: customerBoxX + customerBoxWidth - 5, y: rowY - 3}, 
          thickness: 0.3, 
          color: rgb(0.9,0.9,0.9) 
        });
      }
    });
    
    // 고객사진 제목 (박스 밖 좌측 상단) - 삭제됨
    
    // 2열: 고객사진 박스 (테두리 그리기)
    page.drawRectangle({
      x: photoBoxX,
      y: customerBoxY - customerBoxHeight,
      width: photoBoxWidth,
      height: customerBoxHeight,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1
    });
    // 고객 사진 (우측) - 실시간 API 호출로 사진 가져오기
    let photoUrl = '';
    
    // 디버깅: 고객 데이터 구조 확인
    if (typeof window !== 'undefined') {
      console.log('🔍 고객 사진 디버깅:', {
        customer,
        'customer.photos': customer.photos,
        'selectedTx.files': selectedTx.files,
        'customer_id': selectedTx.customer_id
      });
    }
    
    // 실시간으로 고객 사진 API 호출 (고객관리 페이지와 동일한 방식)
    try {
      console.log('📡 고객 사진 API 호출 시작:', selectedTx.customer_id);
      const filesResponse = await fetch(`/api/files?customer_id=${selectedTx.customer_id}`);
      
      console.log('📡 API 응답 상태:', filesResponse.status, filesResponse.statusText);
      
      if (filesResponse.ok) {
        const customerFiles = await filesResponse.json();
        console.log('📁 고객 파일 목록 (전체):', customerFiles);
        console.log('📁 파일 개수:', Array.isArray(customerFiles) ? customerFiles.length : '배열 아님');
        
        if (Array.isArray(customerFiles) && customerFiles.length > 0) {
          // 고객관리 페이지와 동일한 방식: 첫 번째 파일의 URL 사용
          const firstFile = customerFiles[0];
          console.log('📄 첫 번째 파일 객체:', firstFile);
          
          if (firstFile && firstFile.url) {
            photoUrl = firstFile.url;
            console.log('✅ API에서 첫 번째 사진 URL 발견:', photoUrl);
            console.log('🔍 URL 유효성 검사:', {
              'URL 길이': photoUrl.length,
              'https 시작': photoUrl.startsWith('https'),
              'supabase 포함': photoUrl.includes('supabase')
            });
          } else {
            console.warn('⚠️ 첫 번째 파일에 URL이 없음:', firstFile);
          }
        } else {
          console.warn('⚠️ 고객 파일이 없거나 배열이 아님:', customerFiles);
        }
      } else {
        const errorText = await filesResponse.text();
        console.error('❌ API 응답 실패:', filesResponse.status, errorText);
      }
    } catch (apiError) {
      console.error('❌ 고객 사진 API 호출 실패:', apiError);
    }
    
    // 백업: 기존 데이터에서 사진 찾기
    if (!photoUrl) {
      // 1. 고객 photos 배열에서 첫 번째 사진 찾기
      if (Array.isArray(customer.photos) && customer.photos.length > 0) {
        const firstPhoto = customer.photos[0];
        if (firstPhoto && firstPhoto.url) {
          photoUrl = firstPhoto.url;
          console.log('✅ customer.photos에서 사진 발견:', photoUrl);
        }
      }
      
      // 2. customer.customers 참조에서 사진 찾기
      if (!photoUrl && customer.customers && Array.isArray(customer.customers.photos) && customer.customers.photos.length > 0) {
        const firstPhoto = customer.customers.photos[0];
        if (firstPhoto && firstPhoto.url) {
          photoUrl = firstPhoto.url;
          console.log('✅ customer.customers.photos에서 사진 발견:', photoUrl);
        }
      }
      
      // 3. 거래 첨부파일에서 사진 타입 찾기
      if (!photoUrl && Array.isArray(selectedTx.files)) {
        const photoFile = selectedTx.files.find(f => f.type === 'photo' || f.type === '사진' || f.name?.includes('photo'));
        if (photoFile && photoFile.url) {
          photoUrl = photoFile.url;
          console.log('✅ selectedTx.files에서 사진 발견:', photoUrl);
        }
      }
      
      // 4. 다른 가능한 경로들
      if (!photoUrl) {
        // customer.photoUrl 직접 확인
        if (customer.photoUrl) {
          photoUrl = customer.photoUrl;
          console.log('✅ customer.photoUrl에서 사진 발견:', photoUrl);
        }
        // customer.photo_url 확인 (다른 필드명)
        else if (customer.photo_url) {
          photoUrl = customer.photo_url;
          console.log('✅ customer.photo_url에서 사진 발견:', photoUrl);
        }
      }
    }
    
    if (photoUrl && String(photoUrl).trim() !== '') {
      try {
        console.log('🖼️ 사진 로딩 시도:', photoUrl);
        
        // URL 유효성 재검사
        if (!photoUrl.startsWith('http')) {
          throw new Error('유효하지 않은 URL 형식');
        }
        
        // 이미지 fetch 시도
        console.log('📥 이미지 다운로드 시작...');
        const photoResponse = await fetch(photoUrl);
        console.log('📥 이미지 응답 상태:', photoResponse.status, photoResponse.statusText);
        
        if (!photoResponse.ok) {
          if (photoResponse.status === 404) {
            throw new Error('이미지 파일이 존재하지 않습니다 (삭제된 파일)');
          }
          throw new Error(`이미지 다운로드 실패: ${photoResponse.status} ${photoResponse.statusText}`);
        }
        
        const photoBytes = await photoResponse.arrayBuffer();
        console.log('📥 이미지 바이트 크기:', photoBytes.byteLength);
        
        if (photoBytes.byteLength === 0) {
          throw new Error('이미지 파일이 비어있음');
        }
        
                // 🎯 Canvas를 활용한 이미지 재인코딩 방식 (100% 호환성)
        const contentType = photoResponse.headers.get('content-type') || '';
        
        console.log('🔍 이미지 정보:', {
          'Content-Type': contentType,
          'URL': photoUrl,
          '파일 크기': photoBytes.byteLength,
          'URL 길이': photoUrl.length
        });
        
        let photoImg;
        
        // 🚀 Canvas를 사용한 안전한 이미지 처리
        console.log('🎨 Canvas를 통한 이미지 재인코딩 시작...');
        
        try {
          // 1. Blob으로 변환
          const blob = new Blob([photoBytes], { type: contentType || 'image/jpeg' });
          const imageUrl = URL.createObjectURL(blob);
          
          console.log('📄 Blob 생성 완료, 크기:', blob.size);
          
          // 2. Image 객체로 로드
          const img = new Image();
          
          await new Promise((resolve, reject) => {
            img.onload = () => {
              console.log('🖼️ 이미지 로드 성공:', img.width, 'x', img.height);
              resolve(true);
            };
            img.onerror = (err) => {
              console.error('❌ 이미지 로드 실패:', err);
              reject(new Error('이미지 로드 실패'));
            };
            img.src = imageUrl;
          });
          
          // 3. Canvas로 재그리기
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // 적절한 크기로 조정 (PDF용)
          const maxSize = 300;
          const scale = Math.min(maxSize / img.width, maxSize / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          console.log('🎨 Canvas 그리기 완료:', canvas.width, 'x', canvas.height);
          
          // 4. JPEG로 재인코딩
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          const base64Data = dataUrl.split(',')[1];
          const reEncodedBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          console.log('🔄 재인코딩 완료, 새로운 크기:', reEncodedBytes.byteLength);
          
          // 5. PDF에 임베드
          photoImg = await pdfDoc.embedJpg(reEncodedBytes);
          
          // 6. URL 정리
          URL.revokeObjectURL(imageUrl);
          
          console.log('✅ Canvas 방식으로 이미지 처리 성공!');
          
        } catch (canvasError) {
          console.error('❌ Canvas 방식 실패:', canvasError);
          
          // 백업: 기존 방식으로 재시도
          console.log('🔄 기존 방식으로 백업 시도...');
          try {
            photoImg = await pdfDoc.embedJpg(photoBytes);
            console.log('✅ 백업 JPEG 성공!');
          } catch (jpegError) {
            try {
              photoImg = await pdfDoc.embedPng(photoBytes);
              console.log('✅ 백업 PNG 성공!');
            } catch (pngError) {
              const canvasMsg = canvasError instanceof Error ? canvasError.message : String(canvasError);
              const jpegMsg = jpegError instanceof Error ? jpegError.message : String(jpegError);
              const pngMsg = pngError instanceof Error ? pngError.message : String(pngError);
              
              console.error('❌ 모든 방식 실패:', { Canvas: canvasMsg, JPEG: jpegMsg, PNG: pngMsg });
              throw new Error(`모든 이미지 처리 방식 실패: Canvas(${canvasMsg}), JPEG(${jpegMsg}), PNG(${pngMsg})`);
            }
          }
        }
        
        // PDF에 이미지 그리기 (박스 크기에 정확히 맞춤)
        const maxPhotoWidth = photoBoxWidth - 10;  // 여백 줄임
        const maxPhotoHeight = customerBoxHeight - 10; // 여백 줄임
        const photoDims = photoImg.scale(Math.min(maxPhotoWidth/photoImg.width, maxPhotoHeight/photoImg.height));
        
        // 사진 박스 중앙에 배치
        const photoX = photoBoxX + (photoBoxWidth - photoDims.width) / 2;
        const photoY = customerBoxY - 5 - photoDims.height; // 상단 여백 최소화
        
        page.drawImage(photoImg, { 
          x: photoX, 
          y: photoY, 
          width: photoDims.width, 
          height: photoDims.height 
        });
        
        console.log('✅ 고객 사진 박스 내부 출력 성공!');
        
      } catch (photoError) {
        const errorMessage = photoError instanceof Error ? photoError.message : String(photoError);
        const errorName = photoError instanceof Error ? photoError.name : 'UnknownError';
        
        console.error('❌ 사진 로딩 실패 - 상세 정보:', {
          '오류 메시지': errorMessage,
          '오류 타입': errorName,
          '사진 URL': photoUrl,
          '전체 오류': photoError
        });
        
        // 사용자에게 더 구체적인 오류 메시지 표시 (박스 내부)
        const errorMsg = errorMessage.includes('JPEG') || errorMessage.includes('PNG') 
          ? '이미지 형식 오류' 
          : errorMessage.includes('fetch') || errorMessage.includes('다운로드')
          ? '이미지 다운로드 실패'
          : '이미지 처리 실패';
          
        page.drawText(errorMsg, { 
          x: photoBoxX + 15, 
          y: customerBoxY - 70, 
          size: 9, 
          font, 
          color: rgb(0.8,0.2,0.2) 
        });
      }
    } else {
      console.warn('⚠️ 사진 URL을 찾을 수 없음');
      page.drawText('사진 없음', { 
        x: photoBoxX + 35, 
        y: customerBoxY - 70, 
        size: 10, 
        font, 
        color: rgb(0.5,0.5,0.5) 
      });
    }
    
    y -= customerBoxHeight + 10; // 고객정보 박스 높이만큼 y 위치 조정 (126px + 10px)

    // 3. 거래 정보 (박스 형태, 1행3열-2행4열-3행1열 구조)
    const row1 = [
      ['거래일자', selectedTx.created_at?.slice(0,10) || ''],
      ['거래유형', selectedTx.type || ''],
      ['기종/모델', `${selectedTx.models_types?.model || ''} / ${selectedTx.models_types?.type || ''}`],
      ['비고', selectedTx.description || '']
    ];
    const row2 = [
      ['매출액', `${selectedTx.amount?.toLocaleString() || ''}원`],
      ['입금액', `${(selectedTx.paid_amount||0).toLocaleString()}원`],
      ['잔금', `${(selectedTx.unpaid_amount||0).toLocaleString()}원`],
      ['입금율', selectedTx.paid_ratio !== undefined && selectedTx.paid_ratio !== null ? selectedTx.paid_ratio.toFixed(1)+'%' : '-']
    ];
    const boxX = 60;
    const boxY = y;
    const boxWidth = 480;
    const boxHeight = 70; // 2행 기준
    const colWidths = [60, 60, 55, 80, 65, 108, 40]; // 입금은행 80→65, 상세 93→108
    // 박스 테두리
    page.drawRectangle({
      x: boxX,
      y: boxY - boxHeight,
      width: boxWidth,
      height: boxHeight,
      borderColor: rgb(0.7,0.7,0.8),
      borderWidth: 1
    });
    // 거래정보 박스 내부 항목 좌우 간격 균등 분포
    const colWidth = (boxWidth - 20) / 4;
    // 1행 4열
    row1.forEach(([k, v], i) => {
      const colX = boxX + 10 + (i * colWidth);
      page.drawText(`${k}:`, { x: colX, y: boxY - 18, size: 9, font, color: rgb(0.3,0.3,0.3) });
      page.drawText(v, { x: colX, y: boxY - 32, size: 9, font, color: rgb(0,0,0) });
    });
    // 2행 4열
    row2.forEach(([k, v], i) => {
      const colX = boxX + 10 + (i * colWidth);
      page.drawText(`${k}:`, { x: colX, y: boxY - 48, size: 9, font, color: rgb(0.3,0.3,0.3) });
      page.drawText(v, { x: colX, y: boxY - 62, size: 9, font, color: rgb(0,0,0) });
    });
    y -= boxHeight + 10;

    // 4. 입금내역 표 (입금현황)
    const paymentBoxX = 60;
    const paymentBoxInnerX = paymentBoxX + 6;
    const paymentBoxY = y;
    const paymentBoxWidth = 480;
    // Place '비고' immediately after '상세'
    const paymentTableHeaders = ['입금일', '입금자', '방식', '금액', '입금은행', '상세', '비고'];
    // Adjust column widths for new order (상세와 비고가 인접)
    const paymentColWidths = [60, 60, 55, 80, 65, 100, 60];
    const rowHeight = 18;
    const maxRows = 15;
    // 거래내역 박스 높이를 데이터 개수에 따라 동적으로 계산
    const paymentRowCount = Math.max(filteredPayments.length, 1); // 최소 1행
    const paymentBoxHeight = (rowHeight * (paymentRowCount + 1)) + 60; // 헤더+데이터+하단여백

    // 거래내역 표 테두리(고객정보/거래정보와 완전히 동일)
    page.drawRectangle({
      x: boxX,
      y: paymentBoxY - paymentBoxHeight,
      width: boxWidth,
      height: paymentBoxHeight,
      borderColor: rgb(0.5,0.5,0.7),
      borderWidth: 0.4
    });
    // 헤더와 밑줄 간 간격 맞춤 (헤더 y좌표 조정)
    const paymentHeaderY = paymentBoxY - 18;
    paymentTableHeaders.forEach((header, i) => {
      page.drawText(header, {
        x: paymentBoxInnerX + paymentColWidths.slice(0, i).reduce((a, b) => a + b, 0),
        y: paymentHeaderY,
        size: 9,
        font,
        color: rgb(0.1,0.2,0.5)
      });
    });
    // splitTextByWidth 함수 선언을 이 위치로 이동
    function splitTextByWidth(text: string, maxWidth: number, font: any, size: number) {
      if (!text) return [''];
      const words = text.split(' ');
      let lines = [];
      let current = '';
      words.forEach(word => {
        const test = current ? current + ' ' + word : word;
        if (font.widthOfTextAtSize(test, size) > maxWidth) {
          if (current) lines.push(current);
          current = word;
        } else {
          current = test;
        }
      });
      if (current) lines.push(current);
      return lines;
    }
    let paymentRowY = paymentHeaderY - rowHeight;
    filteredPayments.slice(0, maxRows).forEach((p, rowIdx) => {
      // Place '비고' immediately after '상세'
      const detail = p.method === '현금'
        ? `장소:${p.cash_place||''} 수령:${p.cash_receiver||''}`
        : p.method === '계좌이체'
          ? `계좌:${p.account_number||''} (${p.account_holder||''})`
          : p.detail || '';
      const cells = [
        p.paid_at?.slice(0,10) || '',
        p.payer_name || '',
        p.method || '',
        (p.amount || 0).toLocaleString() + '원',
        p.bank_name || '',
        detail,
        p.note || ''
      ];
      const maxDetailWidth = paymentColWidths[5] - 4;
      const detailLines = splitTextByWidth(cells[5], maxDetailWidth, font, 9);
      const rowLines = Math.max(1, detailLines.length);
      for (let lineIdx = 0; lineIdx < rowLines; lineIdx++) {
        cells.forEach((cell, i) => {
          let text = cell;
          if (i === 5) text = detailLines[lineIdx] || '';
          if (i !== 5 && lineIdx > 0) text = '';
          page.drawText(text, {
            x: paymentBoxInnerX + paymentColWidths.slice(0, i).reduce((a, b) => a + b, 0),
            y: paymentRowY - lineIdx * rowHeight,
            size: 9,
            font,
            color: rgb(0,0,0)
          });
        });
      }
      paymentRowY -= rowLines * rowHeight;
    });

    y = paymentRowY - 30; // 표와 서명란 사이 충분히 띄움

    // 6. 공급자 정보 (하단 중앙 정렬)
    const supplier = {
      name: '구보다농기계영암대리점',
      biznum: '743-39-01106',
      ceo: '정현목',
      address: '전남 영암군 군서면 녹암대동보길184',
      phone: '010-2602-3276',
      accounts: ACCOUNT_LIST
    };

    // 공급자 정보 fetch 함수 (클라이언트/서버 컴포넌트 모두 지원)
    async function fetchSupplierInfo() {
      const res = await fetch('/api/supplier-info');
      if (!res.ok) throw new Error('공급자 정보 로드 실패');
      return res.json();
    }

    // drawLine(구분선) 추가 (공급자 정보 위)
    page.drawLine({
      start: { x: 40, y: 75 },
      end: { x: 555, y: 75 },
      thickness: 1,
      color: rgb(0.8,0.8,0.8)
    });
    // 하단 공급자 정보(중앙 정렬, 3행: 공급자, 주소, 계좌)
    const accountText = supplier.accounts && supplier.accounts.length > 0
      ? `${supplier.accounts[0].bank} ${supplier.accounts[0].number} (${supplier.accounts[0].holder})`
      : '';
    const supplierLine1 = `공급자: ${supplier.name} | 대표: ${supplier.ceo} | 사업자등록번호: ${supplier.biznum}`;
    const supplierLine2 = `주소: ${supplier.address} | 연락처: ${supplier.phone}`;
    const supplierLine3 = accountText;
    const line1Width = font.widthOfTextAtSize(supplierLine1, 11);
    const line2Width = font.widthOfTextAtSize(supplierLine2, 11);
    const line3Width = font.widthOfTextAtSize(supplierLine3, 14); // 강조 위해 더 크게
    const line1CenterX = (595 - line1Width) / 2;
    const line2CenterX = (595 - line2Width) / 2;
    const line3CenterX = (595 - line3Width) / 2;
    page.drawText(supplierLine1, { x: line1CenterX, y: 60, size: 11, font, color: rgb(0.2,0.2,0.2) });
    page.drawText(supplierLine2, { x: line2CenterX, y: 40, size: 11, font, color: rgb(0.2,0.2,0.2) });
    if (supplierLine3) {
      page.drawText(supplierLine3, { x: line3CenterX, y: 22, size: 14, font, color: rgb(0.09,0.46,0.82) }); // #1976d2
    }
    // 페이지 번호는 더 아래로
    const pageNumber = '1/1';
    const pageWidth = 595;
    const pageTextWidth = font.widthOfTextAtSize(pageNumber, 10);
    const pageX = (pageWidth - pageTextWidth) / 2;
    page.drawText(pageNumber, {
      x: pageX,
      y: 10,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5)
    });

    // 거래내역 표와 공급자 정보 사이에 일자/확인자 서명란 추가 (공급자 drawText보다 먼저)
    let customerName = '';
    if (selectedTx.customers && typeof selectedTx.customers === 'object' && 'name' in selectedTx.customers) {
      customerName = (selectedTx.customers as any).name;
    } else if ('payer_name' in selectedTx) {
      customerName = (selectedTx as any).payer_name;
    } else if ('payer' in selectedTx) {
      customerName = (selectedTx as any).payer;
    } else if ('customer_id' in selectedTx) {
      customerName = String((selectedTx as any).customer_id);
    }
    const year = new Date().getFullYear();
    const confirmFontSize = 11;
    const confirmY = 90;
    const confirmText = `${year}년     월     일     확인자:     ${customerName}     (서명)`;
    const confirmWidth = font.widthOfTextAtSize(confirmText, confirmFontSize);
    const confirmX = (595 - confirmWidth) / 2;
    page.drawText(confirmText, { x: confirmX, y: confirmY, size: confirmFontSize, font, color: rgb(0.2,0.2,0.2) });

    // PDF 저장 및 다운로드
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'statement.pdf';
    a.target = '_blank'; // 새 창에서 열기(다운로드 차단 우회)
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
    // 필요시 PDF 미리보기 지원 (주석 해제 시 새 창에서 PDF 열림)
    // window.open(url, '_blank');

    // ... 고객 확인/서명란 출력 후 아래에 추가 ...
    // confirmYear는 이미 위에서 선언되어 있으므로 재사용
    // ... 이후 기존 코드 계속 ...
  } catch (err) {
    if (typeof setErrorMsg === 'function') setErrorMsg('PDF 생성 중 오류 발생: ' + (err as any).message);
  }
}

// 모든 string | null 필드를 string으로 강제 변환한 타입
type NormalizedPayment = Omit<PaymentType, 
  'cash_place' | 'cash_receiver' | 'cash_detail' | 'account_number' | 'account_holder' | 'bank_name' | 'paid_location' | 'paid_by' | 'card_approval_code' | 'note' | 'used_model_type' | 'used_model' | 'used_place' | 'used_by' | 'used_at' | 'detail'
> & {
  cash_place: string;
  cash_receiver: string;
  cash_detail: string;
  account_number: string;
  account_holder: string;
  bank_name: string;
  paid_location: string;
  paid_by: string;
  card_approval_code: string;
  note: string;
  used_model_type: string;
  used_model: string;
  used_place: string;
  used_by: string;
  used_at: string;
  detail: string;
};

export default function TransactionDetailClient({ transactions, initialSelectedId, customerId, onPaymentSuccess }: Props) {
  const [selectedId, setSelectedId] = useState(initialSelectedId || transactions[0]?.id);
  const [txList, setTxList] = useState(transactions);
  const router = useRouter();
  const { triggerRefresh, refreshKey } = useRefreshContext();
  const toast = useToast();

  // 거래/입금 데이터 fetch 함수
  const fetchTransactions = useCallback(async () => {
    if (!customerId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('transactions')
      .select('*, payments(*), files(*), customers:customer_id(*), models_types:models_types_id(model, type)')
      .eq('customer_id', customerId);
    if (data) {
      // 집계 로직 동일하게 적용
      const txs: TransactionWithDetails[] = (data as any[]).map(tx => {
        // payments 콘솔 출력
        if (tx.payments) {
          console.log('payments for tx', tx.id, tx.payments.map((p: any) => ({ id: p.id, amount: p.amount })));
        }
        const paid = (tx.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        const unpaid = (tx.amount || 0) - paid;
        const ratio = tx.amount ? Math.round((paid / tx.amount) * 100) : 0;
        return {
          ...tx,
          paid_amount: paid,
          unpaid_amount: unpaid,
          paid_ratio: ratio,
          payments: tx.payments,
          files: tx.files
        };
      });
      setTxList(txs);
    }
  }, [customerId]);

  // 실시간 구독: payments 테이블 변경 시 해당 고객 거래 데이터 fetch
  usePaymentsRealtime({ customerId, onPaymentsChange: fetchTransactions });

  // refreshKey, customerId가 바뀔 때마다 fetch
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, refreshKey, customerId]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedAttachmentType, setSelectedAttachmentType] = useState(ATTACHMENT_TYPES[0]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // 입금내역 필터/검색/정렬 상태
  const [paymentFilter, setPaymentFilter] = useState({
    payer: '',
    method: '',
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
    note: '',
    sortBy: 'paid_at',
    sortOrder: 'desc',
    search: '',
  });

  const selectedTx = txList.find(tx => tx.id === selectedId) || txList[0];
  // 필터링된 입금내역
  const filteredPayments = (selectedTx && selectedTx.payments ? selectedTx.payments : [])
    .filter((p: any) => !paymentFilter.method || p.method === paymentFilter.method)
    .filter((p: any) => !paymentFilter.minAmount || (p.amount || 0) >= Number(paymentFilter.minAmount))
    .filter((p: any) => !paymentFilter.maxAmount || (p.amount || 0) <= Number(paymentFilter.maxAmount))
    .filter((p: any) => !paymentFilter.startDate || (p.paid_at || '') >= paymentFilter.startDate)
    .filter((p: any) => !paymentFilter.endDate || (p.paid_at || '') <= paymentFilter.endDate)
    .filter((p: any) => !paymentFilter.note || (p.note || '').includes(paymentFilter.note))
    .filter((p: any) => !paymentFilter.search || (
      (p.note || '').includes(paymentFilter.search)
    ))
    .sort((a: any, b: any) => {
      const field = paymentFilter.sortBy;
      const order = paymentFilter.sortOrder === 'asc' ? 1 : -1;
      if (field === 'amount') return ((a.amount || 0) - (b.amount || 0)) * order;
      if (field === 'paid_at') return ((a.paid_at || '').localeCompare(b.paid_at || '')) * order;
      return 0;
    });

  // 파일 업로드 핸들러 (첨부유형별, 5건 제한)
  const isValidUUID = (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);

  // PDF 내보내기 이벤트 리스너
  useEffect(() => {
    const handleExportPdf = () => {
      const selectedTx = txList.find(tx => tx.id === selectedId);
      if (selectedTx) {
        handlePdfExportPdfLib(selectedTx, filteredPayments, setErrorMsg);
      }
    };

    window.addEventListener('exportPdf', handleExportPdf);
    return () => window.removeEventListener('exportPdf', handleExportPdf);
  }, [selectedId, txList, filteredPayments]);
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true);
    if (typeof setSuccessMsg === 'function') setSuccessMsg('');
    if (typeof setErrorMsg === 'function') setErrorMsg('');
    // 유효성 체크: customer_id, transaction_id 존재 및 uuid 형식
    if (!selectedTx?.customer_id || !selectedTx?.id ||
        !isValidUUID(selectedTx.customer_id) || !isValidUUID(selectedTx.id)) {
      setErrorMsg('고객 또는 거래 정보가 올바르지 않습니다. 새로고침 후 다시 시도하세요.');
      setUploading(false);
      return;
    }
    try {
      // 첨부유형별 5건 제한
      const currentTypeFiles = (selectedTx.files || []).filter(f => f.type === selectedAttachmentType);
      if (currentTypeFiles.length >= 5) {
        setErrorMsg(`${selectedAttachmentType}는 최대 5건까지 첨부할 수 있습니다.`);
        setUploading(false);
        return;
      }
      // Supabase Storage 업로드 (경로 sanitize 적용)
      const safeType = sanitizeFileName(selectedAttachmentType);
      const safeName = sanitizeFileName(file.name);
      const filePath = `transactions/${selectedTx.id}/${safeType}/${Date.now()}_${safeName}`;
      const { data, error } = await supabase.storage.from('files').upload(filePath, file);
      if (error) throw error;
      // Public URL 생성
      const { data: publicUrlData } = supabase.storage.from('files').getPublicUrl(filePath);
      // /api/files로 POST 요청하여 DB에 메타데이터 저장
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedTx.customer_id || customerId,
          name: file.name,
          type: selectedAttachmentType,
          url: publicUrlData?.publicUrl,
          transaction_id: selectedTx.id,
        }),
      });
      if (!res.ok) throw new Error('DB 저장 실패');
      const fileRow = await res.json();
      // File 타입 보장 (누락 필드 보완, spread 사용하지 않음)
      const toFile = (f: any): File => ({
        id: String(f.id),
        customer_id: String(f.customer_id),
        transaction_id: f.transaction_id ? String(f.transaction_id) : null,
        name: String(f.name),
        type: String(f.type),
        url: String(f.url),
        created_at: String(f.created_at),
      });
      setTxList(prev => prev.map(tx => tx.id === selectedTx.id ? {
        ...tx,
        files: ([...(tx.files || []), toFile(fileRow)] as File[]).map(toFile)
      } : tx));
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (typeof setSuccessMsg === 'function') setSuccessMsg('파일 업로드가 완료되었습니다.');
    } catch (err) {
      if (typeof setErrorMsg === 'function') setErrorMsg('파일 업로드 실패: ' + (err as any).message);
    } finally {
      setUploading(false);
    }
  };

  // 첨부파일 삭제 핸들러
  const handleDeleteFile = async (fileId: string = '') => {
    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/files?file_id=${fileId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제 실패');
      setTxList(prev => prev.map(tx => tx.id === selectedTx.id ? {
        ...tx,
        files: ((tx.files || []).filter((f: File) => f.id !== fileId) as File[]).map(toFile)
      } : tx));
      setSuccessMsg('파일이 삭제되었습니다.');
    } catch (err) {
      setErrorMsg('파일 삭제 실패: ' + (err as any).message);
    } finally {
      setUploading(false);
    }
  };

  // PDF 출력 핸들러
  const handlePdfExport = async () => {
    if (typeof window === 'undefined') return;
    await handlePdfExportPdfLib(selectedTx, filteredPayments, setErrorMsg);
  };

  // 서명 저장 핸들러
  const handleSignatureSave = async (dataUrl: string) => {
    setShowSignature(false);
    setUploading(true);
    try {
      // dataUrl -> Blob 변환
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const fileName = `signature_${Date.now()}.png`;
      const filePath = `transactions/${selectedTx.id}/${fileName}`;
      // Supabase Storage 업로드
      const { error } = await supabase.storage.from('files').upload(filePath, blob);
      if (error) throw error;
      // Public URL 생성
      const { data: publicUrlData } = supabase.storage.from('files').getPublicUrl(filePath);
      // DB files 테이블에 메타데이터 저장
      const { data: fileRow, error: dbError } = await supabase.from('files').insert({
        customer_id: selectedTx.customer_id || customerId,
        name: fileName,
        type: 'image/png',
        url: publicUrlData?.publicUrl,
        transaction_id: selectedTx.id,
      }).select().single();
      if (dbError) throw dbError;
      // 목록 갱신
      setTxList(prev => prev.map(tx => tx.id === selectedTx.id ? {
        ...tx,
        files: [...(tx.files || []), toFile(fileRow)]
      } : tx));
    } catch (err) {
      if (typeof setErrorMsg === 'function') setErrorMsg('서명 저장 실패: ' + (err as any).message);
    } finally {
      setUploading(false);
    }
  };

  // 결제 등록 후 목록 갱신
  const handlePaymentSuccess = async () => {
    if (onPaymentSuccess) onPaymentSuccess();
    router.refresh(); // 서버 컴포넌트 재실행
    await fetchTransactions(); // 클라이언트 즉시 fetch
    triggerRefresh(); // context 갱신
    toast({ type: 'success', message: '입금 등록이 완료되었습니다.' });
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm('정말로 이 입금내역을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/payments?id=${paymentId}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || '삭제 실패');
      await fetchTransactions(); // 서버 데이터 즉시 fetch
      router.refresh(); // 서버 컴포넌트도 최신화
      triggerRefresh(); // 대시보드 등 전체 갱신
      setSuccessMsg('삭제되었습니다.');
      toast({ type: 'success', message: '입금내역이 삭제되었습니다.' });
    } catch (err: any) {
      setErrorMsg(err.message || '삭제 중 오류 발생');
      toast({ type: 'error', message: err.message || '삭제 중 오류 발생' });
    }
  };

  // 파일 강제 다운로드 핸들러
  const handleFileDownload = async (fileUrl: string, fileName: string) => {
    const res = await fetch(fileUrl);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* 거래 탐색 UI: 드롭다운+좌우 화살표+탭 UI (시니어 모드) */}
      <div className="flex items-center gap-4 mb-8 overflow-x-auto whitespace-nowrap min-w-0 max-w-full scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-blue-50">
        <button
          className="px-6 py-3 text-2xl rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold shadow-lg transition-colors duration-200"
          onClick={() => {
            const idx = txList.findIndex(tx => tx.id === selectedId);
            if (idx > 0) setSelectedId(txList[idx - 1].id);
          }}
          disabled={txList.findIndex(tx => tx.id === selectedId) === 0}
          aria-label="이전 거래"
          title="이전 거래"
        >
          ◀️
        </button>
        <select
          className="text-xl px-6 py-3 rounded-lg border-2 border-blue-300 bg-white font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          aria-label="거래 선택"
          title="거래 선택"
        >
          {txList.map(tx => (
            <option key={tx.id} value={tx.id}>
              {tx.created_at?.slice(0,10)} / {tx.type} / {tx.amount?.toLocaleString()}원
            </option>
          ))}
        </select>
        <button
          className="px-6 py-3 text-2xl rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold shadow-lg transition-colors duration-200"
          onClick={() => {
            const idx = txList.findIndex(tx => tx.id === selectedId);
            if (idx < txList.length - 1) setSelectedId(txList[idx + 1].id);
          }}
          disabled={txList.findIndex(tx => tx.id === selectedId) === txList.length - 1}
          aria-label="다음 거래"
          title="다음 거래"
        >
          ▶️
        </button>
        {/* 탭 UI */}
        <div className="flex gap-2 ml-8">
          {txList.map(tx => (
            <button
              key={tx.id}
              onClick={() => setSelectedId(tx.id)}
              className={`px-5 py-2 text-xl rounded-lg font-bold shadow-md border-2 transition-colors duration-200 ${selectedId === tx.id ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-100 text-blue-700 border-blue-200 hover:bg-blue-200'}`}
              aria-label={`거래 ${tx.created_at?.slice(0,10)} / ${tx.type}`}
              title={`거래 ${tx.created_at?.slice(0,10)} / ${tx.type}`}
            >
              {tx.created_at?.slice(0,10)}<br/>{tx.type}
            </button>
          ))}
        </div>
      </div>
      {/* 거래 상세정보 */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8 border-2 border-gray-200 relative">
        {/* 수정/삭제 버튼 */}
        <div className="absolute top-6 right-8 flex gap-3 z-10">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <button className="px-6 py-3 bg-purple-500 text-white rounded-lg text-lg font-bold flex items-center gap-2 shadow-lg hover:bg-purple-600">
                <Edit2 className="w-6 h-6" /> 수정
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl">거래 정보 수정</DialogTitle>
              </DialogHeader>
              <TransactionForm transaction={selectedTx} onSuccess={() => { setEditOpen(false); router.refresh(); }} />
            </DialogContent>
          </Dialog>
          <button
            className="px-6 py-3 bg-red-500 text-white rounded-lg text-lg font-bold flex items-center gap-2 shadow-lg hover:bg-red-600"
            onClick={async () => {
              if (!window.confirm('정말로 이 거래를 삭제하시겠습니까?')) return;
              try {
                const res = await fetch(`/api/transactions?id=${selectedTx.id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error('삭제 실패');
                alert('삭제되었습니다.');
                triggerRefresh(); // 대시보드 등 전체 갱신
                router.push('/transactions?refresh=' + Date.now()); // 삭제 후 거래목록으로 이동하며 강제 refetch
                router.refresh(); // 삭제 후 목록 즉시 최신화
              } catch (err) {
                alert('삭제 중 오류 발생: ' + (err as any).message);
              }
            }}
          >
            <Trash2 className="w-6 h-6" /> 삭제
          </button>
        </div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
          📋 거래정보
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1행 4열 */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="text-lg font-bold text-blue-700 mb-2">👤 고객명</div>
            <div className="text-xl font-semibold text-gray-800">{selectedTx.customers?.name || selectedTx.customer_id}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="text-lg font-bold text-green-700 mb-2">📅 거래일자</div>
            <div className="text-xl font-semibold text-gray-800">{selectedTx.created_at?.slice(0, 10)}</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="text-lg font-bold text-purple-700 mb-2">📝 거래유형</div>
            <div className="text-xl font-semibold text-gray-800">{selectedTx.type}</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <div className="text-lg font-bold text-orange-700 mb-2">🚜 기종/모델</div>
            <div className="text-xl font-semibold text-gray-800">{selectedTx.models_types?.model || ''} / {selectedTx.models_types?.type || ''}</div>
          </div>
          
          {/* 2행 4열 */}
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="text-lg font-bold text-red-700 mb-2">💰 매출액</div>
            <div className="text-2xl font-bold text-red-600">{selectedTx.amount?.toLocaleString()}원</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="text-lg font-bold text-blue-700 mb-2">💳 입금액</div>
            <div className="text-2xl font-bold text-blue-600">{selectedTx.paid_amount?.toLocaleString()}원</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="text-lg font-bold text-yellow-700 mb-2">💸 잔금</div>
            <div className="text-2xl font-bold text-yellow-600">{selectedTx.unpaid_amount?.toLocaleString()}원</div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
            <div className="text-lg font-bold text-indigo-700 mb-2">📊 입금율</div>
            <div className="mt-3">
              <div className="flex-1 bg-gray-200 rounded-full h-8 relative mb-2">
                <div 
                  className="bg-indigo-500 h-8 rounded-full transition-all duration-300 ease-in-out" 
                  style={{ width: `${Math.min(selectedTx.paid_ratio || 0, 100)}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
                  {selectedTx.paid_ratio}%
                </div>
              </div>
            </div>
          </div>
          
          {/* 3행 1열 (전체 너비) */}
          {selectedTx?.description && (
            <div className="col-span-full bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="text-lg font-bold text-gray-700 mb-2">📝 비고</div>
              <div className="text-xl font-semibold text-gray-800">{selectedTx.description}</div>
            </div>
          )}
        </div>
      </div>
      {/* 입금 등록 폼 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
          💰 입금(결제) 등록
        </h2>
        <PaymentForm transactionId={selectedTx.id} onSuccess={handlePaymentSuccess} setSuccessMsg={setSuccessMsg} setErrorMsg={setErrorMsg} />
      </div>
      {/* 입금내역 필터/검색/정렬 UI */}
      <div className="bg-blue-50 p-6 rounded-lg mb-6 border-2 border-blue-200">
        <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
          🔍 입금내역 조회
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-lg font-semibold text-gray-700">💳 입금방법</label>
            <select 
              value={paymentFilter.method} 
              onChange={e => setPaymentFilter(f => ({ ...f, method: e.target.value }))} 
              className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
              title="입금방법" 
              aria-label="입금방법"
            >
              <option value="">전체 방법</option>
              <option value="현금">💰 현금</option>
              <option value="계좌이체">🏦 계좌이체</option>
              <option value="카드">💳 카드</option>
              <option value="수표">💵 수표</option>
              <option value="중고인수">🚜 중고인수</option>
              <option value="융자">📋 융자</option>
              <option value="캐피탈">🏢 캐피탈</option>
              <option value="기타">📝 기타</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-lg font-semibold text-gray-700">📅 시작일</label>
            <input 
              type="date" 
              value={paymentFilter.startDate} 
              onChange={e => setPaymentFilter(f => ({ ...f, startDate: e.target.value }))} 
              className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
              title="시작일" 
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-lg font-semibold text-gray-700">📅 종료일</label>
            <input 
              type="date" 
              value={paymentFilter.endDate} 
              onChange={e => setPaymentFilter(f => ({ ...f, endDate: e.target.value }))} 
              className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
              title="종료일" 
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-lg font-semibold text-gray-700">🔍 통합검색</label>
            <input 
              type="text" 
              placeholder="입금자, 방법, 비고 등 검색" 
              title="통합검색" 
              value={paymentFilter.search} 
              onChange={e => setPaymentFilter(f => ({ ...f, search: e.target.value }))} 
              className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-lg font-semibold text-gray-700">📊 정렬방식</label>
            <div className="flex gap-2">
              <select 
                value={paymentFilter.sortBy} 
                onChange={e => setPaymentFilter(f => ({ ...f, sortBy: e.target.value }))} 
                className="flex-1 border-2 border-gray-300 rounded-lg px-3 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
                title="정렬기준" 
                aria-label="정렬기준"
              >
                <option value="paid_at">📅 일자순</option>
                <option value="amount">💰 금액순</option>
              </select>
              <select 
                value={paymentFilter.sortOrder} 
                onChange={e => setPaymentFilter(f => ({ ...f, sortOrder: e.target.value }))} 
                className="flex-1 border-2 border-gray-300 rounded-lg px-3 py-3 text-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
                title="정렬방식" 
                aria-label="정렬방식"
              >
                <option value="desc">⬇️ 최신순</option>
                <option value="asc">⬆️ 오래된순</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      {/* 입금내역 상세 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
          📋 입금내역
        </h2>
        <div className="overflow-x-hidden bg-white rounded-lg shadow-lg border-2 border-gray-200">
          <table className="table-fixed w-full text-lg border-collapse bg-white rounded-lg shadow-lg">
            <thead>
              <tr className="bg-blue-100 border-b-2 border-blue-200 h-16">
                <th className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 min-w-[120px] max-w-[160px] text-center whitespace-nowrap overflow-hidden text-ellipsis">일자</th>
                <th className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-24 min-w-[80px] max-w-[100px] text-center whitespace-nowrap overflow-hidden text-ellipsis">입금자</th>
                <th className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-24 min-w-[80px] max-w-[100px] text-center whitespace-nowrap overflow-hidden text-ellipsis">방식</th>
                <th className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 min-w-[120px] max-w-[160px] text-right whitespace-nowrap overflow-hidden text-ellipsis">금액</th>
                <th className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 min-w-[120px] max-w-[160px] text-center whitespace-nowrap overflow-hidden text-ellipsis">입금은행</th>
                <th className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-40 min-w-[140px] max-w-[180px] text-center whitespace-nowrap overflow-hidden text-ellipsis">상세정보</th>
                <th className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-24 min-w-[100px] max-w-[120px] text-center whitespace-nowrap overflow-hidden text-ellipsis">비고</th>
                <th className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-16 min-w-[60px] max-w-[60px] text-center whitespace-nowrap overflow-hidden text-ellipsis">삭제</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length > 0 ? (
                filteredPayments.map((item: any, index: number) => (
                  <tr key={item.id} className={`hover:bg-blue-50 border-b border-gray-200 h-16 ${index % 2 === 0 ? 'bg-gray-50' : ''}`}>
                    <td className="border-2 border-gray-300 px-4 py-4 text-center w-32 min-w-[120px] max-w-[160px] text-lg whitespace-nowrap overflow-hidden text-ellipsis">{item.paid_at?.slice(0, 10)}</td>
                    <td className="border-2 border-gray-300 px-4 py-4 font-semibold w-24 min-w-[80px] max-w-[100px] text-center text-lg whitespace-nowrap overflow-hidden text-ellipsis">{item.payer_name}</td>
                    <td className="border-2 border-gray-300 px-4 py-4 text-center w-24 min-w-[80px] max-w-[100px] text-lg whitespace-nowrap overflow-hidden text-ellipsis">{item.method}</td>
                    <td className="border-2 border-gray-300 px-4 py-4 text-right font-bold text-blue-600 w-32 min-w-[120px] max-w-[160px] text-2xl whitespace-nowrap overflow-hidden text-ellipsis">{item.amount !== undefined && item.amount !== null ? Math.round(item.amount).toLocaleString() : ''}원</td>
                    <td className="border-2 border-gray-300 px-4 py-4 text-center w-32 min-w-[120px] max-w-[160px] text-lg whitespace-nowrap overflow-hidden text-ellipsis">{item.bank_name || item.account_number || ''}</td>
                    <td className="border-2 border-gray-300 px-4 py-4 text-center w-40 min-w-[140px] max-w-[180px] text-lg whitespace-nowrap overflow-hidden text-ellipsis">{[item.account_holder, item.cash_place, item.cash_receiver, item.detail].filter(Boolean).join(' / ')}</td>
                    <td className="border-2 border-gray-300 px-4 py-4 w-24 min-w-[100px] max-w-[120px] text-center text-lg whitespace-nowrap overflow-hidden text-ellipsis">{item.note}</td>
                    <td className="border-2 border-gray-300 px-4 py-4 w-16 min-w-[60px] max-w-[60px] text-center whitespace-nowrap overflow-hidden text-ellipsis">
                      <button
                        className="w-10 h-10 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-2xl shadow transition-colors duration-200 mx-auto"
                        onClick={() => handleDeletePayment(item.id)}
                        aria-label="입금내역 삭제"
                        title="입금내역 삭제"
                        type="button"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} className="text-center text-gray-400 py-8 text-xl">📭 입금내역이 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* 증빙서류 첨부 */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8 border-2 border-gray-200">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
          📎 증빙서류 첨부
        </h2>
        
        {/* 첨부 유형 선택 */}
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-4 text-gray-700 flex items-center gap-2">
            📋 서류 유형 선택
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {ATTACHMENT_TYPES.map(type => (
              <button
                key={type}
                className={`px-6 py-4 rounded-lg text-lg font-semibold transition-all duration-200 ${
                  selectedAttachmentType === type 
                    ? 'bg-blue-500 text-white shadow-lg border-2 border-blue-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
                }`}
                onClick={() => setSelectedAttachmentType(type)}
                type="button"
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* 첨부된 파일들 */}
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-4 text-gray-700 flex items-center gap-2">
            📁 첨부된 {selectedAttachmentType} 파일
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(selectedTx.files || []).filter(f => f.type === selectedAttachmentType).length > 0 ? (
              (selectedTx.files || []).filter(f => f.type === selectedAttachmentType).map(f => (
                <div key={f.id} className="relative border-2 border-gray-200 rounded-lg p-4 bg-gray-50 flex flex-col items-center hover:shadow-lg transition-shadow duration-200">
                  {f.url && f.url.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
                    <>
                      <img
                        src={f.url}
                        alt={f.name}
                        className="w-32 h-32 object-cover rounded-lg mb-3 cursor-pointer hover:opacity-80 border-2 border-gray-300"
                        onClick={() => setPreviewImage(f.url)}
                      />
                      <span className="text-sm font-semibold text-gray-700 truncate w-full text-center mb-1">{f.name}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-6xl text-gray-400 mb-3">📄</span>
                      <span className="text-sm font-semibold text-gray-700 truncate w-full text-center mb-1">{f.name}</span>
                    </>
                  )}
                  <span className="text-xs text-gray-500 mb-3">{f.created_at?.slice(0,16).replace('T',' ')}</span>
                  <div className="flex gap-2 w-full">
                    <button 
                      className="flex-1 bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors duration-200" 
                      onClick={() => handleFileDownload(f.url, f.name)} 
                      type="button"
                    >
                      📥 다운로드
                    </button>
                    <button 
                      className="flex-1 bg-red-500 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors duration-200" 
                      onClick={() => handleDeleteFile(f.id)} 
                      disabled={uploading}
                    >
                      🗑️ 삭제
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <span className="text-4xl text-gray-400 mb-2 block">📭</span>
                <span className="text-lg text-gray-500 font-semibold">첨부된 {selectedAttachmentType} 파일이 없습니다</span>
              </div>
            )}
          </div>
        </div>

        {/* 파일 업로드 */}
        <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
          <h3 className="text-lg font-bold mb-4 text-blue-700 flex items-center gap-2">
            📤 새 파일 업로드
          </h3>
          <div className="flex flex-col gap-4">
            <input
              id="file-upload"
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,application/pdf"
              title="첨부파일 선택"
              aria-label="첨부파일 업로드"
            />
            <button
              className="bg-blue-500 text-white px-8 py-4 rounded-lg text-xl font-bold hover:bg-blue-600 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              type="button"
            >
              {uploading ? (
                <>
                  ⏳ 업로드 중...
                </>
              ) : (
                <>
                  📁 {selectedAttachmentType} 파일 선택하기
                </>
              )}
            </button>
            <div className="text-center">
              <span className="text-base text-blue-600 font-semibold bg-blue-100 px-4 py-2 rounded-full">
                💡 최대 5개 파일까지 업로드 가능 (이미지/PDF)
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* 이미지 미리보기 모달 */}
      {previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="미리보기" className="max-w-[90vw] max-h-[80vh] rounded shadow-lg border-4 border-white" />
        </div>
      )}
      {(successMsg || errorMsg) && (
        <div className={`mb-2 p-2 rounded text-sm ${successMsg ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{successMsg || errorMsg}</div>
      )}
    </div>
  );
} 
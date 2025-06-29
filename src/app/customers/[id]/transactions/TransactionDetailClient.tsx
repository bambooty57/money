"use client";
import React, { useState, useRef } from "react";
import type { Transaction, File, Payment as PaymentType } from '@/types/database';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';

type Payment = PaymentType;

interface TransactionWithDetails extends Transaction {
  payments?: Payment[];
  files?: File[];
  paid_amount?: number;
  unpaid_amount?: number;
  paid_ratio?: number;
  models_types?: { model?: string; type?: string };
}

interface Props {
  transactions: TransactionWithDetails[];
  initialSelectedId?: string;
  customerId?: string;
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (typeof setSuccessMsg === 'function') setSuccessMsg('');
    if (typeof setErrorMsg === 'function') setErrorMsg('');
    try {
      const payload: any = {
        transaction_id: transactionId,
        amount: parseFloat(amount),
        paid_at: paidAt,
        method,
        payer_name: payerName,
      };
      if (method === '현금') {
        payload.cash_place = cashPlace;
        payload.cash_receiver = cashReceiver;
        payload.cash_detail = cashDetail;
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
        payload.used_at = usedAt;
        payload.amount = parseFloat(amount); // 인수금액
        payload.note = note;
      }
      if (method === '융자') {
        payload.bank_name = bankName === '기타(직접입력)' ? customBankName : bankName;
        payload.note = note;
      }
      if (method === '기타') {
        payload.note = otherReason;
      }
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('저장 실패');
      setAmount(''); setPaidAt(''); setPayerName(''); setCardName(''); setPaidLocation(''); setPaidBy(''); setCashPlace(''); setCashReceiver(''); setCashDetail(''); setAccountNumber(''); setAccountHolder(''); setNote(''); setUsedModelType(''); setUsedModel(''); setUsedPlace(''); setUsedBy(''); setUsedAt(''); setOtherReason('');
      if (typeof setSuccessMsg === 'function') setSuccessMsg('입금 등록이 완료되었습니다.');
      onSuccess();
    } catch (err: any) {
      if (typeof setErrorMsg === 'function') setErrorMsg(err.message || '저장 중 오류 발생');
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
    <form onSubmit={handleSubmit} className="space-y-2 bg-blue-50 p-3 rounded mb-4">
      <div className="flex gap-2 items-center">
        <label>입금방법</label>
        <select value={method} onChange={e => setMethod(e.target.value)} className="border rounded px-2 py-1" title="입금방법 선택">
          <option value="현금">현금</option>
          <option value="계좌이체">계좌이체</option>
          <option value="카드">카드</option>
          <option value="중고인수">중고인수</option>
          <option value="융자">융자</option>
          <option value="기타">기타</option>
        </select>
      </div>
      <div className="flex gap-2 items-center">
        <label>입금일자</label>
        <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className="border rounded px-2 py-1" required title="입금일자" placeholder="입금일자" />
        <label>입금자</label>
        <input type="text" value={payerName} onChange={e => setPayerName(e.target.value)} className="border rounded px-2 py-1" required title="입금자" placeholder="입금자" />
        <label>금액</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="border rounded px-2 py-1" required title="금액" placeholder="금액" />
      </div>
      {method === '카드' && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded">
          <label>카드회사명</label>
          <select value={bankName} onChange={e => setBankName(e.target.value)} className="border rounded px-2 py-1" required>
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
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="border rounded px-2 py-1" title="비고" placeholder="비고" />
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
        </div>
      )}
      {method === '계좌이체' && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded">
          <label>입금은행</label>
          <select value={bankName} onChange={e => setBankName(e.target.value)} className="border rounded px-2 py-1" required>
            <option value="">입금은행 선택</option>
            {KOREA_BANKS.map((b, i) => <option key={i} value={b}>{b}</option>)}
          </select>
          {bankName === '기타(직접입력)' && (
            <input type="text" value={customBankName} onChange={e => setCustomBankName(e.target.value)} className="border rounded px-2 py-1" placeholder="입금은행명 직접입력" required />
          )}
          <label>계좌번호</label>
          <input type="text" value={accountNumber} onChange={e => { setAccountNumber(e.target.value); setAccountSelect(''); }} className="border rounded px-2 py-1" title="계좌번호" placeholder="계좌번호" />
          <label>예금주</label>
          <input type="text" value={accountHolder} onChange={e => { setAccountHolder(e.target.value); setAccountSelect(''); }} className="border rounded px-2 py-1" title="예금주" placeholder="예금주" />
          <label>비고</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="border rounded px-2 py-1" title="비고" placeholder="비고" />
        </div>
      )}
      {method === '중고인수' && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded">
          <label>인수일</label>
          <input type="date" value={usedAt} onChange={e => setUsedAt(e.target.value)} className="border rounded px-2 py-1" title="인수일" placeholder="인수일" required={method==='중고인수'} />
          <label>담당자</label>
          <input type="text" value={usedBy} onChange={e => setUsedBy(e.target.value)} className="border rounded px-2 py-1" title="담당자" placeholder="담당자" required={method==='중고인수'} />
          <label>인수장소</label>
          <input type="text" value={usedPlace} onChange={e => setUsedPlace(e.target.value)} className="border rounded px-2 py-1" title="인수장소" placeholder="인수장소" required={method==='중고인수'} />
          <label>기종</label>
          <input type="text" value={usedModelType} onChange={e => setUsedModelType(e.target.value)} className="border rounded px-2 py-1" title="기종" placeholder="기종" required={method==='중고인수'} />
          <label>모델</label>
          <input type="text" value={usedModel} onChange={e => setUsedModel(e.target.value)} className="border rounded px-2 py-1" title="모델" placeholder="모델" required={method==='중고인수'} />
          <label>인수금액</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="border rounded px-2 py-1" title="인수금액" placeholder="인수금액" required={method==='중고인수'} />
          <label>비고</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="border rounded px-2 py-1" title="비고" placeholder="비고" />
        </div>
      )}
      {method === '융자' && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded">
          <label>융자은행</label>
          <select value={bankName} onChange={e => setBankName(e.target.value)} className="border rounded px-2 py-1" title="융자은행 선택" required>
            <option value="">융자은행 선택</option>
            {KOREA_BANKS.map((b, i) => <option key={i} value={b}>{b}</option>)}
          </select>
          {bankName === '기타(직접입력)' && (
            <input type="text" value={customBankName} onChange={e => setCustomBankName(e.target.value)} className="border rounded px-2 py-1" placeholder="융자은행명 직접입력" required />
          )}
          <label>상세</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="border rounded px-2 py-1" title="상세" placeholder="상세" />
          <label>비고</label>
          <input type="text" value={otherReason} onChange={e => setOtherReason(e.target.value)} className="border rounded px-2 py-1" title="비고" placeholder="비고" />
        </div>
      )}
      {method === '기타' && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded">
          <label>기타 사유</label>
          <input type="text" value={otherReason} onChange={e => setOtherReason(e.target.value)} className="border rounded px-2 py-1" title="기타 사유" placeholder="기타 사유를 입력하세요" required={method==='기타'} />
        </div>
      )}
      <div className="flex justify-end">
        <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded" disabled={loading}>{loading ? '저장중...' : '입금 등록'}</button>
      </div>
    </form>
  );
}

export default function TransactionDetailClient({ transactions, initialSelectedId, customerId }: Props) {
  const [selectedId, setSelectedId] = useState(initialSelectedId || transactions[0]?.id);
  const [txList, setTxList] = useState(transactions);
  const selectedTx = txList.find(tx => tx.id === selectedId) || txList[0];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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

  // 필터링된 입금내역
  const filteredPayments = (selectedTx.payments || [])
    .filter(p => !paymentFilter.payer || (p.payer_name || '').includes(paymentFilter.payer))
    .filter(p => !paymentFilter.method || p.method === paymentFilter.method)
    .filter(p => !paymentFilter.minAmount || (p.amount || 0) >= Number(paymentFilter.minAmount))
    .filter(p => !paymentFilter.maxAmount || (p.amount || 0) <= Number(paymentFilter.maxAmount))
    .filter(p => !paymentFilter.startDate || (p.paid_at || '') >= paymentFilter.startDate)
    .filter(p => !paymentFilter.endDate || (p.paid_at || '') <= paymentFilter.endDate)
    .filter(p => !paymentFilter.note || (p.note || '').includes(paymentFilter.note))
    .filter(p => !paymentFilter.search || (
      (p.payer_name || '').includes(paymentFilter.search) ||
      (p.method || '').includes(paymentFilter.search) ||
      (p.note || '').includes(paymentFilter.search)
    ))
    .sort((a, b) => {
      const field = paymentFilter.sortBy;
      const order = paymentFilter.sortOrder === 'asc' ? 1 : -1;
      if (field === 'amount') return ((a.amount || 0) - (b.amount || 0)) * order;
      if (field === 'paid_at') return ((a.paid_at || '').localeCompare(b.paid_at || '')) * order;
      return 0;
    });

  // 파일 업로드 핸들러
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true);
    if (typeof setSuccessMsg === 'function') setSuccessMsg('');
    if (typeof setErrorMsg === 'function') setErrorMsg('');
    try {
      // Supabase Storage 업로드
      const filePath = `transactions/${selectedTx.id}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from('files').upload(filePath, file);
      if (error) throw error;
      // Public URL 생성
      const { data: publicUrlData } = supabase.storage.from('files').getPublicUrl(filePath);
      // DB files 테이블에 메타데이터 저장
      const { data: fileRow, error: dbError } = await supabase.from('files').insert({
        customer_id: selectedTx.customer_id || customerId,
        name: file.name,
        type: file.type,
        url: publicUrlData?.publicUrl,
        transaction_id: selectedTx.id,
      }).select().single();
      if (dbError) throw dbError;
      // 목록 갱신
      setTxList(prev => prev.map(tx => tx.id === selectedTx.id ? {
        ...tx,
        files: [...(tx.files || []), fileRow]
      } : tx));
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (typeof setSuccessMsg === 'function') setSuccessMsg('파일 업로드가 완료되었습니다.');
    } catch (err) {
      if (typeof setErrorMsg === 'function') setErrorMsg('파일 업로드 실패: ' + (err as any).message);
    } finally {
      setUploading(false);
    }
  };

  // PDF 출력 핸들러
  const handlePdfExport = () => {
    const doc = new jsPDF();
    // 고객 정보 상단
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('거래상세 내역', 14, 16);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const customer = (selectedTx.customers as import('@/types/database').Customer | undefined) || undefined;
    const customerInfo = [
      ['고객명', customer?.name || ''],
      ['사업자번호', customer?.business_number || customer?.business_no || ''],
      ['연락처', customer?.phone || ''],
      ['주소', customer?.address || customer?.address_road || customer?.address_jibun || ''],
    ];
    (doc as any).autoTable({
      startY: 20,
      head: [['항목', '값']],
      body: customerInfo,
      theme: 'grid',
      styles: { fillColor: [225, 245, 254] },
      headStyles: { fillColor: [33, 150, 243], textColor: 255 },
    });
    let nextY = (doc as any).lastAutoTable.finalY + 4;
    // 거래 상세
    doc.setFont('helvetica', 'bold');
    doc.text('거래 상세', 14, nextY);
    doc.setFont('helvetica', 'normal');
    (doc as any).autoTable({
      startY: nextY + 2,
      head: [['항목', '값']],
      body: [
        ['거래ID', selectedTx.id],
        ['거래일자', selectedTx.created_at?.slice(0, 10)],
        ['거래유형', selectedTx.type],
        ['기종/모델', `${selectedTx.models_types?.model || ''} / ${selectedTx.models_types?.type || ''}`],
        ['매출액', `${selectedTx.amount?.toLocaleString()}원`],
        ['입금액', `${selectedTx.paid_amount?.toLocaleString()}원`],
        ['잔금', `${selectedTx.unpaid_amount?.toLocaleString()}원`],
        ['입금율', `${selectedTx.paid_ratio}%`],
        ['상태', selectedTx.status === 'paid' ? '완료' : '미수'],
        ['비고', selectedTx.description || ''],
      ],
      theme: 'grid',
      styles: { fillColor: [243, 229, 245] },
      headStyles: { fillColor: [123, 31, 162], textColor: 255 },
    });
    nextY = (doc as any).lastAutoTable.finalY + 4;
    // 입금내역
    doc.setFont('helvetica', 'bold');
    doc.text('입금내역', 14, nextY);
    doc.setFont('helvetica', 'normal');
    (doc as any).autoTable({
      startY: nextY + 2,
      head: [['일자', '입금자', '방식', '금액', '상세정보', '비고']],
      body: filteredPayments.map(p => [
        p.paid_at?.slice(0, 10),
        p.payer_name,
        p.method,
        `${p.amount?.toLocaleString()}원`,
        p.method === '카드'
          ? `카드명: ${p.card_name || ''} / 장소: ${p.paid_location || ''} / 담당: ${p.paid_by || ''}`
          : p.method === '중고인수'
          ? `기종: ${p.used_model_type || ''} / 모델: ${p.used_model || ''} / 장소: ${p.used_place || ''} / 담당: ${p.used_by || ''}`
          : p.method === '기타'
          ? `사유: ${p.note || ''}`
          : p.method === '현금'
          ? <span>
            장소: {p.cash_place || ''} / 수령: {p.cash_receiver || ''}
            {p.cash_detail ? ` / 상세: ${p.cash_detail}` : ''}
          </span>
          : p.method === '계좌이체'
          ? `계좌: ${p.account_number || ''} / 예금주: ${p.account_holder || ''}`
          : '',
        p.note || ''
      ]),
      theme: 'grid',
      styles: { fillColor: [232, 245, 233] },
      headStyles: { fillColor: [56, 142, 60], textColor: 255 },
    });
    // 입금내역 요약
    const paidSum = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    nextY = (doc as any).lastAutoTable.finalY + 4;
    doc.setFont('helvetica', 'bold');
    doc.text('입금/미수 요약', 14, nextY);
    doc.setFont('helvetica', 'normal');
    (doc as any).autoTable({
      startY: nextY + 2,
      head: [['입금합계', '미수금', '입금률']],
      body: [[
        `${paidSum.toLocaleString()}원`,
        `${selectedTx.unpaid_amount?.toLocaleString()}원`,
        `${selectedTx.paid_ratio}%`
      ]],
      theme: 'grid',
      styles: { fillColor: [255, 249, 196] },
      headStyles: { fillColor: [255, 152, 0], textColor: 255 },
    });
    nextY = (doc as any).lastAutoTable.finalY + 4;
    // 첨부파일
    doc.setFont('helvetica', 'bold');
    doc.text('첨부파일', 14, nextY);
    doc.setFont('helvetica', 'normal');
    (doc as any).autoTable({
      startY: nextY + 2,
      head: [['파일명', 'URL']],
      body: (selectedTx.files || []).map(f => [f.name, f.url]),
      theme: 'grid',
      styles: { fillColor: [255, 243, 224] },
      headStyles: { fillColor: [245, 124, 0], textColor: 255 },
    });
    // 첨부 이미지/서명 썸네일
    const imageFiles = (selectedTx.files || []).filter(f => f.type?.startsWith('image/') && f.url);
    if (imageFiles.length > 0) {
      let imgY = (doc as any).lastAutoTable.finalY + 6;
      imageFiles.forEach((f, idx) => {
        const img = new window.Image();
        img.crossOrigin = 'Anonymous';
        img.onload = function () {
          const imgWidth = 60, imgHeight = 40;
          doc.text(f.name, 14, imgY);
          doc.addImage(img, 'PNG', 14, imgY + 2, imgWidth, imgHeight);
          imgY += imgHeight + 10;
          if (idx === imageFiles.length - 1) doc.save(`거래상세_${selectedTx.id}.pdf`);
        };
        img.onerror = function () {
          if (idx === imageFiles.length - 1) doc.save(`거래상세_${selectedTx.id}.pdf`);
        };
        img.src = f.url;
      });
    } else {
      doc.save(`거래상세_${selectedTx.id}.pdf`);
    }
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
        files: [...(tx.files || []), fileRow]
      } : tx));
    } catch (err) {
      if (typeof setErrorMsg === 'function') setErrorMsg('서명 저장 실패: ' + (err as any).message);
    } finally {
      setUploading(false);
    }
  };

  // 결제 등록 후 목록 갱신
  const handlePaymentSuccess = async () => {
    // 거래/입금/파일 동시 재조회
    const { data: txs } = await supabase
      .from('transactions')
      .select('*, payments(*), files(*), customers:customer_id(*)')
      .eq('customer_id', selectedTx.customer_id || customerId)
      .order('created_at', { ascending: false });
    setTxList((txs || []).map(tx => ({
      ...tx,
      customer_id: tx.customer_id || customerId,
    })));
  };

  return (
    <div>
      {/* 상단 거래별 목록 */}
      <div className="flex gap-2 mb-6">
        {txList.map((tx) => (
          <button
            key={tx.id}
            className={`px-3 py-1 rounded ${tx.id === selectedId ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setSelectedId(tx.id)}
            disabled={tx.id === selectedId}
          >
            {tx.created_at?.slice(0, 10)} {tx.type} {tx.amount?.toLocaleString()}원
          </button>
        ))}
      </div>
      {/* 거래 상세정보 */}
      <div className="bg-white rounded shadow p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div><b>고객ID</b>: {selectedTx.customer_id}</div>
          <div><b>고객명</b>: {selectedTx.customers?.name || selectedTx.customer_id}</div>
          <div><b>거래일자</b>: {selectedTx.created_at?.slice(0, 10)}</div>
          <div><b>거래유형</b>: {selectedTx.type}</div>
          <div><b>기종/모델</b>: {selectedTx.models_types?.model || ''} / {selectedTx.models_types?.type || ''}</div>
          <div><b>매출액</b>: {selectedTx.amount?.toLocaleString()}원</div>
          <div><b>입금액</b>: {selectedTx.paid_amount?.toLocaleString()}원</div>
          <div><b>잔금</b>: {selectedTx.unpaid_amount?.toLocaleString()}원</div>
          <div><b>입금율</b>: {selectedTx.paid_ratio}%</div>
          {selectedTx?.description && (
            <div className="col-span-2"><b>비고</b>: {selectedTx.description}</div>
          )}
        </div>
      </div>
      {/* 입금 등록 폼 */}
      <div className="mb-6">
        <h2 className="font-semibold mb-2">입금(결제) 등록</h2>
        <PaymentForm transactionId={selectedTx.id} onSuccess={handlePaymentSuccess} setSuccessMsg={setSuccessMsg} setErrorMsg={setErrorMsg} />
      </div>
      {/* 입금내역 필터/검색/정렬 UI */}
      <div className="flex flex-wrap gap-2 mb-2 items-end">
        <input type="text" placeholder="입금자" title="입금자" value={paymentFilter.payer} onChange={e => setPaymentFilter(f => ({ ...f, payer: e.target.value }))} className="border rounded px-2 py-1" />
        <select value={paymentFilter.method} onChange={e => setPaymentFilter(f => ({ ...f, method: e.target.value }))} className="border rounded px-2 py-1" title="입금방법">
          <option value="">전체방법</option>
          <option value="현금">현금</option>
          <option value="계좌이체">계좌이체</option>
          <option value="카드">카드</option>
          <option value="중고인수">중고인수</option>
          <option value="융자">융자</option>
          <option value="기타">기타</option>
        </select>
        <input type="date" value={paymentFilter.startDate} onChange={e => setPaymentFilter(f => ({ ...f, startDate: e.target.value }))} className="border rounded px-2 py-1" title="시작일" placeholder="시작일" />
        <input type="date" value={paymentFilter.endDate} onChange={e => setPaymentFilter(f => ({ ...f, endDate: e.target.value }))} className="border rounded px-2 py-1" title="종료일" placeholder="종료일" />
        <input type="number" placeholder="최소금액" title="최소금액" value={paymentFilter.minAmount} onChange={e => setPaymentFilter(f => ({ ...f, minAmount: e.target.value }))} className="border rounded px-2 py-1 w-24" />
        <input type="number" placeholder="최대금액" title="최대금액" value={paymentFilter.maxAmount} onChange={e => setPaymentFilter(f => ({ ...f, maxAmount: e.target.value }))} className="border rounded px-2 py-1 w-24" />
        <input type="text" placeholder="비고" title="비고" value={paymentFilter.note} onChange={e => setPaymentFilter(f => ({ ...f, note: e.target.value }))} className="border rounded px-2 py-1" />
        <input type="text" placeholder="통합검색" title="통합검색" value={paymentFilter.search} onChange={e => setPaymentFilter(f => ({ ...f, search: e.target.value }))} className="border rounded px-2 py-1" />
        <select value={paymentFilter.sortBy} onChange={e => setPaymentFilter(f => ({ ...f, sortBy: e.target.value }))} className="border rounded px-2 py-1" title="정렬기준">
          <option value="paid_at">일자순</option>
          <option value="amount">금액순</option>
        </select>
        <select value={paymentFilter.sortOrder} onChange={e => setPaymentFilter(f => ({ ...f, sortOrder: e.target.value }))} className="border rounded px-2 py-1" title="정렬방식">
          <option value="desc">내림차순</option>
          <option value="asc">오름차순</option>
        </select>
      </div>
      {/* 입금내역 상세 */}
      <div className="mb-6">
        <h2 className="font-semibold mb-2">입금내역</h2>
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">일자</th>
              <th className="border px-2 py-1">입금자</th>
              <th className="border px-2 py-1">방식</th>
              <th className="border px-2 py-1">금액</th>
              <th className="border px-2 py-1">상세정보</th>
              <th className="border px-2 py-1">비고</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length > 0 ? (
              filteredPayments.map(p => (
                <tr key={p.id}>
                  <td className="border px-2 py-1">{p.paid_at?.slice(0, 10)}</td>
                  <td className="border px-2 py-1">{p.payer_name}</td>
                  <td className="border px-2 py-1">{p.method}</td>
                  <td className="border px-2 py-1 text-right">{p.amount?.toLocaleString()}원</td>
                  <td className="border px-2 py-1">
                    {p.method === '카드' && (
                      <span>카드명: {p.card_name || ''} / 장소: {p.paid_location || ''} / 담당: {p.paid_by || ''}</span>
                    )}
                    {p.method === '중고인수' && (
                      <span>기종: {p.used_model_type || ''} / 모델: {p.used_model || ''} / 장소: {p.used_place || ''} / 담당: {p.used_by || ''}</span>
                    )}
                    {p.method === '기타' && (
                      <span>사유: {p.note}</span>
                    )}
                    {p.method === '현금' && (
                      <span>
                        장소: {p.cash_place || ''} / 수령: {p.cash_receiver || ''}
                        {p.cash_detail ? ` / 상세: ${p.cash_detail}` : ''}
                      </span>
                    )}
                    {p.method === '계좌이체' && (
                      <span>계좌: {p.account_number || ''} / 예금주: {p.account_holder || ''}</span>
                    )}
                  </td>
                  <td className="border px-2 py-1">{p.note}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="text-center text-gray-400">입금내역 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* 증빙서류 첨부 */}
      <div className="mb-6">
        <h2 className="font-semibold mb-2">증빙서류 첨부</h2>
        <div className="flex gap-2">
          {selectedTx.files && selectedTx.files.length > 0 ? (
            selectedTx.files.map(f => (
              <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="w-24 h-24 bg-gray-100 flex items-center justify-center rounded hover:bg-blue-100">
                {f.name}
              </a>
            ))
          ) : (
            <div className="w-24 h-24 bg-gray-100 flex items-center justify-center rounded text-gray-400">첨부 없음</div>
          )}
        </div>
        <label htmlFor="file-upload" className="sr-only">파일 첨부</label>
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
          className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '업로드 중...' : '파일 업로드'}
        </button>
      </div>
      {/* PDF 출력/서명 */}
      <div className="flex gap-4">
        <button className="px-4 py-2 bg-green-500 text-white rounded" onClick={handlePdfExport}>PDF 출력</button>
        <button className="px-4 py-2 bg-yellow-500 text-white rounded" onClick={() => setShowSignature(true)}>고객 서명받기</button>
      </div>
      {showSignature && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-4">
            <SignaturePad
              onSave={handleSignatureSave}
              onCancel={() => setShowSignature(false)}
            />
          </div>
        </div>
      )}
      {(successMsg || errorMsg) && (
        <div className={`mb-2 p-2 rounded text-sm ${successMsg ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{successMsg || errorMsg}</div>
      )}
      {/* 첨부파일(여러 개) 미리보기/다운로드/삭제 */}
      {selectedTx?.files && Array.isArray(selectedTx.files) && selectedTx.files.length > 0 && (
        <div className="mt-4">
          <div className="font-semibold mb-1">첨부파일</div>
          <div className="flex flex-wrap gap-2">
            {selectedTx.files.map((file: any, idx: number) => {
              const url = typeof file === 'string' ? file : '';
              const name = typeof file === 'string' ? file.split('/').pop() : file.name;
              return (
                <div key={idx} className="relative border rounded p-2 bg-gray-50 flex flex-col items-center w-32">
                  {url && url.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
                    <img src={url} alt={`첨부${idx+1}`} className="w-24 h-24 object-cover rounded mb-1" />
                  ) : (
                    <span className="text-xs text-gray-600">{name}</span>
                  )}
                  {url && <a href={url} download className="text-blue-500 text-xs mt-1">다운로드</a>}
                  {/* 삭제 버튼(권한/상태에 따라 노출) */}
                  {/* <button className="text-red-500 text-xs mt-1">삭제</button> */}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 
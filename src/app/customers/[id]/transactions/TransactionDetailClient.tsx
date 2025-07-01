"use client";
import React, { useState, useRef, useEffect } from "react";
import type { Transaction, File, Payment as PaymentType } from '@/types/database';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import { Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

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

// 파일 상단에 toFile 함수 선언
const toFile = (f: any): File => ({
  id: String(f.id),
  customer_id: String(f.customer_id),
  name: String(f.name),
  type: String(f.type),
  url: String(f.url),
  created_at: String(f.created_at),
  updated_at: String(f.updated_at || ''),
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
        payload.amount = parseFloat(amount); // 인수금액
        payload.note = note;
      }
      if (method === '융자') {
        payload.bank_name = bankName === '기타(직접입력)' ? customBankName : bankName;
        payload.detail = loanDetail;
        payload.note = note;
      }
      if (method === '기타') {
        payload.detail = otherDetail;
        payload.note = otherNote;
      }
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('저장 실패');
      setAmount(''); setPaidAt(''); setPayerName(''); setCardName(''); setPaidLocation(''); setPaidBy(''); setCashPlace(''); setCashReceiver(''); setCashDetail(''); setAccountNumber(''); setAccountHolder(''); setNote(''); setUsedModelType(''); setUsedModel(''); setUsedPlace(''); setUsedBy(''); setUsedAt(''); setOtherReason(''); setLoanDetail(''); setOtherDetail(''); setOtherNote('');
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
          <label>비고</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="border rounded px-2 py-1" title="비고" placeholder="비고" />
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
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="border rounded px-2 py-1" title="비고" placeholder="비고" />
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
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="border rounded px-2 py-1" title="비고" placeholder="비고" />
        </div>
      )}
      {method === '융자' && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded">
          <label>상세</label>
          <input type="text" value={loanDetail} onChange={e => setLoanDetail(e.target.value)} className="border rounded px-2 py-1" title="상세" placeholder="상세" />
          <label>비고</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="border rounded px-2 py-1" title="비고" placeholder="비고" />
        </div>
      )}
      {method === '기타' && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded">
          <label>상세</label>
          <input type="text" value={otherDetail} onChange={e => setOtherDetail(e.target.value)} className="border rounded px-2 py-1" title="상세" placeholder="상세" required={method==='기타'} />
          <label>비고</label>
          <input type="text" value={otherNote} onChange={e => setOtherNote(e.target.value)} className="border rounded px-2 py-1" title="비고" placeholder="비고" />
        </div>
      )}
      <div className="flex justify-end">
        <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded" disabled={loading}>{loading ? '저장중...' : '입금 등록'}</button>
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
async function handlePdfExportPdfLib(selectedTx: TransactionWithDetails, filteredPayments: Payment[]) {
  try {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const page = pdfDoc.addPage([595, 842]); // A4

    // 폰트 로드
    const fontUrl = '/Noto_Sans_KR/static/NotoSansKR-Regular.ttf';
    const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
    const font = await pdfDoc.embedFont(fontBytes);

    // 1. 상단 로고 이미지 (좌측 상단 배치, 크기 축소)
    try {
      const logoUrl = '/kubotalogo5.png';
      const logoResponse = await fetch(logoUrl);
      if (logoResponse.ok) {
        const logoBytes = await logoResponse.arrayBuffer();
        const logoImg = await pdfDoc.embedPng(logoBytes);
        // 좌측 상단 배치, 크기 축소로 공간 절약
        page.drawImage(logoImg, { x: 50, y: 760, width: 180, height: 72 });
        console.log('✅ 로고 이미지 로드 성공');
      } else {
        console.warn('⚠️ 로고 파일을 찾을 수 없습니다:', logoUrl);
      }
    } catch (logoError) {
      console.error('❌ 로고 로드 실패:', logoError);
    }

    // 제목 (우측 상단 배치)
    page.drawText('거래명세서', { x: 400, y: 790, size: 24, font, color: rgb(0,0,0) });
    page.drawText('Transaction Statement', { x: 400, y: 770, size: 12, font, color: rgb(0.5,0.5,0.5) });
    
    // y 위치 변수 선언 (헤더 영역 아래로 조정)
    let y = 720;
    
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
      ['고객유형', displayValue(getField('type', 'customer_type'))],
      ['주민번호', displayValue(getField('ssn', 'rrn'))],
      ['사업자번호', displayValue(getField('business_number', 'biznum', 'business_reg_no', 'biz_no'))],
      ['휴대폰번호', displayValue(getField('mobile', 'mobile_phone', 'cell_phone', 'phone', 'phone_number'))],
      ['주소', displayValue(getField('address', 'addr'))]
    ];
    // 고객정보 테이블 (깔끔한 스타일, 배경색/테두리 제거)
    customerTable.forEach(([k, v], i) => {
      // 텍스트만 표시 (박스 제거)
      page.drawText(`${k}:`, { x: 65, y: y-22*i+6, size: 12, font, color: rgb(0.3,0.3,0.3) });
      page.drawText(v, { x: 140, y: y-22*i+6, size: 12, font, color: rgb(0,0,0) });
      // 구분선 (옵션)
      if (i < customerTable.length - 1) {
        page.drawLine({ 
          start: {x: 60, y: y-22*i-11}, 
          end: {x: 460, y: y-22*i-11}, 
          thickness: 0.5, 
          color: rgb(0.9,0.9,0.9) 
        });
      }
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
        
        // PDF에 이미지 그리기 (크기 2배 확대, 우측으로 재조정)
        page.drawImage(photoImg, { 
          x: 400, 
          y: y-90, 
          width: 140, 
          height: 140 
        });
        
        console.log('✅ 고객 사진 PDF 출력 성공!');
        
      } catch (photoError) {
        const errorMessage = photoError instanceof Error ? photoError.message : String(photoError);
        const errorName = photoError instanceof Error ? photoError.name : 'UnknownError';
        
        console.error('❌ 사진 로딩 실패 - 상세 정보:', {
          '오류 메시지': errorMessage,
          '오류 타입': errorName,
          '사진 URL': photoUrl,
          '전체 오류': photoError
        });
        
        // 사용자에게 더 구체적인 오류 메시지 표시
        const errorMsg = errorMessage.includes('JPEG') || errorMessage.includes('PNG') 
          ? '이미지 형식 오류' 
          : errorMessage.includes('fetch') || errorMessage.includes('다운로드')
          ? '이미지 다운로드 실패'
          : '이미지 처리 실패';
          
        page.drawText(errorMsg, { x: 440, y: y-40, size: 9, font, color: rgb(0.8,0.2,0.2) });
      }
    } else {
      console.warn('⚠️ 사진 URL을 찾을 수 없음');
              page.drawText('사진 없음', { x: 440, y: y-40, size: 12, font, color: rgb(0.5,0.5,0.5) });
    }
    y -= Math.max(22*customerTable.length+20, 160); // 사진 크기 고려하여 더 많은 공간 확보

    // 3. 거래 정보 (컬러 강조)
    const info = [
      [`거래ID`, selectedTx.id || '', rgb(0.2,0.2,0.2)],
      [`거래일자`, selectedTx.created_at?.slice(0,10) || '', rgb(0,0,0)],
      [`거래유형`, selectedTx.type || '', rgb(0.2,0.2,0.5)],
      [`기종/모델`, `${selectedTx.models_types?.model || ''} / ${selectedTx.models_types?.type || ''}`, rgb(0.2,0.2,0.5)],
      [`매출액`, `${selectedTx.amount?.toLocaleString() || ''}원`, rgb(0.1,0.4,0.1)],
      [`입금액`, `${(selectedTx.paid_amount||0).toLocaleString()}원`, rgb(0.1,0.4,0.1)],
      [`잔금`, `${(selectedTx.unpaid_amount||0).toLocaleString()}원`, rgb(0.7,0.1,0.1)],
      [`입금율`, selectedTx.paid_ratio !== undefined && selectedTx.paid_ratio !== null ? (selectedTx.paid_ratio*100).toFixed(1)+'%' : '-', rgb(0.1,0.4,0.1)],
      [`상태`, selectedTx.status || '', rgb(0.7,0.1,0.1)],
      [`비고`, selectedTx.description || '', rgb(0.3,0.3,0.3)]
    ];
    info.forEach(([k, v, color]) => {
      page.drawText(`${k}: ${v}`, { x: 60, y, size: 12, font, color });
      y -= 18;
    });
    y -= 10;

    // 4. 입금내역 표 (생략, 기존 코드 유지)
    // ... (생략: 기존 표 코드)

    // 5. 거래확인/사인란
    y -= 30;
    page.drawLine({ start: {x: 60, y}, end: {x: 300, y}, thickness: 1, color: rgb(0.7,0.7,0.8) });
    page.drawText('고객 확인/서명:', { x: 60, y: y+8, size: 12, font, color: rgb(0.1,0.2,0.5) });
    // (실제 서명 이미지는 추후 첨부 가능)

    // 6. 공급자 정보 (하단)
    const supplier = {
      name: '구보다농기계영암대리점',
      biznum: '743-39-01106',
      ceo: '정현목',
      address: '전남 영암군 군서면 녹암대동보길184',
      phone: '010-2602-3276',
      accounts: ACCOUNT_LIST
    };
    page.drawLine({ start: {x: 50, y: 80}, end: {x: 545, y: 80}, thickness: 1, color: rgb(0.7,0.7,0.8) });
    page.drawText(`공급자: ${supplier.name}  |  사업자번호: ${supplier.biznum}  |  대표: ${supplier.ceo}`, { x: 60, y: 65, size: 11, font, color: rgb(0.2,0.2,0.2) });
    page.drawText(`주소: ${supplier.address}  |  연락처: ${supplier.phone}`, { x: 60, y: 50, size: 11, font, color: rgb(0.2,0.2,0.2) });
    supplier.accounts.forEach((acc, i) => {
      page.drawText(`계좌${i+1}: ${acc.bank} ${acc.number} (${acc.holder})`, { x: 60, y: 35 - i*15, size: 11, font, color: rgb(0.2,0.2,0.2) });
    });

    // PDF 저장 및 다운로드
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '거래상세내역.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    if (typeof setErrorMsg === 'function') setErrorMsg('PDF 생성 중 오류 발생: ' + (err as any).message);
  }
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
  const [selectedAttachmentType, setSelectedAttachmentType] = useState(ATTACHMENT_TYPES[0]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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

  // 파일 업로드 핸들러 (첨부유형별, 5건 제한)
  const isValidUUID = (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);

  // PDF 내보내기 이벤트 리스너
  useEffect(() => {
    const handleExportPdf = () => {
      const selectedTx = txList.find(tx => tx.id === selectedId);
      if (selectedTx) {
        handlePdfExportPdfLib(selectedTx, filteredPayments);
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
        name: String(f.name),
        type: String(f.type),
        url: String(f.url),
        created_at: String(f.created_at),
        updated_at: String(f.updated_at || ''),
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
    await handlePdfExportPdfLib(selectedTx, filteredPayments);
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

  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm('정말로 이 입금내역을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/payments?id=${paymentId}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || '삭제 실패');
      setTxList(prev => prev.map(tx => {
        if (tx.id === selectedId) {
          return { ...tx, payments: (tx.payments || []).filter(p => p.id !== paymentId) };
        }
        return tx;
      }));
      setSuccessMsg('삭제되었습니다.');
    } catch (err: any) {
      setErrorMsg(err.message || '삭제 중 오류 발생');
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
      {/* 상단 거래별 목록 */}
      <div className="flex gap-2 mb-6">
        {txList.map((tx) => (
          <div key={tx.id} className="flex items-center gap-1">
            <button
              className={`px-3 py-1 rounded ${tx.id === selectedId ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setSelectedId(tx.id)}
              disabled={tx.id === selectedId}
            >
              {tx.created_at?.slice(0, 10)} {tx.type} {tx.amount?.toLocaleString()}원
            </button>
            <button
              className="text-red-500 hover:text-red-700"
              title="거래 삭제"
              onClick={async () => {
                if (!window.confirm('정말로 이 거래를 삭제하시겠습니까?')) return;
                const res = await fetch(`/api/transactions?id=${tx.id}`, { method: 'DELETE' });
                if (res.ok) {
                  setTxList(prev => prev.filter(t => t.id !== tx.id));
                  setSuccessMsg('거래가 삭제되었습니다.');
                  if (selectedId === tx.id && txList.length > 1) {
                    const nextTx = txList.find(t => t.id !== tx.id);
                    if (nextTx) setSelectedId(nextTx.id);
                  }
                } else {
                  const { error } = await res.json();
                  setErrorMsg('삭제 실패: ' + error);
                }
              }}
            >🗑️</button>
          </div>
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
        <select value={paymentFilter.method} onChange={e => setPaymentFilter(f => ({ ...f, method: e.target.value }))} className="border rounded px-2 py-1" title="입금방법" aria-label="입금방법">
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
        <select value={paymentFilter.sortBy} onChange={e => setPaymentFilter(f => ({ ...f, sortBy: e.target.value }))} className="border rounded px-2 py-1" title="정렬기준" aria-label="정렬기준">
          <option value="paid_at">일자순</option>
          <option value="amount">금액순</option>
        </select>
        <select value={paymentFilter.sortOrder} onChange={e => setPaymentFilter(f => ({ ...f, sortOrder: e.target.value }))} className="border rounded px-2 py-1" title="정렬방식" aria-label="정렬방식">
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
              <th className="border px-2 py-1">입금은행</th>
              <th className="border px-2 py-1">상세정보</th>
              <th className="border px-2 py-1">비고</th>
              <th className="border px-2 py-1">삭제</th>
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
                  <td className="border px-2 py-1">{p.bank_name || ''}</td>
                  <td className="border px-2 py-1">
                    {p.method === '카드' && (
                      <span>장소: {p.paid_location || ''} / 담당: ${p.paid_by || ''}</span>
                    )}
                    {p.method === '중고인수' && (
                      <span>기종: ${p.used_model_type || ''} / 모델: ${p.used_model || ''} / 장소: ${p.used_place || ''} / 담당: ${p.used_by || ''}</span>
                    )}
                    {p.method === '기타' && (
                      <span>{p.detail ?? ''}</span>
                    )}
                    {p.method === '현금' && (
                      <span>
                        장소: {p.cash_place || ''} / 수령: {p.cash_receiver || ''}
                        {p.cash_detail ? ` / 상세: ${p.cash_detail}` : ''}
                      </span>
                    )}
                    {p.method === '계좌이체' && (
                      <span>계좌: ${p.account_number || ''} / 예금주: ${p.account_holder || ''}</span>
                    )}
                    {p.method === '융자' && p.detail}
                  </td>
                  <td className="border px-2 py-1">{p.note}</td>
                  <td className="border px-2 py-1 text-center">
                    <button onClick={() => handleDeletePayment(p.id)} title="삭제" className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={8} className="text-center text-gray-400">입금내역 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* 증빙서류 첨부 */}
      <div className="mb-6">
        <h2 className="font-semibold mb-2">증빙서류 첨부</h2>
        <div className="flex flex-wrap gap-2 mb-2">
          {ATTACHMENT_TYPES.map(type => (
            <button
              key={type}
              className={`px-3 py-1 rounded ${selectedAttachmentType === type ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setSelectedAttachmentType(type)}
              type="button"
            >
              {type}
            </button>
          ))}
        </div>
        {/* 업로드/미리보기/삭제 */}
        <div className="flex flex-wrap gap-2">
          {(selectedTx.files || []).filter(f => f.type === selectedAttachmentType).length > 0 ? (
            (selectedTx.files || []).filter(f => f.type === selectedAttachmentType).map(f => (
              <div key={f.id} className="relative border rounded p-2 bg-gray-50 flex flex-col items-center w-32">
                {f.url && f.url.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
                  <>
                    <img
                      src={f.url}
                      alt={f.name}
                      className="w-24 h-24 object-cover rounded mb-1 cursor-pointer hover:opacity-80"
                      onClick={() => setPreviewImage(f.url)}
                    />
                    <span className="text-xs text-gray-700 truncate w-full text-center">{f.name}</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl text-gray-400 mb-1">📄</span>
                    <span className="text-xs text-gray-700 truncate w-full text-center">{f.name}</span>
                  </>
                )}
                <span className="text-[10px] text-gray-400 mt-1">{f.created_at?.slice(0,16).replace('T',' ')}</span>
                <div className="flex gap-1 mt-1">
                  <button className="text-blue-500 text-xs" onClick={() => handleFileDownload(f.url, f.name)} type="button">다운로드</button>
                  <button className="text-red-500 text-xs" onClick={() => handleDeleteFile(f.id)} disabled={uploading}>삭제</button>
                </div>
              </div>
            ))
          ) : (
            <div className="w-24 h-24 bg-gray-100 flex items-center justify-center rounded text-gray-400">첨부 없음</div>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
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
            className="px-3 py-1 bg-blue-500 text-white rounded"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            type="button"
          >
            {uploading ? '업로드 중...' : `${selectedAttachmentType} 업로드`}
          </button>
          <span className="text-xs text-gray-500">(최대 5건)</span>
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
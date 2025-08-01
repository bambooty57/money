"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { generateStatementPdf } from '@/components/statement-pdf';
import React from "react";
import { Card } from "@/components/ui/card";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { StatementPDFTable } from '@/components/statement-pdf';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PDFViewer } from '@react-pdf/renderer';
import { useRefreshContext } from '@/lib/refresh-context';
import ScrollToTop from '@/components/ui/scroll-to-top';
import { CustomerForm } from '@/components/customer-form';
import TransactionForm from '@/components/transaction-form';
import PaymentForm from '@/components/payment-form';
import { supabase } from '@/lib/supabase';
import { useTransactionsRealtime } from '@/lib/useTransactionsRealtime';
import { usePaymentsRealtime } from '@/lib/usePaymentsRealtime';
import { useCustomersRealtime } from '@/lib/useCustomersRealtime';

// 디바운싱 유틸리티 함수
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 검색 히스토리 관리
interface SearchHistory {
  customerId: string;
  name: string;
  searchCount: number;
  lastSearched: Date;
}

// 삭제 함수 직접 구현 (실시간 동기화에 의존)
async function deleteTransaction(id: string) {
  if (!id) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const res = await fetch(`/api/transactions?id=${id}`, {
    method: 'DELETE',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  if (res.ok) {
    alert('삭제되었습니다.');
  } else {
    const errorText = await res.text();
    alert('삭제 실패: ' + errorText);
  }
}

async function deletePayment(id: string) {
  if (!id) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const res = await fetch(`/api/payments?id=${id}`, {
    method: 'DELETE',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  if (res.ok) {
    alert('삭제되었습니다.');
  } else {
    const errorText = await res.text();
    alert('삭제 실패: ' + errorText);
  }
}

import type { Database } from '@/types/database';
type Customer = Database['public']['Tables']['customers']['Row'];

interface Transaction {
  id: string;
  created_at?: string;
  date: string;
  description?: string;
  amount: number;
  paid_amount: number;
  unpaid_amount: number;
  status: string;
  note?: string;
  notes?: string;
  type?: string;
  payments?: any[];
  model?: string;
  model_type?: string;
  models_types?: { model?: string; type?: string };
}

import SmsSender from '@/components/sms-sender';

export default function StatementPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerData, setCustomerData] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfViewMode, setPdfViewMode] = useState<'pdf' | 'table'>('pdf');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const { refreshKey, triggerRefresh } = useRefreshContext();
  const [search, setSearch] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  
  // 개선된 검색 관련 상태
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // 1. 고객 등록 모달 상태
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  // 2. 거래 등록/수정 모달 상태
  const [transactionFormOpen, setTransactionFormOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<any>(null);
  // 3. 입금 등록/수정 모달 상태
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<any>(null);
  const [targetTransactionId, setTargetTransactionId] = useState<string | null>(null);
  // 삭제 확인 모달 상태 추가
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [smsModalOpen, setSmsModalOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // 1. 고객 목록 불러오기 (refreshKey 변경 시에도 갱신)
  useEffect(() => {
    console.log('👥 StatementPage: Fetching customers list, refreshKey:', refreshKey);
    fetch("/api/customers?page=1&pageSize=100")
      .then((res) => res.json())
      .then((data) => {
        console.log('✅ StatementPage: Customers updated, count:', data.data?.length || 0);
        setCustomers(data.data || []);
      });
  }, [refreshKey]);

  // 검색 히스토리 로드
  useEffect(() => {
    const savedHistory = localStorage.getItem('customerSearchHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setSearchHistory(parsed.map((item: any) => ({
          ...item,
          lastSearched: new Date(item.lastSearched)
        })));
      } catch (error) {
        // 검색 히스토리 로드 실패 시 무시
      }
    }
  }, []);

  // 검색 히스토리 저장
  const saveSearchHistory = useCallback((customer: Customer) => {
    setSearchHistory(prev => {
      const existing = prev.find(h => h.customerId === customer.id);
      const updated = existing 
        ? prev.map(h => h.customerId === customer.id 
          ? { ...h, searchCount: h.searchCount + 1, lastSearched: new Date() }
          : h
        )
        : [...prev, {
          customerId: customer.id,
          name: customer.name,
          searchCount: 1,
          lastSearched: new Date()
        }];
      
      // 최대 20개로 제한하고 최신순으로 정렬
      const limited = updated
        .sort((a, b) => b.searchCount - a.searchCount || b.lastSearched.getTime() - a.lastSearched.getTime())
        .slice(0, 20);
      
      localStorage.setItem('customerSearchHistory', JSON.stringify(limited));
      return limited;
    });
  }, []);

  // 개선된 검색 함수 - 확장된 검색 필드
  const performSearch = useCallback((searchTerm: string) => {
    if (searchTerm.trim().length === 0) {
      setFilteredCustomers([]);
      setIsDropdownOpen(false);
      return;
    }

    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    const results = customers.filter(c => {
      // 기본 검색 필드
      const nameMatch = c.name?.toLowerCase().includes(normalizedSearch);
      const mobileMatch = c.mobile?.replace(/-/g, '').includes(normalizedSearch.replace(/-/g, ''));
      
      // 확장된 검색 필드
      const addressMatch = c.address?.toLowerCase().includes(normalizedSearch);
      const businessNameMatch = c.business_name?.toLowerCase().includes(normalizedSearch);
      const representativeNameMatch = c.representative_name?.toLowerCase().includes(normalizedSearch);
      const phoneMatch = c.phone?.replace(/-/g, '').includes(normalizedSearch.replace(/-/g, ''));
      
      return nameMatch || mobileMatch || addressMatch || businessNameMatch || representativeNameMatch || phoneMatch;
    });

    // 검색 히스토리 기반 정렬
    const sortedResults = results.sort((a, b) => {
      const aHistory = searchHistory.find(h => h.customerId === a.id);
      const bHistory = searchHistory.find(h => h.customerId === b.id);
      
      // 검색 히스토리가 있는 고객을 우선 표시
      if (aHistory && !bHistory) return -1;
      if (!aHistory && bHistory) return 1;
      if (aHistory && bHistory) {
        // 검색 횟수로 정렬, 같으면 최근 검색순
        if (aHistory.searchCount !== bHistory.searchCount) {
          return bHistory.searchCount - aHistory.searchCount;
        }
        return bHistory.lastSearched.getTime() - aHistory.lastSearched.getTime();
      }
      
      // 히스토리가 없는 경우 이름순
      return a.name.localeCompare(b.name);
    });

    setFilteredCustomers(sortedResults.slice(0, 20));
    setIsDropdownOpen(sortedResults.length > 0);
    setSelectedIndex(-1);
  }, [customers, searchHistory]);

  // 디바운싱된 검색 함수
  const debouncedSearch = useMemo(
    () => debounce(performSearch, 300),
    [performSearch]
  );

  // 검색 입력 처리
  const handleSearchInput = useCallback((value: string) => {
    setSearch(value);
    debouncedSearch(value);
  }, [debouncedSearch]);

  // 수동 검색 버튼 클릭
  const handleSearchButton = useCallback(() => {
    performSearch(search);
  }, [search, performSearch]);

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        if (!isDropdownOpen) return;
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCustomers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        if (!isDropdownOpen) return;
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (isDropdownOpen && selectedIndex >= 0 && filteredCustomers[selectedIndex]) {
          // 드롭다운에서 고객 선택
          handleCustomerSelect(filteredCustomers[selectedIndex]);
        } else {
          // 검색 실행
          handleSearchButton();
        }
        break;
      case 'Escape':
        if (!isDropdownOpen) return;
        e.preventDefault();
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }, [isDropdownOpen, filteredCustomers, selectedIndex, handleSearchButton]);

  // 고객 선택 처리
  const handleCustomerSelect = useCallback((customer: Customer) => {
    setSelectedCustomer(customer.id);
    setSearch('');
    setFilteredCustomers([]);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
    saveSearchHistory(customer);
  }, [saveSearchHistory]);

  // 2. 고객 선택 시 거래내역+부분합 fetch
  useEffect(() => {
    if (!selectedCustomer) return;
    console.log('📊 StatementPage: Fetching data for customer:', selectedCustomer, 'refreshKey:', refreshKey);
    setLoading(true);
    
    // 고객 상세 정보와 거래내역을 병렬로 가져오기 (응답이 ok일 때만 .json() 호출)
    Promise.all([
      fetch(`/api/customers/${selectedCustomer}`).then(async res => res.ok ? res.json() : null),
      fetch(`/api/customers/${selectedCustomer}/summary`).then(async res => res.ok ? res.json() : { transactions: [], supplier: {} })
    ])
    .then(([customerResponse, summaryResponse]) => {
      let customerObj = customerResponse;
      if (customerResponse && typeof customerResponse === 'object' && 'data' in customerResponse) {
        customerObj = customerResponse.data;
      }
      console.log('✅ StatementPage: Data updated - transactions:', summaryResponse.transactions?.length || 0);
      setCustomerData(customerObj);
      setTransactions(summaryResponse.transactions || []);
      setSummary(summaryResponse);
      setCustomerName(customerObj?.name || "");
    })
    .finally(() => setLoading(false));
  }, [selectedCustomer, customers, refreshKey]);

  // 실시간 거래/입금/고객 구독: 전체 변경 감지
  useTransactionsRealtime({
    onTransactionsChange: useCallback(() => {
      console.log('🔄 StatementPage: Transaction change detected, refreshing ALL data');
      triggerRefresh();
    }, [triggerRefresh]),
  });
  usePaymentsRealtime({
    onPaymentsChange: useCallback(() => {
      console.log('💸 StatementPage: Payment change detected, refreshing ALL data');
      triggerRefresh();
    }, [triggerRefresh]),
  });
  useCustomersRealtime({
    onChange: useCallback(() => {
      console.log('👤 StatementPage: Customer change detected, refreshing ALL data');
      triggerRefresh();
    }, [triggerRefresh]),
  });

  // 3. 엑셀 다운로드
  const handleExcelDownload = () => {
    if (!transactions.length) return;
    const excelRows: any[] = [];
    transactions.forEach((tx) => {
      // 거래 기본 정보 행
      excelRows.push({
        일자: tx.created_at?.slice(0, 10) || "",
        거래명: tx.type || "",
        "기종/모델": (tx.model || tx.models_types?.model || '') + ((tx.model || tx.models_types?.model) && (tx.model_type || tx.models_types?.type) ? '/' : '') + (tx.model_type || tx.models_types?.type || ''),
        "대변(매출)": tx.amount || 0,
        "차변(입금)": tx.paid_amount || 0,
        잔액: tx.unpaid_amount || 0,
        비고: tx.description || tx.notes || tx.note || "",
      });
      // 입금내역 행들
      if (Array.isArray(tx.payments) && tx.payments.length > 0) {
        tx.payments.forEach((p) => {
          excelRows.push({
            일자: p.paid_at?.slice(0, 10) || "",
            거래명: "입금내역",
            "기종/모델": "",
            "대변(매출)": "",
            "차변(입금)": p.amount?.toLocaleString() || "",
            잔액: "",
            비고: [p.method, p.payer_name, p.bank_name, p.account_number, p.account_holder, p.cash_place, p.cash_receiver, p.detail, p.note].filter(Boolean).join(' / ')
          });
        });
      } else {
        // 입금내역 없음 표시(선택, 필요시 주석처리)
        // excelRows.push({ 일자: "", 거래명: "입금없음", "기종/모델": "", "대변(매출)": "", "차변(입금)": "", 잔액: "", 비고: "" });
      }
    });
    // 합계 행
    excelRows.push({
      일자: "합계",
      거래명: "",
      "기종/모델": "",
      "대변(매출)": summary?.total_amount || 0,
      "차변(입금)": summary?.total_paid || 0,
      잔액: summary?.total_unpaid || 0,
      비고: "",
    });
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, customerName || "거래명세서");
    XLSX.writeFile(wb, `${customerName || "거래명세서"}.xlsx`);
  };

  // 4. PDF 미리보기/다운로드 모달 열기
  const handlePdfPrint = () => {
    setPdfModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ScrollToTop />
      {/* PDF 미리보기/다운로드 모달 */}
      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">PDF 미리보기</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-4">
            <PDFDownloadLink
              document={<StatementPDFTable transactions={transactions as any[]} customer={customerData} supplier={summary?.supplier as any} title="거래명세서" printDate={new Date().toLocaleDateString()} />}
              fileName={`${customerName || '거래명세서'}.pdf`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
            >
              {({ loading }) => loading ? 'PDF 생성 중...' : 'PDF 다운로드'}
            </PDFDownloadLink>
            <button onClick={() => setPdfModalOpen(false)} className="px-4 py-2 bg-gray-300 rounded-lg font-bold hover:bg-gray-400">닫기</button>
          </div>
          <div className="flex-1 border rounded-lg overflow-hidden">
            {selectedCustomer && transactions.length > 0 ? (
              <div className="h-full flex flex-col">
                <div className="flex gap-2 p-2 bg-gray-100 border-b">
                  <button
                    onClick={() => setPdfViewMode('pdf')}
                    className={`px-3 py-1 rounded ${pdfViewMode === 'pdf' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                  >
                    PDF 미리보기
                  </button>
                </div>
                <div
                  className="flex-1 pdf-print-area"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    background: '#fff',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <PDFViewer
                    width="1122px"
                    height="793px"
                    style={{ backgroundColor: 'white' }}
                    showToolbar={false}
                  >
                    <StatementPDFTable
                      transactions={transactions as any[]}
                      customer={customerData}
                      supplier={summary?.supplier as any}
                      title="거래명세서"
                      printDate={new Date().toLocaleDateString()}
                    />
                  </PDFViewer>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                고객을 선택하고 거래내역이 있어야 PDF를 생성할 수 있습니다.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* CustomerForm 모달 */}
      {customerFormOpen && (
        <CustomerForm open={customerFormOpen} setOpen={setCustomerFormOpen} onSuccess={() => { setCustomerFormOpen(false); }} customer={editCustomer} />
      )}
      {/* 거래 등록 버튼 (고객 선택 시 활성화) */}
      {/* 상단(카드 바깥)의 고객등록/거래등록 버튼은 완전히 제거 */}
      {/* 고객 등록 버튼 (검색창 옆) */}
      {/* 상단(카드 바깥)의 고객등록/거래등록 버튼은 완전히 제거 */}
      <Card className="rounded-2xl shadow-xl border bg-white p-8 max-w-none w-full mx-auto">
        <h1 className="text-3xl font-bold text-blue-800 flex items-center gap-3 mb-8 justify-center text-center">
          거래명세서
        </h1>
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center relative">
          <label className="text-lg font-semibold text-gray-700">고객 검색:</label>
          <div className="relative w-full max-w-xs">
            <input
              ref={inputRef}
              type="text"
              className="border rounded px-4 py-3 text-xl min-w-[200px] w-full focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="고객명/전화번호/주소/회사명으로 검색"
              value={search}
              onChange={e => handleSearchInput(e.target.value)}
              onKeyPress={handleKeyDown}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              style={{ fontSize: '1.25rem' }}
            />
            <Button 
              onClick={handleSearchButton}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white px-4 py-2 rounded text-lg font-bold hover:bg-blue-700"
            >
              🔍 검색
            </Button>
            {isDropdownOpen && (
              <ul className="absolute left-0 right-0 bg-white border rounded shadow-lg z-10 mt-1 max-h-72 overflow-y-auto text-lg">
                {filteredCustomers.map((c, index) => {
                  const history = searchHistory.find(h => h.customerId === c.id);
                  return (
                    <li
                      key={c.id}
                      className={`px-4 py-3 hover:bg-blue-100 cursor-pointer ${selectedIndex === index ? 'bg-blue-100 font-bold' : ''}`}
                      onClick={() => handleCustomerSelect(c)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onMouseLeave={() => setSelectedIndex(-1)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{c.name}</span>
                            {history && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                🔍 {history.searchCount}회
                              </span>
                            )}
                          </div>
                          <div className="text-gray-500 text-base mt-1">
                            {c.mobile && <span className="mr-3">📱 {c.mobile}</span>}
                            {c.phone && <span className="mr-3">📞 {c.phone}</span>}
                            {c.address && <span className="mr-3">📍 {c.address}</span>}
                            {c.business_name && <span className="text-sm">🏢 {c.business_name}</span>}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
                {filteredCustomers.length === 0 && search.trim().length > 0 && (
                  <li className="px-4 py-3 text-gray-500 text-lg">검색 결과 없음</li>
                )}
              </ul>
            )}
          </div>
          {/* 버튼 우측 정렬: flex-row-reverse */}
          <div className="flex flex-row-reverse gap-2 w-full md:w-auto">
            <Button onClick={() => { setEditCustomer(null); setCustomerFormOpen(true); }} className="bg-blue-700 text-white px-6 py-3 rounded-lg text-xl font-bold">➕ 신규 고객 등록</Button>
            {selectedCustomer && (
              <Button onClick={() => { setEditTransaction(null); setTransactionFormOpen(true); }} className="bg-orange-600 text-white px-6 py-3 rounded-lg text-xl font-bold">➕ 거래 등록</Button>
            )}
          </div>
          {/* 다운로드 및 액션 버튼들 */}
          <div className="flex flex-wrap gap-3 items-center">
            <Button onClick={handleExcelDownload} className="bg-green-600 text-white px-4 py-2 rounded-lg text-lg font-bold hover:bg-green-700 transition-colors">📊 엑셀 다운로드</Button>
            
            {/* PDF 다운로드 버튼 - 바로 다운로드 */}
            {selectedCustomer && transactions.length > 0 ? (
              <PDFDownloadLink
                document={<StatementPDFTable transactions={transactions as any[]} customer={customerData} supplier={summary?.supplier as any} title="거래명세서" printDate={new Date().toLocaleDateString()} />}
                fileName={`${customerName || '거래명세서'}.pdf`}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-lg font-bold hover:bg-blue-700 transition-colors"
              >
                {({ loading }) => loading ? '📄 PDF 생성중...' : '📄 PDF 다운로드'}
              </PDFDownloadLink>
            ) : (
              <Button disabled className="bg-gray-400 text-white px-4 py-2 rounded-lg text-lg font-bold cursor-not-allowed">📄 PDF 다운로드</Button>
            )}
            
            {/* PDF 미리보기 버튼 - 모달 열기 */}
            <Button 
              onClick={handlePdfPrint} 
              disabled={!selectedCustomer || transactions.length === 0}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-lg font-bold hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              👁️ PDF 미리보기
            </Button>
            
            {selectedCustomer && customerData && (
              <Button
                onClick={() => setSmsModalOpen(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg text-lg font-bold hover:bg-purple-700 transition-colors"
              >
                💬 문자보내기
              </Button>
            )}
          </div>
        </div>
        <div className="mb-8 border-b pb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
              👤 {customerName} <span className="text-lg text-gray-500">거래명세서</span>
            </h2>
            {/* 고객 정보 등 추가 정보 필요시 여기에 */}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table id="statement-table" className="w-full divide-y divide-blue-100">
            <TableHeader>
              <TableRow className="bg-blue-50">
                <TableHead className="w-20 text-center">#</TableHead>
                <TableHead className="w-24 text-center">일자</TableHead>
                <TableHead className="w-32 text-center">거래명</TableHead>
                <TableHead className="w-40 text-center">기종/모델</TableHead>
                <TableHead className="text-right w-32 pl-8">대변(매출)</TableHead>
                <TableHead className="text-right w-32">차변(입금)</TableHead>
                <TableHead className="text-right w-32 pl-32">잔액</TableHead>
                <TableHead className="w-56 text-center">비고</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx, idx) => (
                <React.Fragment key={tx.id}>
                  <TableRow className="bg-red-50 ring-2 ring-red-200 rounded-xl shadow hover:bg-red-100 min-h-[72px] transition-all duration-200">
                    <TableCell className="text-center align-middle px-4 py-8 bg-red-50 font-semibold w-20">{idx + 1}</TableCell>
                    <TableCell className="px-4 py-8 bg-red-50 font-semibold w-24 text-center">{tx.created_at?.slice(0, 10) || ""}</TableCell>
                    <TableCell className="px-4 py-8 bg-red-50 font-semibold w-32 text-center">{tx.type || ""}</TableCell>
                    <TableCell className="px-4 py-8 bg-red-50 font-semibold w-40 text-center">{tx.model || tx.models_types?.model || ''}{(tx.model || tx.models_types?.model) && (tx.model_type || tx.models_types?.type) ? '/' : ''}{tx.model_type || tx.models_types?.type || ''}</TableCell>
                    <TableCell className="text-right px-4 py-8 bg-red-50 font-semibold w-32">
                      <span className="text-red-600">{tx.amount?.toLocaleString() || ""}</span>
                    </TableCell>
                    <TableCell className="text-right px-4 py-8 bg-red-50 font-semibold w-32 pl-32">
                      <span className="text-blue-600">{tx.paid_amount?.toLocaleString() || ""}</span>
                    </TableCell>
                    <TableCell className="text-right px-4 py-8 bg-red-50 font-semibold w-32">
                      <span className="text-yellow-600">{tx.unpaid_amount?.toLocaleString() || ""}</span>
                    </TableCell>
                    <TableCell className="px-4 py-8 bg-red-50 font-semibold w-56 text-center">{tx.description || tx.notes || tx.note || ""}</TableCell>
                    <TableCell className="text-center flex flex-row gap-2 justify-center items-center bg-red-50">
                      <Button onClick={() => { setEditTransaction(tx); setTransactionFormOpen(true); }} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-lg font-bold">✏️ 수정</Button>
                      {editTransaction && editTransaction.id === tx.id && (
                        <Button onClick={() => { setEditTransaction(null); setTransactionFormOpen(false); }} className="bg-gray-400 text-white px-4 py-2 rounded-lg text-lg font-bold hover:bg-gray-300">취소하기</Button>
                      )}
                      <Button onClick={() => { setDeleteTargetId(tx.id); setDeleteModalOpen(true); }} className="bg-red-600 text-white px-4 py-2 rounded-lg text-lg font-bold">🗑️ 삭제</Button>
                      {/* 입금 등록/수정/삭제 버튼: 거래 1건당 1개만 허용 */}
                      {Array.isArray(tx.payments) && tx.payments.length === 0 && (
                        <Button onClick={() => { setTargetTransactionId(tx.id); setEditPayment(null); setPaymentFormOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg text-lg font-bold">➕ 입금 등록</Button>
                      )}
                      {Array.isArray(tx.payments) && tx.payments.length === 1 && (
                        <>
                          <Button onClick={() => { setTargetTransactionId(tx.id); setEditPayment((tx.payments as any[])[0]); setPaymentFormOpen(true); }} className="bg-green-700 text-white px-4 py-2 rounded-lg text-lg font-bold">✏️ 입금 수정</Button>
                          <Button onClick={async () => { if(window.confirm('정말 삭제하시겠습니까?')) { await deletePayment((tx.payments as any[])[0].id); }}} className="bg-red-700 text-white px-4 py-2 rounded-lg text-lg font-bold">🗑️ 입금 삭제</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                  {/* 입금내역 하위 행은 정보만 표시, 버튼은 제거 */}
                  {Array.isArray(tx.payments) && tx.payments.length > 0 ? (
                    tx.payments.map((p, pidx) => (
                      <TableRow key={p.id || pidx} className="bg-blue-50">
                        <TableCell className="w-20" />
                        <TableCell className="w-20" />
                        <TableCell className="w-24 text-center">{p.paid_at?.slice(0, 10) || ""}</TableCell>
                        <TableCell className="w-28 text-right pr-4">{p.amount?.toLocaleString() || ""}</TableCell>
                        <TableCell className="w-28 pl-4">{p.method || ""}</TableCell>
                        <TableCell className="w-28">{p.payer_name || ""}</TableCell>
                        <TableCell className="w-40 text-center">{[p.bank_name, p.account_number, p.account_holder, p.cash_place, p.cash_receiver, p.detail, p.note].filter(Boolean).join(' / ')}</TableCell>
                        <TableCell />
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="bg-blue-50">
                      <TableCell className="w-20" />
                      <TableCell className="w-20" />
                      <TableCell className="w-20" />
                      <TableCell colSpan={5} className="text-center text-blue-700 font-bold py-4 text-lg">입금없음</TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
              {summary && (
                <TableRow className="bg-blue-100 font-bold text-xl">
                  <TableCell className="border-none" colSpan={2}></TableCell>
                  <TableCell className="border-none text-center">총합계</TableCell>
                  <TableCell className="border-none text-center px-2 text-red-700">총매출: {summary.total_amount?.toLocaleString()}</TableCell>
                  <TableCell className="border-none text-center px-2 text-blue-700">총입금: {summary.total_paid?.toLocaleString()}</TableCell>
                  <TableCell className="border-none text-center px-2 text-yellow-700">총잔금: {summary.total_unpaid?.toLocaleString()}</TableCell>
                  <TableCell className="border-none" colSpan={2}></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      {/* PaymentForm 모달 (등록/수정) */}
      {paymentFormOpen && (
        <PaymentForm onSuccess={() => { setPaymentFormOpen(false); }} transactionId={targetTransactionId} payment={editPayment} />
      )}
      {/* TransactionForm 모달(등록/수정) */}
      {transactionFormOpen && (
        <TransactionForm onSuccess={() => { setTransactionFormOpen(false); }} customers={customers} transaction={editTransaction} defaultCustomerId={!editTransaction ? selectedCustomer : undefined} />
      )}
      {/* 삭제 확인 모달 */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">정말 삭제하시겠습니까?</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4 mt-6 justify-center">
            <Button 
              onClick={async () => { 
                if(deleteTargetId) { 
                  await deleteTransaction(deleteTargetId); 
                  setDeleteModalOpen(false); 
                  setDeleteTargetId(null); 
                }
              }} 
              className="bg-red-600 text-white px-6 py-3 rounded-lg text-xl font-bold hover:bg-red-700"
            >
              삭제
            </Button>
            <Button 
              onClick={() => { 
                setDeleteModalOpen(false); 
                setDeleteTargetId(null); 
              }} 
              className="bg-gray-400 text-white px-6 py-3 rounded-lg text-xl font-bold hover:bg-gray-500"
            >
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* 문자보내기 모달 */}
      <Dialog open={smsModalOpen} onOpenChange={setSmsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>문자 보내기</DialogTitle>
          </DialogHeader>
          <SmsSender
            selectedCustomer={{
              ...customerData,
              total_unpaid: summary?.total_unpaid || summary?.supplier?.total_unpaid || 0,
              transaction_count: summary?.transaction_count || summary?.supplier?.transaction_count || 0,
            }}
            onSuccess={() => setSmsModalOpen(false)}
          />
          <div className="flex justify-end mt-4">
            <Button onClick={() => setSmsModalOpen(false)} className="bg-gray-400 text-white px-4 py-2 rounded-lg font-bold">닫기</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
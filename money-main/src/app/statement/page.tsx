"use client";

import React from "react";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { generateStatementPdf } from '@/components/statement-pdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  
  // 🔍 디버깅: transactions 상태 변경 추적
  useEffect(() => {
    console.log('🔄 transactions 상태 변경됨:', transactions.length, '개');
  }, [transactions]);
  
  // 🔍 디버깅: selectedCustomer 상태 변경 추적  
  useEffect(() => {
    console.log('👤 selectedCustomer 상태 변경됨:', selectedCustomer);
  }, [selectedCustomer]);

  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
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
  
  // 입금 다중 선택 상태 추가
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [selectAllPayments, setSelectAllPayments] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // 📅 거래목록을 일자별로 정렬 (오름차순: 오래된 것부터)
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const dateA = a.created_at || a.date || '';
      const dateB = b.created_at || b.date || '';
      // 일자가 없으면 맨 뒤로
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      // 일자 오름차순 정렬
      return dateA.localeCompare(dateB);
    });
  }, [transactions]);

  // 🆕 데이터 변경 시 입금 선택 상태 초기화
  useEffect(() => {
    setSelectedPaymentIds(new Set());
    setSelectAllPayments(false);
  }, [selectedCustomer, transactions]);

  // 🆕 선택된 입금에 따라 전체 선택 체크박스 상태 업데이트
  useEffect(() => {
    const allPaymentIds = new Set<string>();
    sortedTransactions.forEach(tx => {
      if (Array.isArray(tx.payments)) {
        tx.payments.forEach(p => {
          if (p.id) allPaymentIds.add(p.id);
        });
      }
    });
    
    if (allPaymentIds.size > 0 && selectedPaymentIds.size === allPaymentIds.size) {
      setSelectAllPayments(true);
    } else {
      setSelectAllPayments(false);
    }
  }, [selectedPaymentIds, sortedTransactions]);

  // 1. 고객 목록 불러오기 (refreshKey 변경 시에도 갱신)
  useEffect(() => {
    console.log('👥 StatementPage: Fetching customers list, refreshKey:', refreshKey);
    fetch("/api/customers?page=1&pageSize=10000")
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
    console.log('🎯 고객 선택됨:', customer.name);
    
    // 즉시 드롭다운 닫기
    setIsDropdownOpen(false);
    setFilteredCustomers([]);
    setSelectedIndex(-1);
    
    // 입력 필드 초기화 및 포커스 해제
    setSearch('');
    inputRef.current?.blur();
    
    // 고객 선택 (약간의 지연으로 확실한 상태 업데이트)
    setTimeout(() => {
      setSelectedCustomer(customer.id);
      saveSearchHistory(customer);
      console.log('✅ 고객 선택 완료, 드롭다운 닫힘');
    }, 50);
  }, [saveSearchHistory]);

  // 외부 클릭 시 드롭다운 자동 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isDropdownOpen) return;
      
      const target = event.target as Element;
      const searchContainer = document.querySelector('.customer-search-container');
      
      // 클릭한 요소가 검색 컨테이너 내부가 아니면 드롭다운 닫기
      if (searchContainer && !searchContainer.contains(target)) {
        console.log('🖱️ 외부 클릭 감지: 드롭다운 닫기');
        setIsDropdownOpen(false);
        setFilteredCustomers([]);
        setSelectedIndex(-1);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  // 2. 고객 선택 시 거래내역+부분합 fetch
  useEffect(() => {
    if (!selectedCustomer) return;
    console.log('📊 StatementPage: Fetching data for customer:', selectedCustomer, 'refreshKey:', refreshKey);
    setLoading(true);
    
    // 고객 상세 정보와 거래내역을 병렬로 가져오기 (캐시 무효화 포함)
    const timestamp = Date.now();
    Promise.all([
      fetch(`/api/customers/${selectedCustomer}?t=${timestamp}`, { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      }).then(async res => res.ok ? res.json() : null),
      fetch(`/api/customers/${selectedCustomer}/summary?t=${timestamp}`, { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      }).then(async res => res.ok ? res.json() : { transactions: [], supplier: {} })
    ])
    .then(([customerResponse, summaryResponse]) => {
      let customerObj = customerResponse;
      if (customerResponse && typeof customerResponse === 'object' && 'data' in customerResponse) {
        customerObj = customerResponse.data;
      }
      console.log('✅ StatementPage: Data updated - transactions:', summaryResponse.transactions?.length || 0);
      setCustomerData(customerObj);
      setTransactions([...summaryResponse.transactions || []]); // 새 배열로 강제 업데이트
      setSummary({...summaryResponse}); // 새 객체로 강제 업데이트
      setCustomerName(customerObj?.name || "");
    })
    .finally(() => setLoading(false));
  }, [selectedCustomer, customers, refreshKey]);

  // 실시간 거래/입금/고객 구독: 전체 변경 감지
  useTransactionsRealtime({
    onTransactionsChange: useCallback(() => {
      console.log('🔄 StatementPage: Transaction change detected, refreshing ALL data');
      // 500ms 지연 후 갱신 (데이터베이스 반영 대기)
      setTimeout(() => {
        console.log('⏰ Delayed refresh after transaction change');
        triggerRefresh();
      }, 500);
    }, [triggerRefresh]),
  });
  usePaymentsRealtime({
    onPaymentsChange: useCallback(() => {
      console.log('💸 StatementPage: Payment change detected, refreshing ALL data');
      // 500ms 지연 후 갱신 (데이터베이스 반영 대기)
      setTimeout(() => {
        console.log('⏰ Delayed refresh after payment change');
        triggerRefresh();
      }, 500);
    }, [triggerRefresh]),
  });
  useCustomersRealtime({
    onChange: useCallback(() => {
      console.log('👤 StatementPage: Customer change detected, refreshing ALL data');
      // 500ms 지연 후 갱신 (데이터베이스 반영 대기)
      setTimeout(() => {
        console.log('⏰ Delayed refresh after customer change');
        triggerRefresh();
      }, 500);
    }, [triggerRefresh]),
  });

  // 🆕 입금 체크박스 선택/해제 핸들러 (React 19 자동 최적화)
  const handlePaymentCheckboxChange = (paymentId: string, checked: boolean) => {
    setSelectedPaymentIds(prev => {
      const newSelected = new Set(prev);
      if (checked) {
        newSelected.add(paymentId);
      } else {
        newSelected.delete(paymentId);
      }
      return newSelected;
    });
  };

  // 🆕 전체 입금 선택/해제 핸들러 (React 19 자동 최적화)
  const handleSelectAllPayments = (checked: boolean) => {
    if (checked) {
      const allPaymentIds = new Set<string>();
      sortedTransactions.forEach(tx => {
        if (Array.isArray(tx.payments)) {
          tx.payments.forEach(p => {
            if (p.id) allPaymentIds.add(p.id);
          });
        }
      });
      setSelectedPaymentIds(allPaymentIds);
      setSelectAllPayments(true);
    } else {
      setSelectedPaymentIds(new Set());
      setSelectAllPayments(false);
    }
  };

  // 🆕 선택된 입금 내역 일괄 삭제
  const handleBulkDeletePayments = useCallback(async () => {
    if (selectedPaymentIds.size === 0) return;
    
    if (!window.confirm(`선택된 ${selectedPaymentIds.size}개의 입금내역을 정말 삭제하시겠습니까?`)) return;
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) {
        alert('인증이 필요합니다.');
        return;
      }
      
      const paymentIds = Array.from(selectedPaymentIds).join(',');
      const res = await fetch(`/api/payments?ids=${paymentIds}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (res.ok) {
        const result = await res.json();
        alert(result.message || `${selectedPaymentIds.size}개의 입금내역이 삭제되었습니다.`);
        setSelectedPaymentIds(new Set());
        setSelectAllPayments(false);
        // 데이터 새로고침
        triggerRefresh();
      } else {
        const errorText = await res.text();
        alert('삭제 실패: ' + errorText);
      }
    } catch (error) {
      console.error('입금 일괄 삭제 중 오류:', error);
      alert('입금 삭제 중 오류가 발생했습니다.');
    }
  }, [selectedPaymentIds, triggerRefresh]);

  // 🆕 PDF 다운로드 핸들러
  const handlePdfDownload = useCallback(async () => {
    if (!selectedCustomer || !customerData || !sortedTransactions.length) {
      alert('고객을 선택하고 거래내역이 있어야 PDF를 생성할 수 있습니다.');
      return;
    }

    try {
      // 공급자 정보 API에서 가져오기
      const supplierResponse = await fetch('/api/supplier-info');
      const supplierInfo = supplierResponse.ok ? await supplierResponse.json() : {
        name: '구보다농기계영암대리점',
        ceo: '정현목',
        biznum: '743-39-01106',
        address: '전남 영암군 군서면 녹암대동보길184',
        phone: '010-2602-3276',
        accounts: [{ bank: '농협', number: '302-2602-3276-61', holder: '정현목' }]
      };

      // 입금내역 수집
      const allPayments = sortedTransactions.flatMap(tx => 
        Array.isArray(tx.payments) ? tx.payments : []
      );

      const pdfBlob = await generateStatementPdf({
        customer: customerData,
        transactions: sortedTransactions,
        payments: allPayments,
        supplier: supplierInfo,
        title: '거래명세서',
        printDate: new Date().toLocaleDateString('ko-KR')
      });

      // PDF 다운로드
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `거래명세서_${customerData.name}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('PDF 생성 오류:', error);
      alert('PDF 생성 중 오류가 발생했습니다: ' + (error as Error).message);
    }
  }, [selectedCustomer, customerData, sortedTransactions]);

  // 3. 엑셀 다운로드
  const handleExcelDownload = () => {
    if (!sortedTransactions.length) return;
    const excelRows: any[] = [];
    sortedTransactions.forEach((tx) => {
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



  return (
    <div className="min-h-screen bg-gray-50">
      <ScrollToTop />

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
          <div className="relative w-full max-w-xs customer-search-container">
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
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCustomerSelect(c);
                      }}
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
            
            {/* PDF 다운로드 버튼 - pdf-lib 기반으로 활성화 */}
            <Button 
              onClick={handlePdfDownload} 
              disabled={!selectedCustomer || !transactions.length}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-lg font-bold hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              title={!selectedCustomer || !transactions.length ? "고객과 거래내역이 있어야 PDF를 생성할 수 있습니다" : "PDF 다운로드"}
            >
              📄 PDF 다운로드
            </Button>
            
            {/* 입금 일괄 삭제 버튼 */}
            {selectedPaymentIds.size > 0 && (
              <Button 
                onClick={handleBulkDeletePayments}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-lg font-bold hover:bg-red-700 transition-colors"
              >
                🗑️ 선택된 입금 삭제 ({selectedPaymentIds.size}개)
              </Button>
            )}
            
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
                <TableHead className="w-16 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectAllPayments}
                    onChange={(e) => handleSelectAllPayments(e.target.checked)}
                    className="w-4 h-4"
                    title="전체 입금 선택/해제"
                  />
                </TableHead>
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
              {sortedTransactions.map((tx, idx) => (
                <React.Fragment key={tx.id}>
                  <TableRow className="bg-red-50 ring-2 ring-red-200 rounded-xl shadow hover:bg-red-100 min-h-[72px] transition-all duration-200">
                    <TableCell className="text-center align-middle px-4 py-8 bg-red-50 w-16"></TableCell>
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
                      {/* 입금 등록/수정/삭제 버튼: 여러 건 입금 허용 */}
                      {/* 입금 추가 버튼 - 항상 표시 */}
                      <Button onClick={() => { setTargetTransactionId(tx.id); setEditPayment(null); setPaymentFormOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg text-lg font-bold">➕ 입금 추가</Button>
                      
                      {/* 기존 입금이 있을 때만 수정/삭제 버튼 표시 */}
                      {Array.isArray(tx.payments) && tx.payments.length > 0 && (
                        <>
                          <Button onClick={() => { setTargetTransactionId(tx.id); setEditPayment((tx.payments as any[])[0]); setPaymentFormOpen(true); }} className="bg-green-700 text-white px-4 py-2 rounded-lg text-lg font-bold">✏️ 입금 수정</Button>
                          <Button onClick={async () => { if(window.confirm('정말 삭제하시겠습니까?')) { await deletePayment((tx.payments as any[])[0].id); }}} className="bg-red-700 text-white px-4 py-2 rounded-lg text-lg font-bold">🗑️ 입금 삭제</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                  {/* 입금내역 개별 행으로 표시 */}
                  {Array.isArray(tx.payments) && tx.payments.length > 0 ? (
                    tx.payments.map((p, pidx) => (
                      <TableRow key={p.id || pidx} className="bg-blue-50">
                        <TableCell className="text-center w-16">
                          <input 
                            type="checkbox" 
                            checked={selectedPaymentIds.has(p.id)}
                            onChange={(e) => handlePaymentCheckboxChange(p.id, e.target.checked)}
                            className="w-4 h-4"
                          />
                        </TableCell>
                        <TableCell className="text-center w-20" />
                        <TableCell className="text-center w-24 font-semibold">{p.paid_at?.slice(0, 10) || ""}</TableCell>
                        <TableCell className="text-center w-32 font-semibold text-blue-700">{p.method || ""}</TableCell>
                        <TableCell className="text-center w-40" />
                        <TableCell className="text-right w-32" />
                        <TableCell className="text-right w-32 font-semibold text-green-600">{p.amount?.toLocaleString() || ""}</TableCell>
                        <TableCell className="text-right w-32" />
                        <TableCell className="text-center w-56 font-semibold text-gray-700">
                          {[
                            p.payer_name && `입금자:${p.payer_name}`,
                            p.bank_name && `은행:${p.bank_name}`,
                            p.account_number && `계좌:${p.account_number}`,
                            p.account_holder && `예금주:${p.account_holder}`,
                            p.cash_place && `장소:${p.cash_place}`,
                            p.cash_receiver && `수령자:${p.cash_receiver}`,
                            p.detail && `상세:${p.detail}`,
                            p.note && `비고:${p.note}`
                          ].filter(Boolean).join(' / ')}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="bg-blue-50">
                      <TableCell className="w-16" />
                      <TableCell className="w-20" />
                      <TableCell className="w-24" />
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
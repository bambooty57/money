"use client";

import { useEffect, useState, useRef } from "react";
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
import { Dialog } from '@headlessui/react';
import { PDFViewer } from '@react-pdf/renderer';
import { useRefreshContext } from '@/lib/refresh-context';
import ScrollToTop from '@/components/ui/scroll-to-top';
import { CustomerForm } from '@/components/customer-form';
import TransactionForm from '@/components/transaction-form';
import PaymentForm from '@/components/payment-form';
import { supabase } from '@/lib/supabase';
import { useTransactionsRealtime } from '@/lib/useTransactionsRealtime';
import { usePaymentsRealtime } from '@/lib/usePaymentsRealtime';
// 삭제 함수 직접 구현
async function deleteTransaction(id: string, triggerRefresh: () => void) {
  if (!id) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const res = await fetch(`/api/transactions?id=${id}`, {
    method: 'DELETE',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  if (res.ok) {
    triggerRefresh();
    alert('삭제되었습니다.');
  } else {
    const errorText = await res.text();
    alert('삭제 실패: ' + errorText);
  }
}
async function deletePayment(id: string, triggerRefresh: () => void) {
  if (!id) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const res = await fetch(`/api/payments?id=${id}`, {
    method: 'DELETE',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  if (res.ok) {
    triggerRefresh();
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

  const inputRef = useRef<HTMLInputElement>(null);

  // 1. 고객 목록 불러오기
  useEffect(() => {
    fetch("/api/customers?page=1&pageSize=100")
      .then((res) => res.json())
      .then((data) => setCustomers(data.data || []));
  }, []);

  // 고객 선택 영역 교체
  useEffect(() => {
    if (search.length < 2) {
      setFilteredCustomers([]);
      return;
    }
    setFilteredCustomers(
      customers.filter(c =>
        c.name.includes(search) ||
        (c.mobile && c.mobile.replace(/-/g, '').includes(search.replace(/-/g, '')))
      ).slice(0, 20)
    );
  }, [search, customers]);

  // 2. 고객 선택 시 거래내역+부분합 fetch
  useEffect(() => {
    if (!selectedCustomer) return;
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
      setCustomerData(customerObj);
      setTransactions(summaryResponse.transactions || []);
      setSummary(summaryResponse);
      setCustomerName(customerObj?.name || "");
    })
    .finally(() => setLoading(false));
  }, [selectedCustomer, customers, refreshKey]);

  // 실시간 거래/입금 구독: 선택된 고객이 있을 때만 구독
  useTransactionsRealtime({
    customerId: selectedCustomer,
    onChange: triggerRefresh,
  });
  usePaymentsRealtime({
    customerId: selectedCustomer,
    onPaymentsChange: triggerRefresh,
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
      <Dialog open={pdfModalOpen} onClose={() => setPdfModalOpen(false)} className="fixed z-50 inset-0 flex items-center justify-center">
        <div className="fixed inset-0 bg-black bg-opacity-30" aria-hidden="true" />
        <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-6xl w-full mx-auto h-[90vh] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">PDF 미리보기</h2>
            <div className="flex gap-2">
              <PDFDownloadLink
                document={<StatementPDFTable transactions={transactions as any[]} customer={customerData} supplier={summary?.supplier as any} title="거래명세서" printDate={new Date().toLocaleDateString()} />}
                fileName={`${customerName || '거래명세서'}.pdf`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
              >
                {({ loading }) => loading ? 'PDF 생성 중...' : 'PDF 다운로드'}
              </PDFDownloadLink>
              <button onClick={() => setPdfModalOpen(false)} className="px-4 py-2 bg-gray-300 rounded-lg font-bold hover:bg-gray-400">닫기</button>
            </div>
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
        </div>
      </Dialog>
      {/* CustomerForm 모달 */}
      {customerFormOpen && (
        <CustomerForm open={customerFormOpen} setOpen={setCustomerFormOpen} onSuccess={() => { setCustomerFormOpen(false); triggerRefresh(); }} customer={editCustomer} />
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
              placeholder="고객명/전화번호로 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoComplete="off"
              style={{ fontSize: '1.25rem' }}
            />
            {search.length >= 2 && filteredCustomers.length > 0 && (
              <ul className="absolute left-0 right-0 bg-white border rounded shadow-lg z-10 mt-1 max-h-72 overflow-y-auto text-lg">
                {filteredCustomers.map(c => (
                  <li
                    key={c.id}
                    className="px-4 py-3 hover:bg-blue-100 cursor-pointer flex justify-between items-center"
                    onClick={() => { setSelectedCustomer(c.id); setSearch(''); inputRef.current?.blur(); }}
                  >
                    <span className="font-bold">{c.name}</span>
                    <span className="text-gray-500 text-base ml-2">{c.mobile}</span>
                  </li>
                ))}
              </ul>
            )}
            {search.length >= 2 && filteredCustomers.length === 0 && (
              <div className="absolute left-0 right-0 bg-white border rounded shadow-lg z-10 mt-1 px-4 py-3 text-gray-500 text-lg">검색 결과 없음</div>
            )}
          </div>
          {/* 버튼 우측 정렬: flex-row-reverse */}
          <div className="flex flex-row-reverse gap-2 w-full md:w-auto">
            <Button onClick={() => { setEditCustomer(null); setCustomerFormOpen(true); }} className="bg-blue-700 text-white px-6 py-3 rounded-lg text-xl font-bold">➕ 신규 고객 등록</Button>
            {selectedCustomer && (
              <Button onClick={() => { setEditTransaction(null); setTransactionFormOpen(true); }} className="bg-orange-600 text-white px-6 py-3 rounded-lg text-xl font-bold">➕ 거래 등록</Button>
            )}
          </div>
          <Button onClick={handleExcelDownload} className="bg-green-600 text-white px-4 py-2 rounded-lg text-lg font-bold">엑셀 다운로드</Button>
          <Button onClick={handlePdfPrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-lg font-bold">프린트</Button>
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
                    <TableCell className="text-right px-4 py-8 bg-red-50 font-semibold w-32">{tx.amount?.toLocaleString() || ""}</TableCell>
                    <TableCell className="text-right px-4 py-8 bg-red-50 font-semibold w-32 pl-32">{tx.paid_amount?.toLocaleString() || ""}</TableCell>
                    <TableCell className="text-right px-4 py-8 bg-red-50 font-semibold w-32">{tx.unpaid_amount?.toLocaleString() || ""}</TableCell>
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
                          <Button onClick={async () => { if(window.confirm('정말 삭제하시겠습니까?')) { await deletePayment((tx.payments as any[])[0].id, triggerRefresh); }}} className="bg-red-700 text-white px-4 py-2 rounded-lg text-lg font-bold">🗑️ 입금 삭제</Button>
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
        <PaymentForm onSuccess={() => { setPaymentFormOpen(false); triggerRefresh(); }} transactionId={targetTransactionId} payment={editPayment} />
      )}
      {/* TransactionForm 모달(등록/수정) */}
      {transactionFormOpen && (
        <TransactionForm onSuccess={() => { setTransactionFormOpen(false); triggerRefresh(); }} customers={customers} transaction={editTransaction} defaultCustomerId={!editTransaction ? selectedCustomer : undefined} />
      )}
      {/* 삭제 확인 모달 */}
      <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} className="fixed z-50 inset-0 flex items-center justify-center">
        <div className="fixed inset-0 bg-black bg-opacity-30" aria-hidden="true" />
        <div className="relative bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-auto flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-4">정말 삭제하시겠습니까?</h2>
          <div className="flex gap-4 mt-2">
            <Button onClick={async () => { if(deleteTargetId) { await deleteTransaction(deleteTargetId, triggerRefresh); setDeleteModalOpen(false); setDeleteTargetId(null); }}} className="bg-red-600 text-white px-6 py-3 rounded-lg text-xl font-bold">삭제</Button>
            <Button onClick={() => { setDeleteModalOpen(false); setDeleteTargetId(null); }} className="bg-gray-400 text-white px-6 py-3 rounded-lg text-xl font-bold">취소</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
} 